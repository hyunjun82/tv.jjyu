#!/usr/bin/env python3
"""KBS 방송 맛집·장소 자동 수집 (collect_shows.py 가 불러 쓴다)

출처는 KBS 공식만 쓴다.
  - KBS 시청자상담실 「방송정보」(iaudience.kbs.co.kr/broadcast): 매일 프로그램별 '취재 연락처'
    상호·전화·주소와, 제작진이 적은 경우 가격·영업시간·주차·휴무
  - KBS 공식 회차 데이터(static.api.kbs.co.kr mediafactory): 회차 번호·방송일·코너·이미지·다시보기
게시글에 없는 값은 쓰지 않는다. 출연자 개인 이름이 나오는 '감사' 문구는 버린다.
"""
import re, html, datetime, urllib.parse
import collect_shows as C

IA = 'https://iaudience.kbs.co.kr'
PROGS = {
    '2TV 생생정보': dict(key='reallive', name='2TV 생생정보', short='생생정보', ch='KBS 2TV', code='T2014-0844',
                       home='https://program.kbs.co.kr/2tv/culture/reallive', air='평일 오후 6시 35분', min=datetime.date(2026, 10, 23)),
    '6시 내고향': dict(key='sixhour', name='6시 내고향', short='6시 내고향', ch='KBS 1TV', code='T2000-0093',
                    home='https://program.kbs.co.kr/1tv/culture/sixhour', air='평일 오후 6시', min=datetime.date(2026, 10, 23)),
    '동네 한 바퀴': dict(key='town', name='동네 한 바퀴', short='동네 한바퀴', ch='KBS 1TV', code='T2018-0429',
                     home='https://program.kbs.co.kr/1tv/culture/town', air='매주 토요일 오후 7시 10분', min=datetime.date(2026, 10, 24)),
    '한국인의 밥상': dict(key='table', name='한국인의 밥상', short='한국인의 밥상', ch='KBS 1TV', code='T2010-1657',
                      home='https://program.kbs.co.kr/1tv/culture/table', air='매주 목요일 오후 7시 40분', min=datetime.date(2026, 10, 22)),
}
REGION = re.compile(r'^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|충청|전북|전남|전라|경북|경남|경상|제주)')
PHONE = re.compile(r'^[\d\-–\s,/()]+$')
SKIP = re.compile(r'감사|촬영에 (도움|협조)|출연(해|에)|시청해주셔서|궁금하신 점|많은 시청')
LABELS = {'이용 요금': '요금', '이용요금': '요금', '운영시간': '운영시간', '운영 시간': '운영시간', '영업시간': '영업시간', '영업 시간': '영업시간',
          '가격': '가격', '메뉴': '메뉴', '탑승 안내': '이용 안내', '이용 안내': '이용 안내', '휴무': '휴무', '주차': '주차', '예약': '예약'}


def unwrap(l):
    l = l.lstrip('※* ').strip()
    return l[1:-1].strip() if l.startswith('(') and l.endswith(')') else l


def clean(t):
    t = re.sub(r'(?s)<script.*?</script>|<style.*?</style>', '', t)
    t = re.sub(r'<br\s*/?>|</p>|</div>|</li>|</h\d>', '\n', t, flags=re.I)
    t = re.sub(r'</?[a-zA-Z][^>]*>', '', t)  # 진짜 HTML 태그만 지운다(<코너명>, <가게 앞 주차장> 같은 본문은 남김)
    t = html.unescape(t).replace('\xa0', ' ')
    return [re.sub(r'[ \t]+', ' ', l).strip() for l in t.split('\n') if l.strip()]


def posts():
    """최근 방송정보 글 [(날짜, 글번호)]"""
    t = C.get(IA + '/broadcast', raw=True).decode('utf-8', 'ignore')
    out = []
    for m in re.finditer(r'/broadcast/(\d+)"', t):
        no = m.group(1)
        seg = t[m.end():m.end() + 600]
        d = re.search(r'\[(\d{1,2})월\s*(\d{1,2})일', seg)
        if d:
            y = C.NOW.year if int(d.group(1)) <= C.NOW.month + 1 else C.NOW.year - 1
            out.append((datetime.date(y, int(d.group(1)), int(d.group(2))), no))
    return sorted(set(out), reverse=True)


