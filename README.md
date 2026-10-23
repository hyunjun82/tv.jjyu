# tv.jjyu — TVDAY

`tv.jjyu.co.kr` · 드라마·예능 편성·출연진·다시보기 정보. Next.js 정적 내보내기 + Cloudflare Workers (quiz/ticket 과 동일 구조).

## 구조
```
data/programs/<slug>.json  프로그램(또는 예능 기수) 1개 = 파일 1개. type: variety-season | drama
lib/programs.js            JSON → 페이지용 데이터
app/page.js                메인: 히어로 · 이번 주 편성 띠 · 지금 많이 찾는 · 예능 · 드라마
app/[slug]/page.js         프로그램 템플릿 (히어로+OTT 버튼, 탭, 소제목 4개, 출연진 표/그리드, 회차 카드, FAQ)
components/Tabs.js         스크롤 탭 활성화
scripts/verify.mjs         발행 점검
scripts/indexnow-ping.sh   배포 직후 네이버·빙 IndexNow 핑
```
## 규칙
- 타이틀 = 네이버 자동완성 실측 롱테일, 세부 키워드 4개 = 소제목 1~4 순서, 40자 이내.
- 사실은 방송사·OTT 공식 페이지와 보도 기사만. 출연자(일반인) 정보는 방송에서 공개된 범위만. 논란·사생활 없음. 결말 스포일러 없음.
- 이미지는 방송사·OTT 공식 썸네일/스틸만, 출처 표기.
- 큰 버튼 = 공식 OTT/다시보기 딥링크 (전면광고 트리거).
