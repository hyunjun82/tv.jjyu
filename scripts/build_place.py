#!/usr/bin/env python3
"""방송 맛집 가게 페이지를 '사용자 중심'으로 다시 짠다.

입력
  data/programs/<slug>.json : 방송 정보(방송사 공식 — 상호·주소·전화·코너·방송 메뉴·회차·다시보기)
  data/stores/<slug>.json   : 가게 정보(카카오맵 장소 페이지를 사람이 확인한 값 — 메뉴·가격·영업시간·휴무·주차·가까운 역)
출력
  data/programs/<slug>.json 을 덮어쓴다(방송 정보는 'broadcast' 키에 보존 → 몇 번을 돌려도 같은 결과).

원칙: 두 출처 값을 그대로 쓰고, 어느 값이 어디서 왔는지 표에 적는다. 지어낸 문장 없음.
"""
import json, os, re, glob, urllib.parse

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PROG = os.path.join(ROOT, 'data', 'programs')
STORE = os.path.join(ROOT, 'data', 'stores')
DAYS = '월화수목금토일'
SHORT = {'today3': '생방송투데이', 'lifemaster': '생활의 달인', 'reallive': '생생정보', 'sixhour': '6시 내고향', 'town': '동네 한바퀴', 'table': '한국인의 밥상'}
FOOD = re.compile(r'빵|떡|찜|탕|국|면|밥|무침|조개|게|새우|해산물|닭|곱창|대창|막창|고기|갈비|구이|볶음|전골|두부|잣|막국수|어죽|도리뱅뱅|돈가스|돈까스|샐러드|문어|고등어|짬뽕|짜장|만두|회$|쌈밥|정식|찌개|족발|보쌈|치킨|피자|국수|라면|전$')
BC_KEYS = ('가격', '영업시간', '운영시간', '주차', '요금', '휴무', '이용 안내', '메뉴')


def won(s):
    m = re.search(r'([\d,]+)\s*원', s or '')
    return int(m.group(1).replace(',', '')) if m else None


def city_of(addr):
    t = (addr or '').split()
    if len(t) < 2:
        return ''
    a, b = t[0], t[1]
    a = {'서울특별시': '서울', '인천광역시': '인천', '부산광역시': '부산', '대구광역시': '대구', '광주광역시': '광주', '대전광역시': '대전', '울산광역시': '울산',
         '경기도': '경기', '강원특별자치도': '강원', '충청북도': '충북', '충청남도': '충남', '전북특별자치도': '전북', '전라남도': '전남', '경상북도': '경북', '경상남도': '경남',
         '제주특별자치도': '제주'}.get(a, a)
    return f'{a} {b}'


def dong_of(jibun):
    t = (jibun or '').split()
    for x in t:
        if re.search(r'(동|읍|면|가)$', x) and not re.search(r'\d', x):
            return x
    return ''


def exit_of(s):
    m = re.search(r'(\S+역)\s*(\d+번 출구)에서\s*([\d,.]+k?m)\s*도보\s*(\d+분)', s or '')
    return f'{m.group(1)} {m.group(2)}에서 {m.group(3)} · 도보 {m.group(4)}' if m else ''


def hours_rows(h):
    d = {k: v for k, v in h}
    return [[x, d[x]] for x in DAYS if x in d]


def hours_summary(h):
    rows = hours_rows(h)
    if not rows:
        return '', ''
    off = [d for d, v in rows if v.startswith('휴무')]
    opens = [(d, v) for d, v in rows if not v.startswith('휴무')]
    groups = {}
    for d, v in opens:
        groups.setdefault(v.split(' / ')[0], []).append(d)
    parts = [next(iter(groups))] if len(groups) == 1 else [f'{"·".join(ds)} {t}' for t, ds in groups.items()]
    if len(groups) == 1 and len(opens) == 7:
        parts = [f'매일 {next(iter(groups))}']
    brk = sorted({x for _, v in opens for x in v.split(' / ')[1:] if '브레이크' in x})
    lo = sorted({x for _, v in opens for x in v.split(' / ')[1:] if '라스트' in x})
    s = ', '.join(parts) + (f' (브레이크타임 {brk[0].replace(" 브레이크타임", "")})' if len(brk) == 1 else '') + (f' · 라스트오더 {lo[0].replace(" 라스트오더", "")}' if len(lo) == 1 else '')
    return s, ('매주 ' + '·'.join(off) + '요일' if off else '정기 휴무 표기 없음')