def sections(no):
    """글 하나 → {프로그램명: [줄...]}"""
    L = clean(C.get(f'{IA}/broadcast/{no}', raw=True).decode('utf-8', 'ignore'))
    out, cur = {}, None
    for i, l in enumerate(L):
        if l.startswith('방송시간 ('):
            cur = None
            nxt = L[i + 1] if i + 1 < len(L) else ''
            if nxt in PROGS:
                cur = nxt
                out[cur] = []
            continue
        if l.startswith('프로그램 정보'):
            cur = None
        elif cur and l != cur:
            out[cur].append(l)
    return out


def split_name(left):
    """'메뉴 문의 (상호)' / '상호 (메뉴 문의)' / '메뉴 (상호)' / '상호' → (상호, 메뉴)"""
    left = re.sub(r'^\((아르바이트|체험)\)\s*', '', left.strip())
    m = re.match(r'^(.*?)\s*\(\s*(.+?)\s*\)\s*$', left)
    if not m:
        return re.sub(r'\s*(이용\s*)?문의$', '', left), ''
    o, p = m.group(1).strip(), m.group(2).strip()
    if not o:
        return p, ''
    if o.endswith('문의'):
        return p, re.sub(r'\s*(이용\s*)?문의$', '', o)
    if p.endswith('문의'):
        return o, re.sub(r'\s*(이용\s*)?문의$', '', p)
    return p, o


def parse(lines):
    head, groups, cur, item, label = [], [], None, None, None

    def group(corner, region=''):
        g = dict(corner=corner, region=region, items=[])
        groups.append(g)
        return g

    for l in lines:
        if SKIP.search(l):
            continue
        m = re.match(r'^<\s*(.+?)\s*>\s*(.*)$', l)
        if m and m.group(1) in LABELS:  # <운영시간> 같은 소제목 → 다음 줄들이 그 값
            label = LABELS[m.group(1)]
            continue
        if m and (' - ' in m.group(1) or len(m.group(1)) > 10 or m.group(2)):  # 코너 제목
            rest = re.sub(r'\s*Rep\..*$', '', m.group(2)).strip()
            rg = re.match(r'^\((.+?)\)', rest)
            cur, item, label = group(m.group(1).strip(), rg.group(1) if rg else ''), None, None
            continue
        if re.match(r'^\([^)]{2,20}\)$', l):  # (경북 안동)
            cur, item, label = group('', l.strip('()')), None, None
            continue
        if l.startswith('-'):
            body = l.lstrip('- ').strip()
            label = None
            if body.startswith('공개된 연락처'):
                continue
            mkv = re.match(r'^(.+?)\s*[:：]\s*(.*)$', body)
            k, sep, v = (mkv.group(1), ':', mkv.group(2)) if mkv else (body, '', '')
            k, v = k.strip(), v.strip()
            is_tel = bool(v) and (PHONE.match(v) or v.startswith('공개된 연락처'))
            if item and sep and not is_tel and len(k) <= 8 and not v.startswith('http'):
                item['attrs'].append([k, v])  # '- 기간 : ...' 처럼 앞 항목의 속성
                continue
            if sep and not is_tel and v.startswith('http'):
                item = None
            name, menu = split_name(k)
            if cur is None:
                cur = group('')
            item = dict(name=name, menu=menu, raw=k, tel='' if (not is_tel or v.startswith('공개된')) else v,
                        addr='', attrs=[], notes=[], url='' if not v.startswith('http') else v)
            cur['items'].append(item)
            continue
        if cur is None:
            head.append(l)
            continue
        if not item:
            continue
        if re.match(r'^https?://', l):
            item['url'] = item['url'] or l
            continue
        if not item['addr'] and REGION.match(l) and not re.search(r'[:：]', l):
            item['addr'] = l
            continue
        mm = re.match(r'^[*※]\s*(.+)$', l)
        if mm:
            t = mm.group(1).strip().rstrip('*').strip()
            label = None
            pk = re.match(r'^주차는\s*<(.+?)>', t)
            kv = re.match(r'^([^:：]{1,10})\s*[:：]\s*(.+)$', t)
            if pk:
                item['attrs'].append(['주차', pk.group(1)])
            elif kv and re.match(r'^(홈페이지|스마트\s*스토어)', kv.group(1)):
                item['url'] = item['url'] or kv.group(2).strip()
            elif kv:
                item['attrs'].append([kv.group(1).strip(), kv.group(2).strip()])
            else:
                item['notes'].append(re.sub(r'[<>]', '', t))
            continue
        kv = re.match(r'^([^:：]{1,10})\s*[:：]\s*(.+)$', l)
        if kv and not label:
            item['attrs'].append([kv.group(1).strip(), kv.group(2).strip()])
            continue
        if label:
            if item['attrs'] and item['attrs'][-1][0] == label:
                item['attrs'][-1][1] += ' / ' + unwrap(l)
            else:
                item['attrs'].append([label, unwrap(l)])
            continue
        item['notes'].append(unwrap(l))
    return head, [g for g in groups if g['items']]


