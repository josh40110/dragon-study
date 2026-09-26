#!/usr/bin/env python3
"""
龍龍旅行社：把 photo_picks.json 挑好的照片做成網站用的 WebP，作者／授權一起寫進 src/constants/tripPhotos.json。

  tools/tts/.venv/bin/python tools/trip/build_photos.py            # 只處理還沒做過的照片
  tools/tts/.venv/bin/python tools/trip/build_photos.py --force    # 全部重新轉檔（原圖有快取就不重新下載）

- 每張照片做兩個尺寸：大圖（寬 1400，詳細介紹、放大看）、小圖（寬 640，清單、卡片、相簿縮圖）
  寬 1600／品質 80 時 373 張要 110 MB，太肥；1400／75 在介紹欄的顯示尺寸下看不出差別
- 下載的原圖快取在 ~/.cache/dragon-study/trip-photos，調整尺寸或品質重跑 --force 不用再下載
- 檔名是 Commons 檔名的雜湊；同一張照片被兩個地點用到只存一份
- 只收自由授權（CC BY／BY-SA／CC0／公有領域）；NC、ND 這類會停下來要求換照片
- photo_picks.json 每張可以寫成檔名字串，或 {"file": 檔名, "note": "示意"}（照片不是那個地方本身）
- public/trip/photos 裡沒被用到的舊檔會刪掉，資料夾跟 photo_picks.json 保持一致
挑照片的流程：photo_candidates.py 產候選縮圖總覽 → 人工挑 → 寫進 photo_picks.json → 跑這支。
"""
import hashlib
import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from PIL import Image, ImageOps

UA = 'DragonStudyTrip/1.0 (https://github.com/josh40110/dragon-study)'
API = 'https://commons.wikimedia.org/w/api.php'
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
PHOTO_DIR = os.path.join(ROOT, 'public', 'trip', 'photos')
OUT_JSON = os.path.join(ROOT, 'src', 'constants', 'tripPhotos.json')
# Commons 的標準縮圖寬度（非標準寬度容易被限流），下載後再自己縮
FETCH_WIDTH = 1920
SIZES = {'large': (1400, 75), 'thumb': (640, 70)}  # 寬度、WebP 品質
CACHE_DIR = os.path.expanduser('~/.cache/dragon-study/trip-photos')
BAD_LICENSE = re.compile(r'\bNC\b|\bND\b|non-?commercial|no ?derivatives|fair use|non-free', re.I)


def get(url, tries=6):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=60) as res:
                return res.read()
        except urllib.error.HTTPError as err:
            # 429 是太快了，多等一下；其他錯誤稍等重試
            time.sleep((8 if err.code == 429 else 2) * (attempt + 1))
        except Exception:  # noqa: BLE001 — 網路偶發錯誤就重試
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f'下載失敗：{url}')


def strip_html(text):
    text = re.sub(r'<[^>]+>', ' ', text or '')
    text = text.replace('&amp;', '&').replace('&quot;', '"').replace('&#039;', "'").replace('&#39;', "'").replace('&nbsp;', ' ')
    return re.sub(r'\s+', ' ', text).strip()


def image_info(titles):
    out = {}
    for i in range(0, len(titles), 40):
        query = urllib.parse.urlencode({
            'action': 'query', 'titles': '|'.join(titles[i:i + 40]), 'prop': 'imageinfo',
            'iiprop': 'url|size|mime|extmetadata', 'iiurlwidth': FETCH_WIDTH, 'format': 'json',
        })
        data = json.loads(get(f'{API}?{query}'))
        # API 會把檔名正規化（底線、大小寫），對回原本寫的名字
        alias = {n['to']: n['from'] for n in data.get('query', {}).get('normalized', [])}
        for page in data.get('query', {}).get('pages', {}).values():
            info = (page.get('imageinfo') or [None])[0]
            if info:
                out[alias.get(page['title'], page['title'])] = info
    return out


def slug(title):
    return hashlib.sha1(title.encode('utf-8')).hexdigest()[:12]