def broadcast_of(p):
    if p.get('broadcast'):
        return p['broadcast']
    f = dict(p['facts'])
    vod = next((c for c in p['ctas'] if c['kind'] in ('sbs', 'kbs')), None)
    ep = next((a['url'] for s in p['sections'] for a in (s.get('actions') or []) if str(a.get('url', '')).startswith('/')), '')
    m = re.match(r'^(\d{4}\.\d{2}\.\d{2} \([^)]+\))', p.get('airtime', ''))
    no = re.search(r'(\d[\d,]*)회', f.get('방송', ''))
    return dict(
        program=p['program'], series=p['series'], channel=p['channel'], date=m.group(1) if m else '', no=no.group(1) if no else '',
        corner=f.get('코너', ''), menu=f.get('방송 메뉴', ''),
        topic=next((r[1] for s in p['sections'][:1] for r in ((s.get('table') or {}).get('rows') or []) if r[0] == '코너 제목'), ''), name=f.get('상호', p['name']), addr=f.get('주소', ''), tel=f.get('전화', ''),
        official=[[k, v] for k, v in p['facts'] if k in BC_KEYS or k in ('행사 기간', '기간')],
        vod=vod and dict(kind=vod['kind'], label=vod['label'], url=vod['url'], sub=vod.get('sub', '')),
        post=(p.get('quick') or [{}])[0].get('url', ''), postLabel=(p.get('quick') or [{}])[0].get('label', '공식 방송정보'),
        ep=ep, image=p.get('backdrop', ''), imageCredit=p.get('imageCredit', ''), siblings=p.get('related', []),
        sourceBroadcast=p.get('source', ''), kind=p.get('status', ''))