def episodes(code):
    u = (f'https://static.api.kbs.co.kr/mediafactory/v1/contents?rtype=json&sort_option=program_planned_date%7Cdesc'
         f'&program_code={code}&page=1&page_size=10')
    out = {}
    for x in C.get(u).get('data', []):
        if x.get('rerun_classification') not in (None, '', '01'):
            continue
        ds = x.get('program_planned_date', '')
        try:
            d = datetime.date(int(ds[:4]), int(ds[4:6]), int(ds[6:8]))
        except Exception:
            continue
        out.setdefault(d, x)
    return out


def corner_rows(main_story):
    rows = []
    for c in [c.strip() for c in (main_story or '').split(' / ') if c.strip()]:
        m = re.match(r'^\[(.+?)\]\s*(.*)$', c)
        rows.append([m.group(1), m.group(2)] if m else ['', c])
    return rows


def pick(attrs, *keys):
    for k, v in attrs:
        if any(x in k for x in keys):
            return v
    return ''


FOODC = re.compile(r'장사의 신|음식 X-파일|맛집|시골빵집|결정적 한 수|밥 됩니까|밥집|가격파괴|엄마의 밥상|먹어봤|미식|맛')
SOLO = re.compile(r'(국|탕|면|회|전|빵|떡|찜|밥|죽)$')


def is_food(name, menu, corner):
    t = f'{name} {menu}'
    return bool(re.search(r'식당|맛집|국수|짬뽕|찜닭|구이|쌈밥|정식|갈비|감자탕|막국수|어죽|돈가스|매운탕|빵|떡|두부|카페|본점|가든|횟집|전문점', t)
                or (menu and (C.FOOD.search(menu) or SOLO.search(menu))) or (FOODC.search(corner or '') and not re.search(r'농장|농원|체험|시장|마을|공원|산$', name)))


def region_of(addr):
    t = (addr or '').split()
    return ' '.join(t[:2]) if len(t) >= 2 else ''


def corner_name(g):
    c = g['corner']
    m = re.match(r'^(.+?)\s+-\s+(.+)$', c)
    return (m.group(1), m.group(2)) if m else (c, '')