def paths(name):
    return {size: os.path.join(PHOTO_DIR, *([] if size == 'large' else ['t']), f'{name}.webp') for size in SIZES}


def render(raw, name):
    img = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert('RGB')
    for size, (width, quality) in SIZES.items():
        out = img if img.width <= width else img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
        out.save(paths(name)[size], 'WEBP', quality=quality, method=6)
    return img.width, img.height


def main():
    force = '--force' in sys.argv[1:]
    raw_picks = json.load(open(os.path.join(HERE, 'photo_picks.json')))
    picks = {
        k: [p if isinstance(p, dict) else {'file': p} for p in v]
        for k, v in raw_picks.items() if not k.startswith('_')
    }
    titles = list(dict.fromkeys(p['file'] for photos in picks.values() for p in photos))
    os.makedirs(os.path.join(PHOTO_DIR, 't'), exist_ok=True)
    os.makedirs(CACHE_DIR, exist_ok=True)

    infos = image_info(titles)
    missing = [t for t in titles if t not in infos]
    if missing:
        sys.exit('Commons 找不到這些檔案（改名或被刪了？）：\n  ' + '\n  '.join(missing))

    credits, problems = {}, []
    for title in titles:
        meta = infos[title].get('extmetadata', {})
        license_name = strip_html(meta.get('LicenseShortName', {}).get('value'))
        if not license_name or meta.get('NonFree', {}).get('value') or BAD_LICENSE.search(license_name):
            problems.append(f'{title}（{license_name or "沒有授權資訊"}）')
        author = strip_html(meta.get('Artist', {}).get('value')) or '不詳'
        credits[title] = {'author': author[:80], 'license': license_name, 'url': infos[title]['descriptionurl']}
    if problems:
        sys.exit('這些照片的授權不能用，請在 photo_picks.json 換掉：\n  ' + '\n  '.join(problems))

    old = {}
    if os.path.exists(OUT_JSON) and not force:
        for photos in json.load(open(OUT_JSON)).values():
            for photo in photos:
                old[photo['title']] = photo

    def work(title):
        name = slug(title)
        done = all(os.path.exists(p) for p in paths(name).values())
        if done and not force and title in old:
            return title, old[title]['w'], old[title]['h'], False
        info = infos[title]
        cached = os.path.join(CACHE_DIR, f'{name}.orig')
        if os.path.exists(cached):
            raw = open(cached, 'rb').read()
        else:
            raw = get(info.get('thumburl') or info['url'])
            with open(cached, 'wb') as f:
                f.write(raw)
        w, h = render(raw, name)
        return title, w, h, True

    sizes = {}
    # upload.wikimedia.org 對大量下載很敏感，3 條並行就好
    with ThreadPoolExecutor(max_workers=3) as pool:
        for n, (title, w, h, fetched) in enumerate(pool.map(work, titles), 1):
            sizes[title] = (w, h)
            if fetched:
                print(f'[{n}/{len(titles)}] {title}', flush=True)

    out = {}
    for item_id in sorted(picks):
        out[item_id] = []
        for pick in picks[item_id]:
            title = pick['file']
            name = slug(title)
            w, h = sizes[title]
            photo = {
                'title': title,
                'src': f'trip/photos/{name}.webp',
                'thumb': f'trip/photos/t/{name}.webp',
                'w': w,
                'h': h,
                'credit': credits[title],
            }
            if pick.get('note'):
                photo['note'] = pick['note']
            out[item_id].append(photo)
    with open(OUT_JSON, 'w') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')

    keep = {os.path.basename(p) for t in titles for p in paths(slug(t)).values()}
    removed = 0
    for folder in (PHOTO_DIR, os.path.join(PHOTO_DIR, 't')):
        for fname in os.listdir(folder):
            if fname.endswith('.webp') and fname not in keep:
                os.remove(os.path.join(folder, fname))
                removed += 1
    total = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(PHOTO_DIR) for f in fs)
    print(f'完成：{len(picks)} 個地點、{len(titles)} 張照片，刪掉舊檔 {removed} 個，資料夾共 {total / 1e6:.1f} MB')


if __name__ == '__main__':
    main()