def build(p, st, allp):
    b = broadcast_of(p)
    short = SHORT.get(b['program'], b['series'])
    name = b['name']
    addr = b['addr'] or st.get('addr', '')
    city, dong = city_of(addr), dong_of(st.get('jibun', ''))
    menu = st.get('menu') or []
    bmenu = [x.strip() for x in re.split(r'(?i)\s*[·,/]\s*|\s+vs\s+|!|\s*&\s*', (b['menu'] or '') + ' / ' + b.get('topic', '')) if len(x.strip()) >= 2]
    # 대표 메뉴: 방송 메뉴와 이름이 겹치는 카카오맵 메뉴 → 없으면 메뉴판 첫 줄
    nz = lambda x: re.sub(r'\s|\(.*?\)', '', x)
    def lcs(a, c):
        a, c, best = nz(a), nz(c), 0
        for i in range(len(a)):
            for j in range(i + best + 1, len(a) + 1):
                if a[i:j] in c:
                    best = j - i
                else:
                    break
        return best
    vsrc = ' / '.join(x for x in [b.get('menu', ''), b.get('topic', '')] if re.search(r'(?i)\svs\s', x))
    vs_only = ''
    if vsrc:  # 'A vs B' 대결 코너 → 이 가게 쪽 메뉴만
        own = name + ' ' + ' '.join(m[0] for m in menu)
        tt = [x.strip() for x in re.split(r'(?i)\s*[·,/]\s*|\s+vs\s+|!|\s*&\s*', vsrc) if len(x.strip()) >= 2]
        bmenu = [t for t in bmenu if t not in tt or lcs(t, own) >= 3]
        vs_only = next((t for t in tt if lcs(t, own) >= 3 and FOOD.search(t)), '')
    def hit(m):
        n = nz(m[0])
        return any((len(n) >= 3 and n in nz(t)) or (len(nz(t)) >= 2 and nz(t) in n) for t in bmenu if FOOD.search(t))
    offp = [x for k, v in b['official'] if k == '가격' for x in re.split(r'[,/]', v)]
    sig = next((m for t in offp for m in menu if nz(m[0]) and (nz(m[0]) in nz(t) or nz(re.sub(r'[\d,]+원.*$', '', t)) in nz(m[0]))), None) \
        or next((m for m in menu if hit(m)), None)
    sig_txt = f'{sig[0]} {sig[1]}' if sig else (vs_only if vsrc else (b['menu'] or ''))
    hsum, off = hours_summary(st.get('hours') or [])
    park = st.get('parking') or next((v for k, v in b['official'] if k == '주차'), '')
    ex = exit_of(st.get('exit', ''))
    kakao = f'https://place.map.kakao.com/{st["id"]}'
    q = urllib.parse.quote(f'{name} {addr}')
    tel = b['tel']
    tel_href = 'tel:' + re.sub(r'[^0-9]', '', tel) if len(re.sub(r'[^0-9]', '', tel)) >= 8 else ''
    vod = b['vod']
    prices = [won(m[1]) for m in menu if won(m[1])]
    prange = f'{min(prices):,}원 ~ {max(prices):,}원' if len(prices) >= 2 else ''

    facts = [r for r in [
        ['대표 메뉴' if sig else '방송 메뉴', sig_txt], ['가격대', prange], ['영업시간', hsum], ['휴무', off if st.get('hours') else ''],
        ['주차', park], ['주소', addr], ['전화', tel], ['가까운 역', ex], ['분류', st.get('cat', '')],
        ['방송', f'{b["channel"]} {b["no"]}회 · {b["date"]}' + (f' · {b["corner"]}' if b['corner'] else '')],
    ] if r[1]]
    ctas = ([dict(kind='tel', label='전화 걸기', sub=tel, url=tel_href)] if tel_href else []) + [
        dict(kind='map', label='카카오맵 길찾기', sub='영업시간 · 메뉴', url=kakao),
        dict(kind='map', label='네이버 지도', sub='위치 보기', url=f'https://map.naver.com/p/search/{q}')] + ([vod] if vod else [])

    secs = []
    if menu:
        rows = [[('<b>' + m[0] + '</b>') if sig and m == sig else m[0], m[1]] for m in menu]
        secs.append(dict(id='menu', tab='메뉴·가격', heading=f'{name} 메뉴판과 가격은?',
                         lead=(f'대표 메뉴는 {sig[0]}({sig[1]})입니다. ' if sig else '') + (f'메뉴 가격은 {prange}입니다.' if prange else ''),
                         table=dict(head=['메뉴', '가격'], rows=rows, cls='menu'),
                         paragraphs=[f'카카오맵에 등록된 메뉴판 기준입니다({st["checked"]} 확인' + (', 일부만 옮김' if st.get('partial') else '') + '). 가격은 바뀔 수 있습니다.']
                         + ([f'방송({b["date"]})에서 소개된 메뉴: <b>{b["menu"]}</b>'] if b['menu'] else []),
                         actions=[dict(kind='map', label='카카오맵 메뉴 전체 보기', url=kakao)]))
    if st.get('hours'):
        secs.append(dict(id='hours', tab='영업시간·휴무', heading=f'{name} 영업시간과 휴무일은?',
                         lead=f'영업시간은 {hsum}입니다. 휴무는 {off}.',
                         table=dict(head=['요일', '영업시간'], rows=hours_rows(st['hours']), cls='hours'),
                         paragraphs=[f'카카오맵 영업정보 기준입니다({st["checked"]} 확인). 공휴일·명절 영업은 전화로 확인하세요.']
                         + [f'{"KBS" if b["program"] in ("reallive", "sixhour", "town", "table") else "방송사"} 방송정보 표기 — {k}: {v}' for k, v in b['official'] if k in ('영업시간', '운영시간')],
                         actions=[c for c in ctas if c['kind'] == 'tel']))
    way = [r for r in [['주소', addr], ['지번', st.get('jibun', '')], ['가까운 역', ex], ['주차', park], ['시설', ' · '.join(st.get('fac') or [])], ['전화', tel]] if r[1]]
    secs.append(dict(id='way', tab='주차·가는 길', heading=f'{name} 주차되나요? 가는 길은?',
                     lead=(f'주차는 {park}. ' if park else '주차 정보는 확인되지 않았습니다. ') + (f'{ex}.' if ex else ''),
                     table=dict(head=['항목', '내용'], rows=way),
                     paragraphs=['주소·전화는 방송사 공식 방송정보, 주차·역·시설은 카카오맵 정보입니다.'] + [f'방송정보 표기 — 주차: {v}' for k, v in b['official'] if k == '주차' and v != park],
                     actions=[c for c in ctas if c['kind'] in ('map',)]))
    secs.append(dict(id='tv', tab='방송 내용', heading=f'{name} {short} 몇 회에 나왔나요?',
                     lead=f'{b["date"]} {b["channel"]} {b["no"]}회' + (f' 「{b["corner"]}」' if b['corner'] else '') + ' 편에 나왔습니다.' + (f' 방송 메뉴는 {b["menu"]}입니다.' if b['menu'] else ''),
                     table=dict(head=['항목', '내용'], rows=[r for r in [['방송일', b['date']], ['회차', f'{b["no"]}회'], ['코너', b['corner']], ['방송 메뉴', b['menu']]] + b['official'] if r[1]]),
                     paragraphs=[], images=([dict(src=b['image'], cap=f'{b["series"]} {b["no"]}회 ({b["imageCredit"]})', url=vod['url'], kind=vod['kind'], label=vod['label'], wide=True)] if b['image'] and vod else []),
                     actions=([vod] if vod else []) + ([dict(kind='link', label=b['postLabel'], url=b['post'])] if b['post'] else [])))
    # 같은 지역의 다른 방송 맛집 (프로그램 구분 없이)
    near = [x for x in allp if x is not p and x.get('type') == 'place' and x.get('store') and x['store'].get('city') == city and x['slug'] != p['slug']][:8]
    sib = [s for s in b['siblings'] if s.get('slug')]
    rel_rows = [[f'<a href="/{x["slug"]}/">{x["name"]}</a>', x['store'].get('sig', ''), SHORT.get(x.get('program'), x.get('series', ''))] for x in near]
    if rel_rows:
        secs.append(dict(id='near', tab=f'{city} 방송 맛집', heading=f'{city} 다른 방송 맛집은 어디인가요?',
                         lead=f'TV에 나온 {city} 가게입니다.', table=dict(head=['상호', '대표 메뉴', '방송'], rows=rel_rows), paragraphs=[]))
    if b['ep']:
        secs.append(dict(id='same', tab='같은 날 방송', heading=f'{b["date"][:10].replace(".", ".")} {short}에 같이 나온 곳은?',
                         lead=f'같은 회차({b["no"]}회)에 나온 곳입니다.', paragraphs=[],
                         table=dict(head=['상호', '내용'], rows=[[f'<a href="/{s["slug"]}/">{s["name"]}</a>', s.get('desc', '')] for s in sib]) if sib else None,
                         actions=[dict(kind='link', label=f'{b["no"]}회 방송 맛집 총정리', url=b['ep'])]))

    faq = []
    if sig: faq.append(dict(q=f'{name} 대표 메뉴와 가격은?', a=f'{sig[0]} {sig[1]}입니다(카카오맵 메뉴판, {st["checked"]} 확인).'))
    if hsum: faq.append(dict(q=f'{name} 영업시간은?', a=f'{hsum}. 휴무: {off}. (카카오맵, {st["checked"]} 확인)'))
    if park: faq.append(dict(q=f'{name} 주차 가능한가요?', a=park))
    if ex: faq.append(dict(q=f'{name} 가까운 역은?', a=ex))
    faq.append(dict(q=f'{name} {short} 몇 회에 나왔나요?', a=f'{b["date"]} 방송 {b["no"]}회' + (f' 「{b["corner"]}」' if b['corner'] else '') + '입니다.'))

    head = [f'{short} 맛집 {city.split()[-1] if city else ""} {name}'.replace('  ', ' ')]
    title = ''
    for part in head + ([re.sub(r'\s*\(.*$', '', sig[0])] if sig else [t for t in bmenu if FOOD.search(t) and len(t) <= 14][:1]) + (['메뉴 가격'] if menu else []) + (['영업시간'] if hsum else []) + (['주차'] if park else []):
        cand = (title + ' ' + part).strip()
        if len(cand) <= 40:
            title = cand
    intro = (f'<b>{name}</b>은(는) {city}' + (f' {dong}' if dong else '') + (f'의 {st["cat"].split(",")[0]} 집' if st.get('cat') else '') + '입니다. '
             + (f'대표 메뉴는 <b>{sig[0]} {sig[1]}</b>, ' if sig else '') + (f'영업시간은 {hsum}, 휴무는 {off}. ' if hsum else '')
             + (f'주차: {park}. ' if park else '') + (f'{ex}. ' if ex else '')
             + f'{b["date"]} {b["channel"]} {b["no"]}회' + (f' 「{b["corner"]}」' if b['corner'] else '') + '에 나왔습니다.')
    p.update(
        broadcast=b, title=title, name=name, shortName=name, status='방송 맛집',
        airtime=f'{b["date"]} 방송', badges=[x for x in [short, city, st.get('cat', '').split(',')[0]] if x],
        facts=facts, intro=intro, ctas=ctas,
        quick=[dict(label='카카오맵 장소 정보', url=kakao, kind='map')] + ([dict(label=b['postLabel'], url=b['post'], kind='link')] if b['post'] else []),
        sections=secs, faq=faq, related=[dict(slug=s['slug'], name=s['name'], desc=s.get('desc', '')) for s in sib][:6],
        store=dict(city=city, dong=dong, sig=sig_txt, cat=st.get('cat', ''), kakao=kakao, checked=st['checked']),
        source=f'{b["sourceBroadcast"]} · 카카오맵 장소 정보(메뉴·가격·영업시간·주차·역, {st["checked"]} 확인)',
    )
    return p


def main():
    allp = [json.load(open(f)) for f in glob.glob(os.path.join(PROG, '*.json'))]
    by = {p['slug']: p for p in allp}
    stores = {os.path.basename(f)[:-5]: json.load(open(f)) for f in glob.glob(os.path.join(STORE, '*.json'))}
    # 1차: store 요약(city/sig)을 먼저 채워 '같은 지역' 목록이 서로 보이게 한다
    for slug, st in stores.items():
        if slug in by:
            build(by[slug], st, [])
    for slug, st in stores.items():
        if slug in by:
            p = build(by[slug], st, allp)
            json.dump(p, open(os.path.join(PROG, slug + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
            print('place', slug, p['title'])


if __name__ == '__main__':
    main()