# ---------------------------------------------------------------- 페이지
def shop_page(cfg, d, no, it, g, idx, sib, ep_slug, vod, img, post_url):
    slug = f'{cfg["key"]}-{no}-{idx}'
    name, menu = it['name'], it['menu']
    cn, ct = corner_name(g)
    region = region_of(it['addr']) or g['region']
    q = urllib.parse.quote(name + ' ' + ' '.join(it['addr'].split()[:2]))
    price, hours, park = pick(it['attrs'], '가격', '요금', '메뉴'), pick(it['attrs'], '영업', '운영'), pick(it['attrs'], '주차')
    off = pick(it['attrs'], '휴무', '휴관')
    facts = [['상호', name]]
    if menu: facts.append(['방송 메뉴', menu])
    if region: facts.append(['지역', region])
    if it['addr']: facts.append(['주소', it['addr']])
    if it['tel']: facts.append(['전화', it['tel']])
    for k, v in it['attrs']:
        facts.append([k, v])
    facts += [['방송', f'{cfg["ch"]} {cfg["name"]} {no}회 ({C.kdate(d)})']] + ([['코너', cn]] if cn else [])
    ctas = [dict(kind='kbs', label=f'{no}회 다시보기', sub=f'KBS 공식 · {C.md(d)} 방송', url=vod),
            dict(kind='map', label='네이버 지도로 보기', sub='위치 · 길찾기', url=f'https://map.naver.com/p/search/{q}')]
    if C.tel_href(it['tel']):
        ctas.append(dict(kind='tel', label='전화 걸기', sub=it['tel'], url=C.tel_href(it['tel'])))
    if it['url']:
        ctas.append(dict(kind='link', label='공식 홈페이지 · 스토어', url=it['url'] if it['url'].startswith('http') else 'https://' + it['url']))
    topic = menu or ct
    about = f'「{cn}」' + (f'({ct})' if ct else '') if cn else ''
    official = [[k, v] for k, v in it['attrs']]
    rows_sib = [[f'<a href="/{s["slug"]}/">{s["name"]}</a>' if s.get('slug') else s['name'], s['menu'] or s['corner'] or '—', s['addr'] or '—'] for s in sib]
    secs = [
        dict(id='sec1', tab='방송 내용', heading=f'{name} {cfg["short"]} 어느 코너에 나왔나요?',
             lead=f'{C.kdate(d)} {cfg["ch"]} {cfg["name"]} {no}회' + (f' {about} 편' if about else '') + '에 나온 곳입니다.'
                  + (f' 방송에서 소개된 메뉴는 「{menu}」입니다.' if menu else ''),
             table=dict(head=['항목', '내용'], rows=[r for r in [['방송일', C.kdate(d)], ['회차', f'{no}회'], ['코너', cn], ['코너 제목', ct], ['방송 메뉴', menu], ['KBS 표기', it['raw']]] if r[1]]),
             paragraphs=[f'상호·주소·전화는 KBS 시청자상담실 「방송정보」의 {C.kdate(d)}자 {cfg["name"]} 취재 연락처 그대로입니다.'],
             images=([dict(src=img, cap=f'{cfg["name"]} {no}회 (KBS 공식 회차 이미지)', url=vod, kind='kbs', label=f'{no}회 다시보기', wide=True)] if img else []),
             actions=[dict(kind='kbs', label=f'{no}회 다시보기', url=vod), dict(kind='link', label='KBS 공식 방송정보 원문', url=post_url)]),
        dict(id='sec2', tab='위치·전화', heading=f'{name} 위치·주소·전화번호는?',
             lead=(f'주소는 {it["addr"]}입니다.' if it['addr'] else '주소는 KBS 방송정보에 없습니다.') + (f' 전화는 {it["tel"]}입니다.' if it['tel'] else ''),
             table=dict(head=['항목', '내용'], rows=[r for r in [['상호', name], ['주소', it['addr']], ['지역', region], ['전화', it['tel']]] if r[1]]),
             paragraphs=['아래 지도 버튼을 누르면 이 주소로 바로 검색됩니다.'], actions=[c for c in ctas if c['kind'] != 'kbs']),
    ]
    if official:
        secs.append(dict(id='sec3', tab='가격·영업시간', heading=f'{name} 가격·영업시간·주차는?',
                         lead='KBS 제작진이 방송정보에 적은 내용 그대로입니다.',
                         table=dict(head=['항목', 'KBS 방송정보 표기'], rows=official),
                         paragraphs=[f'※ {n}' for n in it['notes']] + ['가격·영업시간은 바뀔 수 있으니 방문 전 전화로 확인하세요.'],
                         actions=[c for c in ctas if c['kind'] == 'tel']))
    else:
        secs.append(dict(id='sec3', tab='가격·영업시간·주차', heading=f'{name} 가격·영업시간·주차는?',
                         lead='KBS 방송정보에는 이 곳의 가격·영업시간·주차가 나오지 않아 적지 않았습니다.',
                         table=dict(head=['확인할 것', '확인하는 곳'], rows=[['영업시간 · 휴무일', '지도 앱의 가게 정보 또는 전화'], ['메뉴 가격', '지도 앱의 메뉴판 또는 전화'], ['주차 · 예약', '전화' + (f' ({it["tel"]})' if it['tel'] else '')]]),
                         paragraphs=[f'※ {n}' for n in it['notes']], actions=[c for c in ctas if c['kind'] != 'kbs']))
    secs.append(dict(id='sec4', tab=f'{C.md(d)} 방송 전체', heading=f'{C.md(d)} {cfg["name"]}에 나온 곳은 어디인가요?',
                     lead=f'{no}회 KBS 방송정보에 올라온 곳은 모두 {len(sib)}곳입니다.',
                     table=dict(head=['상호', '방송 메뉴·코너', '주소'], rows=rows_sib), paragraphs=[],
                     actions=[dict(kind='link', label=f'{C.md(d)} {cfg["short"]} 총정리', url=f'/{ep_slug}/')]))
    faq = [dict(q='몇 시 방송인가요?', a=f'{cfg["ch"]} {cfg["name"]}는 {cfg["air"]} 방송입니다(KBS 공식 회차 편성).')]
    if price: faq.append(dict(q=f'{name} 가격은 얼마인가요?', a=f'KBS 방송정보 표기: {price}'))
    if hours: faq.append(dict(q=f'{name} 영업시간은요?', a=f'KBS 방송정보 표기: {hours}' + (f' · 휴무: {off}' if off else '')))
    if park: faq.append(dict(q=f'{name} 주차는 되나요?', a=f'KBS 방송정보 표기: {park} 이용'))
    faq.append(dict(q='주소와 전화번호 출처는요?', a=f'KBS 시청자상담실 「방송정보」 {C.kdate(d)}자 {cfg["name"]} 취재 연락처입니다.'))
    info = ', '.join(x for x in [f'주소는 <b>{it["addr"]}</b>' if it['addr'] else '', f'전화는 <b>{it["tel"]}</b>' if it['tel'] else ''] if x)
    extra = ' '.join(x for x in [f'가격은 {price}.' if price else '', f'영업시간은 {hours}.' if hours else '', f'주차는 {park}.' if park else ''] if x)
    return dict(
        slug=slug, type='place', category='맛집', series=cfg['name'], seriesSlug=cfg['key'], program=cfg['key'],
        title=C.title40([f'{cfg["short"]} {name}', '위치 전화번호' if it['tel'] else '위치 주소', '가격' if price else '', f'{d.month}월 {d.day}일', topic]),
        name=name, shortName=name, subtitle='', channel=f'{cfg["ch"]} {cfg["name"]}',
        airtime=f'{C.kdate(d)} 방송' + (f' · {cn}' if cn else ''), status='방송 맛집' if is_food(name, menu, cn) else '방송 장소',
        backdrop=img or '', thumb=img or '', badges=[f'{no}회 · {C.md(d)}'] + ([cn] if cn else []) + ([region] if region else []),
        facts=facts, next=None,
        intro=(f'<b>{name}</b>은(는) {C.kdate(d)} {cfg["ch"]} {cfg["name"]} {no}회' + (f' {about} 편' if about else '') + '에 나온 곳입니다. '
               + (f'방송 메뉴는 「{menu}」입니다. ' if menu else '') + (info + '입니다. ' if info else '') + (extra + ' ' if extra else '')
               + 'KBS 시청자상담실 「방송정보」 그대로입니다.'),
        ctas=ctas,
        quick=[dict(label='KBS 공식 방송정보', url=post_url, kind='link'),
               dict(label='카카오맵에서 보기', url=f'https://map.kakao.com/?q={q}', kind='map'),
               dict(label=f'{cfg["name"]} 공식 홈페이지', url=cfg['home'], kind='link')],
        links=[], ott=[], sections=secs, cast=[], episodes=[], faq=faq,
        related=[dict(slug=s['slug'], name=s['name'], desc=f'{C.md(d)} · {s["menu"] or s["corner"]}') for s in sib if s.get('slug') and s['slug'] != slug][:6],
        source=f'KBS 시청자상담실 방송정보({C.kdate(d)} {cfg["name"]} 취재 연락처) · KBS 공식 회차 데이터({no}회 방송일·이미지·다시보기)',
        imageCredit='KBS 공식 회차 이미지' if img else '',
        checkedAt=C.NOW.strftime('%Y-%m-%d'), updatedAt=C.NOW.isoformat(timespec='seconds'),
    )


