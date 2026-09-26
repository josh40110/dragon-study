#!/usr/bin/env python3
"""
龍龍旅行社：替每個地點找候選照片，拼成有編號的縮圖總覽，讓人挑出最好看的。

  tools/tts/.venv/bin/python tools/trip/photo_candidates.py OUT_DIR NAMES_JSON [--only=id1,id2] [--queries=補搜.json]

- 關鍵字在 photo_queries.json（冬天／聖誕／夜景優先）；第一輪挑不到好圖的，另寫一份關鍵字用 --queries 補搜
- 先找 Commons 社群認證的「優質圖片」（QualityImage），再補一般照片
- 只留 JPEG、寬 1200px 以上、橫式、自由授權的；每個地點最多 10 張
產出：OUT_DIR/candidates.json、OUT_DIR/sheets/sheet-XX.png（每張 3 個地點）
挑好的檔名寫進 photo_picks.json，再跑 build_photos.py。
比較方便的做法是開本機選圖頁（node tools/trip/photo_picker.mjs），同樣的篩選規則，點一點就寫進 photo_picks.json。
"""
import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from PIL import Image, ImageDraw, ImageFont, ImageOps

UA = 'DragonStudyTrip/1.0 (https://github.com/josh40110/dragon-study)'
API = 'https://commons.wikimedia.org/w/api.php'
HERE = os.path.dirname(os.path.abspath(__file__))
MAX_CANDIDATES = 10
THUMB_W, THUMB_H, GAP, COLS = 300, 190, 8, 5
FONT = '/System/Library/Fonts/STHeiti Medium.ttc'


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=40) as res:
                return res.read()
        except Exception:  # noqa: BLE001 — 網路偶發錯誤就重試
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f'下載失敗：{url}')


def api(**params):
    return json.loads(get(API + '?' + urllib.parse.urlencode({**params, 'format': 'json'})))


def strip_html(text):
    text = re.sub(r'<[^>]+>', ' ', text or '')
    text = text.replace('&amp;', '&').replace('&quot;', '"').replace('&#039;', "'").replace('&nbsp;', ' ')
    return re.sub(r'\s+', ' ', text).strip()[:80]


def search(query, limit):
    data = api(action='query', list='search', srnamespace=6, srlimit=limit, srsearch=query)
    return [hit['title'] for hit in data.get('query', {}).get('search', [])]


def image_info(titles):
    out = {}
    for i in range(0, len(titles), 40):
        data = api(action='query', titles='|'.join(titles[i:i + 40]), prop='imageinfo',
                   iiprop='url|size|mime|extmetadata', iiurlwidth=330)
        for page in data.get('query', {}).get('pages', {}).values():
            info = (page.get('imageinfo') or [None])[0]
            if info:
                out[page['title']] = info
    return out


def candidates_for(queries):
    quality, plain = [], []
    for query in queries:
        quality += search(f'{query} hastemplate:QualityImage', 8)
        plain += search(query, 10)
        time.sleep(0.05)
    quality_set = set(quality)
    ordered = list(dict.fromkeys(quality + plain))
    infos = image_info(ordered[:70])
    picked = []
    for title in ordered:
        info = infos.get(title)
        if not info or info.get('mime') != 'image/jpeg':
            continue
        w, h = info['width'], info['height']
        if w < 1200 or w < h * 1.1:
            continue
        meta = info.get('extmetadata', {})
        license_name = strip_html(meta.get('LicenseShortName', {}).get('value'))
        if not license_name or meta.get('NonFree') or re.search('fair use|non-free', license_name, re.I):
            continue
        picked.append({
            'title': title,
            'thumb': info['thumburl'],
            'w': w,
            'h': h,
            'license': license_name,
            'author': strip_html(meta.get('Artist', {}).get('value')) or '不詳',
            'url': info['descriptionurl'],
            'quality': title in quality_set,
        })
        if len(picked) >= MAX_CANDIDATES:
            break
    return picked


def draw_block(sheet, draw, y, item_id, name, cands, fonts, thumbs):
    draw.text((GAP, y + 4), f'{item_id}  {name}', fill=(40, 30, 20), font=fonts['title'])
    y += 36
    for i, cand in enumerate(cands):
        row, col = divmod(i, COLS)
        x = GAP + col * (THUMB_W + GAP)
        top = y + row * (THUMB_H + 26)
        try:
            img = Image.open(io.BytesIO(thumbs[cand['thumb']])).convert('RGB')
            img = ImageOps.fit(img, (THUMB_W, THUMB_H))
            sheet.paste(img, (x, top))
        except Exception:  # noqa: BLE001
            draw.rectangle([x, top, x + THUMB_W, top + THUMB_H], fill=(220, 200, 200))
        tag = f"#{i}  {'★Q ' if cand['quality'] else ''}{cand['w']}×{cand['h']}"
        draw.text((x + 2, top + THUMB_H + 2), tag, fill=(20, 20, 20), font=fonts['label'])


def main():
    out_dir, names_path = sys.argv[1], sys.argv[2]
    only = next((a.split('=', 1)[1].split(',') for a in sys.argv[3:] if a.startswith('--only=')), None)
    query_path = next((a.split('=', 1)[1] for a in sys.argv[3:] if a.startswith('--queries=')),
                      os.path.join(HERE, 'photo_queries.json'))
    names = json.load(open(names_path))
    queries = {k: v for k, v in json.load(open(query_path)).items() if not k.startswith('_')}
    os.makedirs(os.path.join(out_dir, 'sheets'), exist_ok=True)
    cand_path = os.path.join(out_dir, 'candidates.json')
    all_cands = json.load(open(cand_path)) if os.path.exists(cand_path) else {}

    ids = [i for i in queries if not only or i in only]
    # 已經找過的跳過（要重找就用 --only 指定，或刪掉 candidates.json）
    todo = [i for i in ids if only or i not in all_cands]

    def work(item_id):
        return item_id, candidates_for(queries[item_id])

    # Commons API 請求量不大，4 條並行就好，不要對公益服務太兇
    with ThreadPoolExecutor(max_workers=4) as pool:
        for item_id, cands in pool.map(work, todo):
            all_cands[item_id] = cands
            print(f"✓ {item_id} {len(cands)} 張", flush=True)
            json.dump(all_cands, open(cand_path, 'w'), ensure_ascii=False, indent=1)

    # 縮圖先並行下載好，拼圖時直接用
    thumbs = {}

    def fetch(url):
        try:
            return url, get(url)
        except Exception:  # noqa: BLE001
            return url, None

    urls = [c['thumb'] for item_id in ids for c in all_cands[item_id]]
    with ThreadPoolExecutor(max_workers=8) as pool:
        for url, data in pool.map(fetch, urls):
            thumbs[url] = data

    fonts = {'title': ImageFont.truetype(FONT, 22), 'label': ImageFont.truetype(FONT, 15)}
    block_h = 36 + 2 * (THUMB_H + 26) + 10
    width = COLS * (THUMB_W + GAP) + GAP
    for s in range(0, len(ids), 3):
        group = ids[s:s + 3]
        sheet = Image.new('RGB', (width, block_h * len(group)), (255, 255, 255))
        draw = ImageDraw.Draw(sheet)
        for j, item_id in enumerate(group):
            draw_block(sheet, draw, j * block_h, item_id, names.get(item_id, ''), all_cands[item_id], fonts, thumbs)
        sheet.save(os.path.join(out_dir, 'sheets', f'sheet-{s // 3:02d}.png'))
        print(f'sheet-{s // 3:02d}: {", ".join(group)}', flush=True)


if __name__ == '__main__':
    main()
