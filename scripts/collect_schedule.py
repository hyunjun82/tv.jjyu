#!/usr/bin/env python3
"""방송 맛집 6개 프로그램의 공식 편성표(오늘 포함 7일)를 data/schedule.json 으로 저장한다.
- KBS: static.api.kbs.co.kr mediafactory 주간 편성(본방/재방 구분 포함)
- SBS: static.cloud.sbs.co.kr/schedule/YYYY/MM/DD/SBS.json (SBS 편성표 페이지가 쓰는 데이터, 재방 구분 없음 → 편성표 제목 그대로)
빌드 직전에 돌린다(커밋하지 않음). 실패하면 파일을 만들지 않고 페이지는 편성표 섹션 없이 나온다.
"""
import json, os, sys, datetime, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data', 'schedule.json')
KST = datetime.timezone(datetime.timedelta(hours=9))
KBS = {'T2014-0844': 'reallive', 'T2000-0093': 'sixhour', 'T2018-0429': 'town', 'T2010-1657': 'table'}
KBS_CH = {'11': 'KBS 1TV', '12': 'KBS 2TV'}
SBS = ('today3', 'lifemaster')


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    return json.loads(urllib.request.urlopen(req, timeout=20).read().decode('utf-8'))


def real(day, hhmm):
    """편성표의 '2550' 같은 심야 표기를 실제 날짜·시각으로 바꾼다."""
    h, m = int(hhmm[:2]), int(hhmm[2:4])
    d = day + datetime.timedelta(days=h // 24)
    return d.isoformat(), f'{h % 24:02d}:{m:02d}', h >= 24


def main():
    today = datetime.datetime.now(KST).date()
    end = today + datetime.timedelta(days=6)  # KBS 주간 API는 7일 범위까지만 받는다
    items = {k: [] for k in list(KBS.values()) + list(SBS)}
    u = ('https://static.api.kbs.co.kr/mediafactory/v1/schedule/weekly?rtype=json&local_station_code=00&channel_code=11,12'
         f'&program_planned_date_from={today:%Y%m%d}&program_planned_date_to={end:%Y%m%d}')
    for day in get(u):
        for x in day.get('schedules', []):
            key = KBS.get(x.get('program_code'))
            if not key:
                continue
            d0 = datetime.datetime.strptime(x['program_planned_date'], '%Y%m%d').date()
            date, start, late = real(d0, x['program_planned_start_time'])
            _, endt, _ = real(d0, x['program_planned_end_time'])
            items[key].append(dict(date=date, start=start, end=endt, late=late, ch=KBS_CH.get(day['channel_code'], 'KBS'),
                                   kind=x.get('rerun_classification') or '', label=x.get('programming_table_title') or x.get('program_title') or ''))
    d = today
    while d <= end:
        try:
            for x in get(f'https://static.cloud.sbs.co.kr/schedule/{d:%Y/%m/%d}/SBS.json'):
                if x.get('programcode') in SBS:
                    date, start, late = real(d, x['start_time'].replace(':', ''))
                    _, endt, _ = real(d, x['end_time'].replace(':', ''))
                    items[x['programcode']].append(dict(date=date, start=start, end=endt, late=late, ch='SBS', kind='', label=x.get('title', '').strip()))
        except Exception as e:  # 아직 올라오지 않은 날짜는 건너뛴다
            print('sbs', d, e, file=sys.stderr)
        d += datetime.timedelta(days=1)
    for k in items:
        items[k].sort(key=lambda r: (r['date'], r['start']))
    json.dump(dict(checkedAt=datetime.datetime.now(KST).strftime('%Y-%m-%d %H:%M'), items=items), open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('schedule', {k: len(v) for k, v in items.items()})


if __name__ == '__main__':
    main()
