#!/usr/bin/env python3
"""用 Kokoro-82M（Apache-2.0）產生「可愛女聲」的參考音檔，之後給 XTTS-v2 複製。

    python tools/tts/make_reference.py            # 產生預設三個候選
    python tools/tts/make_reference.py --voices af_bella

產出：tools/tts/reference/<voice>.wav（約 12 秒，XTTS 需要 6 秒以上）
"""

from __future__ import annotations

import argparse
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
MODEL_DIR = HERE / "models"
REF_DIR = HERE / "reference"

MODEL_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx"
VOICES_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin"

# 參考音要有豐富的語調變化，XTTS 才學得到音色與語氣
REFERENCE_TEXT = (
    "Hello! I am your little dragon study buddy. "
    "Today we are learning Czech and English together. "
    "Are you ready? Let's start with something simple. "
    "Repeat after me, and remember to have fun!"
)

DEFAULT_VOICES = ["af_bella", "af_nicole", "af_heart"]


def download(url: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 0:
        print(f"  已存在，略過：{dest.name}")
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"  下載 {dest.name} …")

    def hook(block: int, size: int, total: int) -> None:
        if total > 0:
            done = min(block * size, total)
            sys.stdout.write(f"\r    {done / 1e6:.0f} / {total / 1e6:.0f} MB")
            sys.stdout.flush()

    urllib.request.urlretrieve(url, dest, reporthook=hook)  # noqa: S310
    print()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--voices", nargs="*", default=DEFAULT_VOICES, help="要產生的 Kokoro 語音")
    parser.add_argument("--text", default=REFERENCE_TEXT)
    args = parser.parse_args()

    print("[1/2] 準備 Kokoro 模型")
    model_path = MODEL_DIR / "kokoro-v1.0.onnx"
    voices_path = MODEL_DIR / "voices-v1.0.bin"
    download(MODEL_URL, model_path)
    download(VOICES_URL, voices_path)

    print("[2/2] 產生參考音檔")
    import soundfile as sf  # noqa: PLC0415
    from kokoro_onnx import Kokoro  # noqa: PLC0415

    kokoro = Kokoro(str(model_path), str(voices_path))
    REF_DIR.mkdir(parents=True, exist_ok=True)

    for voice in args.voices:
        samples, sample_rate = kokoro.create(args.text, voice=voice, speed=1.0, lang="en-us")
        out = REF_DIR / f"{voice}.wav"
        sf.write(out, samples, sample_rate)
        seconds = len(samples) / sample_rate
        print(f"  ✓ {out.relative_to(HERE.parent.parent)}（{seconds:.1f} 秒）")

    print("\n聽聽看喜歡哪個，再把它當成 generate_audio.py 的 --reference。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
