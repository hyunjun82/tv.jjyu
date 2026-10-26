#!/usr/bin/env python3
"""방송 맛집·가게 자동 수집 → data/programs/*.json (GitHub Actions deploy.yml 에서 빌드 전에 실행)

공식 출처만 쓴다. 추측·창작 문장 없음 — 모든 문장은 공식 데이터 값을 끼워 넣은 정형 문장이다.
  1) SBS 생방송 투데이   : 방송정보 게시판(today3_bd01) 상호·주소·연락처 + 공식 다시보기(회차 번호·제목·이미지)
  2) SBS 생활의 달인     : 방송정보 게시판(lifemaster_bd01) '방송협조' 가게명·주소·전화 + 공식 다시보기
                           (달인 개인 이름·나이 등 '달인 프로필'은 일반인 개인정보라 쓰지 않는다)
  3) KBS 2TV 생생정보    : KBS 공식 회차 데이터(코너 제목·회차·방송일·다시보기). 가게 상호·주소는 KBS 공식 출처에 없어 넣지 않는다.

이미 만든 페이지(같은 slug 파일)는 건드리지 않는다. 사용: python3 scripts/collect_shows.py [--days 7]
"""
import json, os, re, sys, html, urllib.request, urllib.parse, datetime

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
DATA = os.path.join(ROOT, 'data', 'programs')
IMG = os.path.join(ROOT, 'public', 'img')
KST = datetime.timezone(datetime.timedelta(hours=9))
NOW = datetime.datetime.now(KST)
DAYS = int(sys.argv[sys.argv.index('--days') + 1]) if '--days' in sys.argv else 7
UA = {'User-Agent': 'TVDAY-collector/1.0 (+https://tv.jjyu.co.kr)'}
DOW = '월화수목금토일'
# 이 날짜 이전 방송은 수동으로 만든 페이지와 겹치지 않게 건너뛴다.
MIN_DATE = datetime.date(2026, 10, 23)
made = []


def get(url, raw=False):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        b = r.read()
    return b if raw else json.loads(b.decode('utf-8'))


def md(d):  # date -> '10.23'
    return f'{d.month}.{d.day}'


def kdate(d):
    return f'{d.year}.{d.month:02d}.{d.day:02d} ({DOW[d.weekday()]})'


def save_img(url, name):
    """공식 회차 이미지 저장(+가능하면 AVIF). 실패하면 None."""
    if not url:
        return None
    url = url.replace('http://', 'https://')
    p = os.path.join(IMG, name + '.jpg')
    if not os.path.exists(p):
        try:
            b = get(url, raw=True)
            os.makedirs(IMG, exist_ok=True)
            open(p, 'wb').write(b)
        except Exception as e:
            print('  이미지 실패', url, e)
            return None
        try:
            from PIL import Image
            im = Image.open(p).convert('RGB')
            if im.width > 1280:
                im = im.resize((1280, round(im.height * 1280 / im.width)))
            im.save(p, 'JPEG', quality=85)
            im.save(p[:-4] + '.avif', 'AVIF', quality=62)
        except Exception as e:
            print('  AVIF 생략', e)
    return '/img/' + name + '.jpg'


def text_of(content):
    t = re.sub(r'<br\s*/?>|</p>|</div>|</li>', '\n', content or '', flags=re.I)
    t = html.unescape(re.sub(r'<[^>]+>', '', t)).replace('\xa0', ' ')
    t = re.sub(r'[ \t]+', ' ', t)
    return [x.strip() for x in t.split('\n') if x.strip()]


def tel_href(t):
    d = re.sub(r'[^0-9]', '', t or '')
    return 'tel:' + d if len(d) >= 8 else ''


def title40(parts):
    """앞에서부터 붙이되 40자 넘으면 그 조각은 뺀다."""
    out = ''
    for p in parts:
        cand = (out + ' ' + p).strip() if out else p
        if len(cand) <= 40:
            out = cand
    return out


