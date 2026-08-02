#!/usr/bin/env python3
"""用 XTTS-v2 把 terms.json 裡的所有文字生成語音，捷克文與英文共用同一個聲音。

    # 先試跑 10 筆看音質
    python tools/tts/generate_audio.py --reference tools/tts/reference/af_bella.wav --limit 10

    # 正式跑（可中斷，已存在的檔案會自動略過）
    python tools/tts/generate_audio.py --reference tools/tts/reference/af_bella.wav

    # 只補單字 / 只補句子 / 只補捷克文
    python tools/tts/generate_audio.py --kind term --lang cs ...

產出：public/audio/<id>.m4a ＋ public/audio/manifest.json
XTTS-v2 授權為 Coqui Public Model License（非商用），個人學習使用沒問題。
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
TERMS = HERE / "terms.json"
OUT_DIR = ROOT / "public" / "audio"
MANIFEST = OUT_DIR / "manifest.json"

XTTS_MODEL = "tts_models/multilingual/multi-dataset/xtts_v2"
SAMPLE_RATE = 24000


def write_manifest() -> int:
    ids = sorted(p.stem for p in OUT_DIR.glob("*.m4a"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps({"version": 1, "ids": ids}, ensure_ascii=False), encoding="utf8")
    return len(ids)


def encode(wav_path: Path, out_path: Path) -> None:
    """轉成 AAC/m4a：iPhone Safari 與所有瀏覽器都能播，32kbps 單聲道約 4KB/秒。"""
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-i", str(wav_path),
            "-ac", "1", "-ar", "24000",
            "-c:a", "aac", "-b:a", "32k",
            str(out_path),
        ],
        check=True,
    )


# XTTS 的捷克語數字展開遇到阿拉伯數字會丟 NotImplementedError，
# 這裡只改「唸出來的內容」，app 上顯示的原文不動。
SPOKEN_OVERRIDES = {
    "cs-odjezd-ex": "Odjezd v osm patnáct z nástupiště tři.",
}


def prepare_text(item: dict) -> str:
    """XTTS 對太短的輸入容易出現雜音或亂唸，單字補上句號穩定很多。"""
    clean = SPOKEN_OVERRIDES.get(item["id"], item["text"]).strip()
    if item["kind"] == "term" and not clean.endswith((".", "!", "?", "。")):
        clean = f"{clean}."
    return clean


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reference", required=False, default=str(HERE / "reference" / "af_bella.wav"))
    parser.add_argument("--device", default="cpu", choices=["cpu", "mps", "cuda"])
    parser.add_argument("--limit", type=int, default=0, help="只跑前 N 筆（試音用）")
    parser.add_argument("--kind", default="", choices=["", "term", "sentence"])
    parser.add_argument("--lang", default="", choices=["", "cs", "en"])
    parser.add_argument("--redo", action="store_true", help="重跑已存在的檔案")
    parser.add_argument("--manifest-only", action="store_true", help="只重建 manifest.json")
    parser.add_argument("--temperature", type=float, default=0.65)
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    if args.manifest_only:
        print(f"manifest 已更新，共 {write_manifest()} 個音檔")
        return 0

    reference = Path(args.reference)
    if not reference.exists():
        print(f"找不到參考音檔：{reference}\n請先執行 tools/tts/make_reference.py", file=sys.stderr)
        return 1

    items = json.loads(TERMS.read_text(encoding="utf8"))
    if args.kind:
        items = [i for i in items if i["kind"] == args.kind]
    if args.lang:
        items = [i for i in items if i["lang"] == args.lang]
    if not args.redo:
        items = [i for i in items if not (OUT_DIR / f"{i['id']}.m4a").exists()]
    if args.limit:
        items = items[: args.limit]

    if not items:
        print("沒有需要生成的項目（全部都已存在）")
        print(f"manifest 共 {write_manifest()} 個音檔")
        return 0

    print(f"要生成 {len(items)} 筆，參考音：{reference.name}，裝置：{args.device}")

    os.environ.setdefault("COQUI_TOS_AGREED", "1")  # 同意 CPML 授權（個人非商用）

    import soundfile as sf  # noqa: PLC0415
    import torch  # noqa: PLC0415
    from TTS.api import TTS  # noqa: PLC0415

    # torch 2.6+ 預設 weights_only=True 會擋住 XTTS 的 checkpoint
    _original_load = torch.load

    def _load(*a, **kw):  # noqa: ANN001, ANN202
        kw.setdefault("weights_only", False)
        return _original_load(*a, **kw)

    torch.load = _load

    print("載入 XTTS-v2（第一次會下載約 1.8GB）…")
    tts = TTS(XTTS_MODEL, progress_bar=False).to(args.device)
    model = tts.synthesizer.tts_model

    print("分析參考音色…")
    gpt_cond_latent, speaker_embedding = model.get_conditioning_latents(audio_path=[str(reference)])

    tmp_wav = HERE / ".tmp.wav"
    started = time.time()
    done = 0

    for index, item in enumerate(items, start=1):
        text = prepare_text(item)
        try:
            out = model.inference(
                text,
                item["lang"],
                gpt_cond_latent,
                speaker_embedding,
                temperature=args.temperature,
                enable_text_splitting=False,
            )
            sf.write(tmp_wav, out["wav"], SAMPLE_RATE)
            encode(tmp_wav, OUT_DIR / f"{item['id']}.m4a")
            done += 1
        except Exception as err:  # noqa: BLE001
            print(f"  ✗ {item['id']}：{err}", file=sys.stderr)
            continue

        if index % 10 == 0 or index == len(items):
            elapsed = time.time() - started
            rate = elapsed / index
            left = (len(items) - index) * rate
            print(
                f"  {index}/{len(items)}　{item['lang']} {item['text'][:28]}"
                f"　（{rate:.2f} 秒/筆，預估剩 {left / 60:.0f} 分）"
            )

    tmp_wav.unlink(missing_ok=True)
    total = write_manifest()
    print(f"\n完成 {done} 筆，public/audio 現在共 {total} 個音檔（manifest 已更新）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
