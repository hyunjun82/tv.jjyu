#!/usr/bin/env bash
# IndexNow 핑 — 배포 직후 공연 페이지 전부를 네이버·빙에 즉시 알린다 (quiz.jjyu 와 동일 방식).
# quiz 실측: 공용 api.indexnow.org 만으로는 네이버가 안 가져간 날이 있어 searchadvisor.naver.com/indexnow 로도 보낸다.
set -u
URLS=$(node -e "
  const fs = require('fs');
  const dir = './data/programs';
  const urls = ['https://tv.jjyu.co.kr/'];
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.json')) urls.push('https://tv.jjyu.co.kr/' + f.replace('.json','') + '/');
  console.log(JSON.stringify(urls));
")
N=$(node -e 'console.log(JSON.parse(process.argv[1]).length)' "$URLS")
cat > /tmp/indexnow-payload.json <<JSON
{
  "host": "tv.jjyu.co.kr",
  "key": "5c9cbf8ae49e43f8990c2a444fe4e8ab",
  "keyLocation": "https://tv.jjyu.co.kr/5c9cbf8ae49e43f8990c2a444fe4e8ab.txt",
  "urlList": $URLS
}
JSON
for EP in "https://api.indexnow.org/indexnow" "https://searchadvisor.naver.com/indexnow"; do
  CODE=$(curl -s -X POST "$EP" -H "Content-Type: application/json; charset=utf-8" \
    --retry 3 --retry-delay 5 --retry-all-errors --connect-timeout 15 --max-time 60 \
    -d @/tmp/indexnow-payload.json -o /dev/null -w "%{http_code}") || CODE="000"
  echo "[indexnow] $EP ${N}개 URL → HTTP $CODE"
done
exit 0