def write(p):
    fp = os.path.join(DATA, p['slug'] + '.json')
    json.dump(p, open(fp, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    made.append(p['slug'])
    print('  +', p['slug'], p['title'])


def exists(slug):
    return os.path.exists(os.path.join(DATA, slug + '.json'))


# ---------------------------------------------------------------- SBS 공통
SBS = {
    'today3': dict(name='생방송 투데이', short='생방송투데이', board='today3_bd01', menu=54208, vodmenu=54203,
                   programid='S01_V0000338038', path='culture/today3', air='매주 월~금 오후 6시'),
    'lifemaster': dict(name='생활의 달인', short='생활의 달인', board='lifemaster_bd01', menu=55736, vodmenu=55733,
                       programid='S01_V0000305532', path='culture/lifemaster', air='매주 월요일 오후 9시'),
}


def sbs_vods(cfg):
    u = ('https://static.apis.sbs.co.kr/play-api/1.0/sbs_vodalls?offset=0&limit=12&sort=new'
         f'&programid={cfg["programid"]}&absolute_show=Y&mdadiv=01&srsdiv=01')
    out = {}
    for x in get(u).get('list', []):
        d = x.get('broaddate', '')[:10]
        if d and d not in out:
            out[d] = dict(mediaid=x['mediaid'], no=(x.get('content') or {}).get('contentnumber'),
                          title=(x.get('content') or {}).get('contenttitle') or x.get('title', ''),
                          img=(x.get('thumb') or {}).get('large'))
    return out


def sbs_posts(cfg):
    u = f'https://api.board.sbs.co.kr/bbs/V2.0/basic/board/lists?board_code={cfg["board"]}&offset=0&limit=8&action_type=json'
    return get(u).get('list', [])


def sbs_detail(cfg, no):
    u = f'https://api.board.sbs.co.kr/bbs/V2.0/basic/board/detail/{no}?board_code={cfg["board"]}&action_type=json'
    return get(u)['Response_Data_For_Detail']


def parse_today3(lines):
    """'N. 코너 - 제목 편' / '▶상호' / '주소: ' / '연락처: '"""
    shops, corner, topic, cur = [], '', '', None
    for ln in lines:
        m = re.match(r'^\d+\.\s*(.+?)\s*[-–]\s*(.+?)\s*(편)?$', ln)
        if m and not ln.startswith('▶'):
            corner, topic = m.group(1).strip(), m.group(2).strip()
            continue
        if ln.startswith('▶'):
            cur = dict(name=ln.lstrip('▶ ').strip(), corner=corner, topic=topic, addr='', tel='')
            shops.append(cur)
            continue
        if cur and re.match(r'^주소\s*[:：]', ln):
            cur['addr'] = re.sub(r'^주소\s*[:：]\s*', '', ln)
        elif cur and re.match(r'^(연락처|전화|문의)\s*[:：]', ln):
            cur['tel'] = re.sub(r'^(연락처|전화|문의)\s*[:：]\s*', '', ln)
    return [s for s in shops if s['name'] and (s['addr'] or s['tel'])]


def parse_lifemaster(lines):
    """'* 방송협조 *' 아래 'N. 달인 제목' / '상호>' / 주소 / '☎ 전화'. 상호 없는 항목(개인 주소만)은 버린다."""
    if not any('방송협조' in x for x in lines):
        return []
    sec = lines[[i for i, x in enumerate(lines) if '방송협조' in x][0] + 1:]
    shops, title, cur = [], '', None
    for ln in sec:
        if ln.startswith('촬영에 협조'):
            break
        m = re.match(r'^\d+\.\s*(.+)$', ln)
        if m:
            title, cur = m.group(1).strip(), None
            continue
        if ln.endswith('>'):
            cur = dict(name=ln.rstrip('> ').strip(), corner=title, topic=title, addr='', tel='')
            shops.append(cur)
        elif cur and ln.startswith('☎'):
            cur['tel'] = ln.lstrip('☎ ').strip()
        elif cur and not cur['addr'] and re.search(r'(시|도|구|군|동|읍|면|로|길)\s', ln + ' '):
            cur['addr'] = ln
    return [s for s in shops if s['name'] and (s['addr'] or s['tel'])]


def shop_page(key, cfg, d, ep, shop, idx, post_url, ep_slug, siblings):
    slug = f'{key}-{ep["no"]}-{idx}'
    vod = f'https://programs.sbs.co.kr/{cfg["path"]}/vod/{cfg["vodmenu"]}/{ep["mediaid"]}'
    no, name, corner, topic = ep['no'], shop['name'], shop['corner'], shop['topic']
    img = save_img(ep['img'], f'{key}-{no}')
    q = urllib.parse.quote(name + ' ' + ' '.join(shop['addr'].split()[:2]))
    facts = [['상호', name]]
    if shop['tel']: facts.append(['전화', shop['tel']])
    if shop['addr']: facts.append(['주소', shop['addr']])
    facts += [['방송', f'SBS {cfg["name"]} {no}회 ({kdate(d)})'], ['코너', corner if corner == topic else f'{corner} · {topic}']]
    ctas = [dict(kind='sbs', label=f'{no}회 다시보기', sub=f'SBS 공식 · {md(d)} 방송', url=vod),
            dict(kind='map', label='네이버 지도로 보기', url=f'https://map.naver.com/p/search/{q}')]
    if tel_href(shop['tel']):
        ctas.append(dict(kind='tel', label='전화 걸기', sub=shop['tel'], url=tel_href(shop['tel'])))
    info = [x for x in [f'주소는 <b>{shop["addr"]}</b>' if shop['addr'] else '', f'전화는 <b>{shop["tel"]}</b>' if shop['tel'] else ''] if x]
    rows = [[f'<a href="/{s["slug"]}/">{s["name"]}</a>', s['corner'], s['addr'] or '—'] for s in siblings]
    p = dict(
        slug=slug, type='place', category='맛집', series=cfg['name'], seriesSlug=key, program=key,
        title=title40([f'{cfg["short"]} {name}', '위치 전화번호', f'{d.month}월 {d.day}일', topic]),
        name=name, shortName=name, subtitle='', channel=f'SBS {cfg["name"]}',
        airtime=f'{kdate(d)} 방송 · {corner}', status='방송 맛집' if key == 'today3' else '방송 가게',
        backdrop=img or '', thumb=img or '', badges=[f'{no}회 · {md(d)}', corner] + ([topic] if topic != corner else []),
        facts=facts, next=None,
        intro=(f'<b>{name}</b>은(는) {kdate(d)} SBS {cfg["name"]} {no}회 「{corner}」'
               + (f'({topic})' if topic != corner else '') + ' 편에 나온 곳입니다. '
               + ('·'.join(info) + '이며, ' if info else '') + 'SBS 공식 「방송정보」 게시판에 올라온 그대로입니다.'),
        ctas=ctas,
        quick=[dict(label='SBS 공식 방송정보', url=post_url, kind='link'),
               dict(label='카카오맵에서 보기', url=f'https://map.kakao.com/?q={q}', kind='map'),
               dict(label=f'{cfg["name"]} 다시보기 목록', url=f'https://programs.sbs.co.kr/{cfg["path"]}/vods/{cfg["vodmenu"]}', kind='sbs2')],
        links=[], ott=[],
        sections=[
            dict(id='sec1', tab='방송 내용', heading=f'{name}은(는) {cfg["name"]} 어느 편에 나왔나요?',
                 lead=f'{kdate(d)} 방송된 {no}회 「{corner}」 코너입니다. 이날 회차 제목은 「{ep["title"]}」입니다.',
                 paragraphs=[f'SBS는 공식 사이트 「방송정보」 게시판에 그날 나온 곳의 상호·주소·연락처를 올립니다. 이 페이지의 정보는 {kdate(d)}자 게시글 그대로입니다.'],
                 images=([dict(src=img, cap=f'{cfg["name"]} {no}회 (SBS 공식 회차 이미지)', url=vod, kind='sbs', label=f'{no}회 다시보기', wide=True)] if img else []),
                 actions=[dict(kind='sbs', label=f'{no}회 다시보기', url=vod), dict(kind='link', label='SBS 공식 방송정보 원문', url=post_url)]),
            dict(id='sec2', tab='위치·연락처', heading=f'{name} 위치와 전화번호는?',
                 lead=(f'주소: {shop["addr"]}' if shop['addr'] else '주소는 공식 게시글에 없습니다.') + (f' · 전화: {shop["tel"]}' if shop['tel'] else ''),
                 paragraphs=['영업시간·메뉴 가격은 SBS 공식 게시글에 없어 적지 않았습니다. 방문 전 전화로 확인하세요.'],
                 actions=[c for c in ctas if c['kind'] != 'sbs']),
            dict(id='sec3', tab=f'{md(d)} 방송 전체', heading=f'{md(d)} {cfg["name"]}에 나온 곳은 어디인가요?',
                 lead=f'{no}회에 SBS 방송정보로 올라온 곳은 모두 {len(siblings)}곳입니다.',
                 table=dict(head=['상호', '코너', '주소'], rows=rows), paragraphs=[],
                 actions=[dict(kind='link', label=f'{md(d)} 방송 맛집 총정리', url=f'/{ep_slug}/')]),
        ],
        cast=[], episodes=[],
        faq=[dict(q='몇 시 방송인가요?', a=f'SBS {cfg["name"]}는 {cfg["air"]} 방송입니다(SBS 공식 프로그램 정보).'),
             dict(q='다시보기는 어디서 하나요?', a=f'SBS 공식 다시보기에서 {no}회를 볼 수 있습니다. 위 「{no}회 다시보기」 버튼으로 이동합니다.'),
             dict(q='주소와 전화번호 출처는요?', a=f'SBS {cfg["name"]} 공식 사이트 「방송정보」 게시판의 {kdate(d)}자 게시글입니다.')],
        related=[dict(slug=s['slug'], name=s['name'], desc=f'{md(d)} · {s["corner"]}') for s in siblings if s['slug'] != slug][:6],
        source=f'SBS {cfg["name"]} 공식 방송정보 게시판({kdate(d)}자: 상호·주소·연락처) · SBS 공식 다시보기({no}회 번호·제목·이미지) · 프로그램 정보(편성)',
        imageCredit='SBS 공식 회차 이미지' if img else '',
        checkedAt=NOW.strftime('%Y-%m-%d'), updatedAt=NOW.isoformat(timespec='seconds'),
    )
    return p


def episode_page(key, cfg, d, ep, siblings, post_url):
    no = ep['no']
    slug = f'{key}-{no}'
    vod = f'https://programs.sbs.co.kr/{cfg["path"]}/vod/{cfg["vodmenu"]}/{ep["mediaid"]}'
    img = save_img(ep['img'], f'{key}-{no}')
    rows = [[f'<a href="/{s["slug"]}/">{s["name"]}</a>', s['corner'], s['addr'] or '—', s['tel'] or '—'] for s in siblings]
    word = '맛집' if key == 'today3' else '달인 가게'
    return dict(
        slug=slug, type='place', category='맛집', series=cfg['name'], seriesSlug=key, program=key,
        title=title40([f'{cfg["short"]} {d.month}월 {d.day}일', f'{word} 오늘 방송', '위치 전화번호 총정리']),
        name=f'{cfg["name"]} {d.month}월 {d.day}일 {no}회 방송 {word}', shortName=f'{md(d)} {cfg["name"]} {word}', subtitle='',
        channel=f'SBS {cfg["name"]}', airtime=f'{kdate(d)} 방송 · {no}회', status='방송 맛집' if key == 'today3' else '방송 가게',
        backdrop=img or '', thumb=img or '', badges=[f'{no}회 · {md(d)}', f'{len(siblings)}곳'],
        facts=[['방송', f'SBS {cfg["name"]} {no}회'], ['방송일', kdate(d)], ['회차 제목', ep['title']], ['소개된 곳', f'{len(siblings)}곳 (SBS 방송정보 기준)']],
        next=None,
        intro=f'{kdate(d)} SBS {cfg["name"]} {no}회에 나온 곳은 <b>{len(siblings)}곳</b>입니다. ' + ', '.join(f'<b>{s["name"]}</b>' for s in siblings[:6]) + ' 등이며, 상호·주소·연락처는 SBS 공식 「방송정보」 게시판 그대로입니다.',
        ctas=[dict(kind='sbs', label=f'{no}회 다시보기', sub=f'SBS 공식 · {md(d)} 방송', url=vod), dict(kind='link', label='SBS 공식 방송정보 원문', url=post_url)],
        quick=[dict(label=s['name'], url=f'/{s["slug"]}/', kind='map') for s in siblings[:8]],
        links=[], ott=[],
        sections=[dict(id='sec1', tab='오늘 나온 곳', heading=f'{d.month}월 {d.day}일 {cfg["name"]}에 나온 {word}은 어디인가요?',
                       lead=f'{no}회 「{ep["title"]}」 방송분입니다. 상호를 누르면 가게별 위치·전화 페이지로 이동합니다.',
                       table=dict(head=['상호', '코너', '주소', '전화'], rows=rows), paragraphs=[],
                       images=([dict(src=img, cap=f'{cfg["name"]} {no}회 (SBS 공식 회차 이미지)', url=vod, kind='sbs', label=f'{no}회 다시보기', wide=True)] if img else []),
                       actions=[dict(kind='sbs', label=f'{no}회 다시보기', url=vod)]),
                  dict(id='sec2', tab='코너별', heading=f'{md(d)} {cfg["name"]} 코너별로 어떤 곳이 나왔나요?',
                       lead='SBS 방송정보 게시글의 코너 순서 그대로입니다.',
                       table=dict(head=['코너', '내용', '상호'], rows=[[c, t, ', '.join(f'<a href="/{x["slug"]}/">{x["name"]}</a>' for x in siblings if x['corner'] == c and x['topic'] == t)] for c, t in dict.fromkeys((x['corner'], x['topic']) for x in siblings)]),
                       paragraphs=[]),
                  dict(id='sec3', tab='방송 시간', heading=f'{cfg["name"]}는 언제 방송하고 다시보기는 어디서 하나요?',
                       lead=f'SBS {cfg["name"]}는 {cfg["air"]} 방송합니다(SBS 공식 프로그램 정보).',
                       paragraphs=[f'{no}회 다시보기는 SBS 공식 사이트에서 볼 수 있습니다. 가게별 위치·전화는 위 표의 상호를 누르면 나옵니다.'],
                       actions=[dict(kind='sbs', label=f'{no}회 다시보기', url=vod), dict(kind='sbs2', label=f'{cfg["name"]} 다시보기 목록', url=f'https://programs.sbs.co.kr/{cfg["path"]}/vods/{cfg["vodmenu"]}')])],
        cast=[], episodes=[],
        faq=[dict(q='몇 시 방송인가요?', a=f'SBS {cfg["name"]}는 {cfg["air"]} 방송입니다(SBS 공식 프로그램 정보).'),
             dict(q='가게 정보 출처는요?', a=f'SBS {cfg["name"]} 공식 사이트 「방송정보」 게시판의 {kdate(d)}자 게시글입니다.')],
        related=[dict(slug=s['slug'], name=s['name'], desc=f'{md(d)} · {s["corner"]}') for s in siblings[:6]],
        source=f'SBS {cfg["name"]} 공식 방송정보 게시판({kdate(d)}자) · SBS 공식 다시보기({no}회)',
        imageCredit='SBS 공식 회차 이미지' if img else '',
        checkedAt=NOW.strftime('%Y-%m-%d'), updatedAt=NOW.isoformat(timespec='seconds'),
    )


def run_sbs(key):
    cfg = SBS[key]
    vods = sbs_vods(cfg)
    for post in sbs_posts(cfg):
        reg = datetime.datetime.strptime(post['REG_DATE'][:10], '%Y-%m-%d').date()
        if (NOW.date() - reg).days > DAYS:
            continue
        m = re.search(r'(\d{1,2})월\s*(\d{1,2})일', post['TITLE'])
        d = datetime.date(reg.year, int(m.group(1)), int(m.group(2))) if m else reg
        if d < MIN_DATE:
            continue
        ep = vods.get(d.isoformat())
        if not ep:  # 게시글은 올라왔지만 다시보기 회차가 아직 없음 → 다음 실행 때
            print(f'[{key}] {d} 다시보기 회차 아직 없음 — 건너뜀')
            continue
        ep_slug = f'{key}-{ep["no"]}'
        if exists(ep_slug):
            continue
        det = sbs_detail(cfg, post['NO'])
        lines = text_of(det.get('CONTENT'))
        shops = parse_today3(lines) if key == 'today3' else parse_lifemaster(lines)
        if not shops:
            print(f'[{key}] {d} 가게 정보 없음 — 건너뜀')
            continue
        post_url = f'https://programs.sbs.co.kr/{cfg["path"]}/board/{cfg["menu"]}?cmd=view&page=1&board_no={post["NO"]}'
        for i, s in enumerate(shops, 1):
            s['slug'] = f'{key}-{ep["no"]}-{i}'
        print(f'[{key}] {d} {ep["no"]}회 {len(shops)}곳')
        for i, s in enumerate(shops, 1):
            if not exists(s['slug']):
                write(shop_page(key, cfg, d, ep, s, i, post_url, ep_slug, shops))
        write(episode_page(key, cfg, d, ep, shops, post_url))


# ---------------------------------------------------------------- KBS 생생정보
def run_kbs():
    u = ('https://static.api.kbs.co.kr/mediafactory/v1/contents?rtype=json&sort_option=program_planned_date%7Cdesc'
         '&program_code=T2014-0844&page=1&page_size=8')
    for x in get(u).get('data', []):
        if x.get('rerun_classification') not in (None, '', '01'):
            continue
        ds = x.get('program_planned_date', '')
        try:
            d = datetime.date(int(ds[:4]), int(ds[4:6]), int(ds[6:8]))
        except Exception:
            continue
        if (NOW.date() - d).days > DAYS or d < MIN_DATE:
            continue
        no = x.get('program_sequence_number')
        slug = f'reallive-{no}'
        if not no or exists(slug):
            continue
        corners = [c.strip() for c in (x.get('main_story') or '').split(' / ') if c.strip()]
        if not corners:
            continue
        vod = 'https://program.kbs.co.kr/2tv/culture/reallive/pc' + (x.get('target_url') or '/index.html')
        img = save_img(x.get('image_w'), slug)
        rows = []
        for c in corners:
            m = re.match(r'^\[(.+?)\]\s*(.*)$', c)
            rows.append([m.group(1), m.group(2)] if m else ['', c])
        food = [r for r in rows if re.search(r'맛집|밥|식당|요리|빵|김치|찜|탕|국|면|구이|고기|제철|레시피', ' '.join(r))]
        p = dict(
            slug=slug, type='place', category='맛집', series='2TV 생생정보', seriesSlug='reallive', program='reallive',
            title=title40([f'생생정보 {d.month}월 {d.day}일 오늘 방송', f'{no}회 코너', '다시보기']),
            name=f'2TV 생생정보 {d.month}월 {d.day}일 {no}회 방송 내용', shortName=f'{md(d)} 생생정보 {no}회', subtitle='',
            channel='KBS 2TV 생생정보', airtime=f'{kdate(d)} 오후 6시 35분 · {no}회', status='방송 맛집',
            backdrop=img or '', thumb=img or '', badges=[f'{no}회 · {md(d)}', f'코너 {len(rows)}개'],
            facts=[['방송', f'KBS 2TV 생생정보 {no}회'], ['방송일', f'{kdate(d)} 오후 6시 35분'], ['코너', ' · '.join(r[0] for r in rows if r[0])]],
            next=None,
            intro=(f'{kdate(d)} KBS 2TV 생생정보 {no}회는 ' + ', '.join(f'「{r[0]}」' for r in rows if r[0])
                   + ' 코너로 방송됐습니다. 코너별 내용은 KBS 공식 회차 소개 그대로입니다. 가게 상호·주소는 KBS 공식 회차 정보에 없어 이 페이지에 적지 않았습니다.'),
            ctas=[dict(kind='kbs', label=f'{no}회 다시보기', sub=f'KBS 공식 · {md(d)} 방송', url=vod),
                  dict(kind='link', label='생생정보 공식 홈페이지', url='https://program.kbs.co.kr/2tv/culture/reallive')],
            quick=[dict(label='KBS 생생정보 다시보기 목록', url='https://program.kbs.co.kr/2tv/culture/reallive/pc/list.html?smenu=c2cc5a', kind='link')],
            links=[], ott=[],
            sections=[dict(id='sec1', tab='오늘 코너', heading=f'{d.month}월 {d.day}일 생생정보에는 어떤 코너가 나왔나요?',
                           lead=f'{no}회 코너는 모두 {len(rows)}개입니다(KBS 공식 회차 소개).',
                           table=dict(head=['코너', '내용'], rows=rows), paragraphs=[],
                           images=([dict(src=img, cap=f'2TV 생생정보 {no}회 (KBS 공식 회차 이미지)', url=vod, kind='kbs', label=f'{no}회 다시보기', wide=True)] if img else []),
                           actions=[dict(kind='kbs', label=f'{no}회 다시보기', url=vod)])]
                     + ([dict(id='sec2', tab='음식 코너', heading=f'{md(d)} 생생정보 음식 코너는?',
                              lead='코너 제목에 음식이 나온 코너만 모았습니다.', table=dict(head=['코너', '내용'], rows=food), paragraphs=[])] if food else [])
                     + [dict(id='sec3', tab='방송 시간', heading='생생정보는 언제 방송하고 다시보기는 어디서 하나요?',
                             lead='KBS 2TV 생생정보는 평일 오후 6시 35분 방송합니다(KBS 공식 회차 편성 시각).',
                             paragraphs=[f'{no}회 다시보기는 KBS 공식 홈페이지에서 볼 수 있습니다.'],
                             actions=[dict(kind='kbs', label=f'{no}회 다시보기', url=vod), dict(kind='link', label='KBS 생생정보 다시보기 목록', url='https://program.kbs.co.kr/2tv/culture/reallive/pc/list.html?smenu=c2cc5a')])]
                     + ([] if food else [dict(id='sec4', tab='출처', heading='이 페이지 정보는 어디서 왔나요?', lead='KBS 2TV 생생정보 공식 회차 데이터(코너 제목·방송 시각·다시보기·이미지)입니다.', paragraphs=['가게 상호·주소는 KBS 공식 회차 정보에 없어 적지 않았습니다.'])]),
            cast=[], episodes=[],
            faq=[dict(q='몇 시 방송인가요?', a='KBS 2TV 생생정보는 평일 오후 6시 35분 방송입니다(KBS 공식 회차 편성 시각).'),
                 dict(q='가게 주소는 어디서 보나요?', a='KBS 공식 회차 정보에는 가게 상호·주소가 나오지 않습니다. 정확한 곳은 공식 다시보기 방송 화면에서 확인할 수 있습니다.')],
            related=[], source=f'KBS 2TV 생생정보 공식 회차 데이터({kdate(d)} {no}회: 코너 제목·방송 시각·다시보기·이미지)',
            imageCredit='KBS 공식 회차 이미지' if img else '',
            checkedAt=NOW.strftime('%Y-%m-%d'), updatedAt=NOW.isoformat(timespec='seconds'),
        )
        print(f'[reallive] {d} {no}회 코너 {len(rows)}개')
        write(p)


if __name__ == '__main__':
    for fn, arg in [(run_sbs, 'today3'), (run_sbs, 'lifemaster'), (run_kbs, None)]:
        try:
            fn(arg) if arg else fn()
        except Exception as e:  # 한 출처가 실패해도 나머지는 계속
            print('수집 실패', arg or 'reallive', e)
    print(f'새 페이지 {len(made)}개')
    open(os.path.join(ROOT, '.collect-made'), 'w').write('\n'.join(made))