def episode_page(cfg, d, no, ep, head, groups, flat, vod, img, post_url):
    slug = f'{cfg["key"]}-{no}'
    corners = corner_rows(ep.get('main_story')) if cfg['key'] in ('reallive', 'sixhour') else []
    story = (ep.get('main_story') or '').strip()
    rows = [[f'<a href="/{s["slug"]}/">{s["name"]}</a>' if s.get('slug') else s['name'], s['menu'] or s['corner'] or '—', s['addr'] or '—', s['tel'] or '—'] for s in flat]
    priced = [s for s in flat if s['attrs']]
    secs = [dict(id='sec1', tab='오늘 나온 곳', heading=f'{d.month}월 {d.day}일 {cfg["short"]}에 나온 곳은 어디인가요?',
                 lead=f'{no}회 KBS 방송정보에 올라온 곳은 {len(flat)}곳입니다. 상호를 누르면 가게별 위치·전화 페이지로 이동합니다.',
                 table=dict(head=['상호', '방송 메뉴·코너', '주소', '전화'], rows=rows), paragraphs=[],
                 images=([dict(src=img, cap=f'{cfg["name"]} {no}회 (KBS 공식 회차 이미지)', url=vod, kind='kbs', label=f'{no}회 다시보기', wide=True)] if img else []),
                 actions=[dict(kind='kbs', label=f'{no}회 다시보기', url=vod), dict(kind='link', label='KBS 공식 방송정보 원문', url=post_url)])]
    gr = [[g['corner'] or g['region'] or '—', ', '.join(f'<a href="/{s["slug"]}/">{s["name"]}</a>' if s.get('slug') else s['name'] for s in g['items'])] for g in groups]
    if any(g['corner'] for g in groups):
        secs.append(dict(id='sec2', tab='코너별', heading=f'{C.md(d)} {cfg["short"]} 코너별로 어디가 나왔나요?',
                         lead='KBS 방송정보에 적힌 코너 순서 그대로입니다.', table=dict(head=['코너', '나온 곳'], rows=gr), paragraphs=[]))
    elif corners:
        secs.append(dict(id='sec2', tab='코너', heading=f'{C.md(d)} {cfg["short"]} 코너는?', lead='KBS 공식 회차 소개의 코너입니다.',
                         table=dict(head=['코너', '내용'], rows=corners), paragraphs=[]))
    if priced:
        secs.append(dict(id='sec2b', tab='가격·영업시간', heading=f'{C.md(d)} {cfg["short"]} 가격·영업시간 나온 곳은?',
                         lead='KBS 제작진이 방송정보에 가격·영업시간·주차를 적은 곳입니다.',
                         table=dict(head=['상호', 'KBS 방송정보 표기'], rows=[[f'<a href="/{s["slug"]}/">{s["name"]}</a>' if s.get('slug') else s['name'], '<br>'.join(f'{k}: {v}' for k, v in s['attrs'])] for s in priced]), paragraphs=[]))
    if story and not corners:
        secs.append(dict(id='sec2c', tab='방송 내용', heading=f'{cfg["name"]} {no}회는 어떤 내용인가요?', lead='KBS 공식 회차 소개입니다.', paragraphs=[html.escape(story[:600])]))
    secs.append(dict(id='sec3', tab='방송 시간', heading=f'{cfg["name"]}는 언제 방송하고 다시보기는 어디서 하나요?',
                     lead=f'{cfg["ch"]} {cfg["name"]}는 {cfg["air"]} 방송합니다(KBS 공식 회차 편성).',
                     paragraphs=[f'{no}회 다시보기는 KBS 공식 홈페이지에서 볼 수 있습니다.'],
                     actions=[dict(kind='kbs', label=f'{no}회 다시보기', url=vod), dict(kind='link', label=f'{cfg["name"]} 공식 홈페이지', url=cfg['home'])]))
    mt = re.search(r' - ([^\]]+)\]', story) if cfg['key'] == 'town' else None
    title_tail = mt.group(1).split()[-1] if mt else ''
    return dict(
        slug=slug, type='place', category='맛집', series=cfg['name'], seriesSlug=cfg['key'], program=cfg['key'],
        title=C.title40([f'{cfg["short"]} {d.month}월 {d.day}일', title_tail, '오늘 방송 맛집', '위치 전화번호', '총정리']),
        name=f'{cfg["name"]} {d.month}월 {d.day}일 {no}회 방송 맛집·장소', shortName=f'{C.md(d)} {cfg["short"]} {no}회', subtitle='',
        channel=f'{cfg["ch"]} {cfg["name"]}', airtime=f'{C.kdate(d)} · {no}회', status='방송 맛집',
        backdrop=img or '', thumb=img or '', badges=[f'{no}회 · {C.md(d)}', f'{len(flat)}곳'],
        facts=[['방송', f'{cfg["ch"]} {cfg["name"]} {no}회'], ['방송일', C.kdate(d)], ['소개된 곳', f'{len(flat)}곳 (KBS 방송정보 기준)']]
              + ([['가격·영업시간 표기', f'{len(priced)}곳']] if priced else []),
        next=None,
        intro=(f'{C.kdate(d)} {cfg["ch"]} {cfg["name"]} {no}회에 나온 곳은 <b>{len(flat)}곳</b>입니다. '
               + ', '.join(f'<b>{s["name"]}</b>' for s in flat[:6]) + ' 등이며, 상호·주소·전화는 KBS 시청자상담실 「방송정보」 그대로입니다.'),
        ctas=[dict(kind='kbs', label=f'{no}회 다시보기', sub=f'KBS 공식 · {C.md(d)} 방송', url=vod),
              dict(kind='link', label='KBS 공식 방송정보 원문', url=post_url)],
        quick=[dict(label=s['name'], url=f'/{s["slug"]}/', kind='map') for s in flat if s.get('slug')][:8],
        links=[], ott=[], sections=secs, cast=[], episodes=[],
        faq=[dict(q='몇 시 방송인가요?', a=f'{cfg["ch"]} {cfg["name"]}는 {cfg["air"]} 방송입니다(KBS 공식 회차 편성).'),
             dict(q='가게 정보 출처는요?', a=f'KBS 시청자상담실 「방송정보」 {C.kdate(d)}자 {cfg["name"]} 취재 연락처입니다.')],
        related=[dict(slug=s['slug'], name=s['name'], desc=f'{C.md(d)} · {s["menu"] or s["corner"]}') for s in flat if s.get('slug')][:6],
        source=f'KBS 시청자상담실 방송정보({C.kdate(d)}) · KBS 공식 회차 데이터({no}회)',
        imageCredit='KBS 공식 회차 이미지' if img else '',
        checkedAt=C.NOW.strftime('%Y-%m-%d'), updatedAt=C.NOW.isoformat(timespec='seconds'),
    )


