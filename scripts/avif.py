#!/usr/bin/env python3
"""public/ 아래 JPG·PNG 옆에 같은 이름의 .avif 생성 (화면 표시용). 원본 JPG는 SNS 미리보기(og:image)용으로 유지.
사용: python3 scripts/avif.py         → 아직 커밋 안 된 새 이미지만 변환 (기본)
      python3 scripts/avif.py --all   → public/img·posters 전체 변환
Pillow 11.2+ 필요. 이미 있는 avif는 원본이 더 새것일 때만 다시 만듦."""
import os, sys, subprocess
from PIL import Image
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public')
DIRS = [d for d in ('img', 'posters') if os.path.isdir(os.path.join(ROOT, d))]
MAXW, Q = 1600, 62
done = skip = 0
REPO = os.path.join(ROOT, '..')
NEW = None if '--all' in sys.argv else {os.path.normpath(os.path.join(REPO, x)) for x in subprocess.run(['git', 'ls-files', '--others', '--modified', '--exclude-standard', 'public'], cwd=REPO, capture_output=True, text=True).stdout.split()}
before = after = 0
for d in DIRS:
    for base, _, files in os.walk(os.path.join(ROOT, d)):
        for f in files:
            if not f.lower().endswith(('.jpg', '.jpeg', '.png')):
                continue
            src = os.path.join(base, f)
            if NEW is not None and os.path.normpath(src) not in NEW:
                continue
            dst = os.path.splitext(src)[0] + '.avif'
            if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
                skip += 1
                continue
            im = Image.open(src)
            im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') and f.lower().endswith('.png') else 'RGB')
            if im.width > MAXW:
                im = im.resize((MAXW, round(im.height * MAXW / im.width)), Image.LANCZOS)
            im.save(dst, 'AVIF', quality=Q, speed=6)
            before += os.path.getsize(src); after += os.path.getsize(dst); done += 1
print(f'avif: {done}개 생성, {skip}개 최신 — {before/1048576:.1f}MB → {after/1048576:.1f}MB')