def run(force=False):
    eps = {p: episodes(cfg['code']) for p, cfg in PROGS.items()}
    for d, no_post in posts():
        if (C.NOW.date() - d).days > C.DAYS:
            continue
        secs = None
        for pname, cfg in PROGS.items():
            ep = eps[pname].get(d)
            if d < cfg['min'] or not ep:
                continue
            no = ep.get('program_sequence_number')
            ep_slug = f'{cfg["key"]}-{no}'
            if not no or (C.exists(ep_slug) and not force):
                continue
            if secs is None:
                secs = sections(no_post)
            if pname not in secs:
                continue
            head, groups = parse(secs[pname])
            flat = []
            for g in groups:
                for it in g['items']:
                    it['corner'] = corner_name(g)[0] or g['region']
                    flat.append(it)
            if not flat:
                print(f'[{cfg["key"]}] {d} 방송정보에 장소 없음 — 건너뜀')
                continue
            vod = cfg['home'] + '/pc' + (ep.get('target_url') or '/index.html')
            img = C.save_img(ep.get('image_w'), ep_slug)
            post_url = f'{IA}/broadcast/{no_post}'
            n = 0
            for it in flat:
                if it['addr']:
                    n += 1
                    it['slug'] = f'{cfg["key"]}-{no}-{n}'
            print(f'[{cfg["key"]}] {d} {no}회 {len(flat)}곳 (가게 페이지 {n})')
            for g in groups:
                for it in g['items']:
                    if it.get('slug'):
                        C.write(shop_page(cfg, d, no, it, g, int(it['slug'].rsplit('-', 1)[1]), flat, ep_slug, vod, img, post_url))
            C.write(episode_page(cfg, d, no, ep, head, groups, flat, vod, img, post_url))
