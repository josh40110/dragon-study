#!/usr/bin/env python3
"""用 Kokoro-82M（Apache-2.0）產生「可愛女聲」的參考音檔，之後給 XTTS-v2 複製。

    python tools/tts/make_reference.py                    # 產生全部候選
    python tools/tts/make_reference.py --voices af_bella  # 只產生一個

模型檔放在 tools/tts/models/（從 HuggingFace 下載，GitHub release 會被限速）：
    kokoro.onnx      量化版模型（86MB）
    <voice>.bin      各語音的 style 向量（510 x 1 x 256 float32）

產出：tools/tts/reference/<voice>.wav（約 12 秒；XTTS 至少需要 6 秒）
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
MODEL_DIR = HERE / "models"
REF_DIR = HERE / "reference"
MODEL_PATH = MODEL_DIR / "kokoro.onnx"
VOICES_NPZ = MODEL_DIR / "voices.npz"

HF_BASE = "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main"
DEFAULT_VOICES = ["af_bella", "af_nicole", "af_heart", "af_sky", "bf_emma"]

# 參考音要有語調起伏，XTTS 才學得到音色與說話個性
REFERENCE_TEXT = (
    "Hello! I am your little dragon study buddy. "
    "Today we are learning Czech and English together. "
    "Are you ready? Let's start with something simple. "
    "Repeat after me, and remember to have fun!"
)


def fetch(url: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 0:
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"  下載 {dest.name} …")
    subprocess.run(["curl", "-sL", url, "-o", str(dest)], check=True)


def build_voices_npz(voices: list[str]) -> None:
    """把各自獨立的 .bin style 向量打包成 kokoro-onnx 需要的 npz。"""
    data = {}
    for name in voices:
        bin_path = MODEL_DIR / f"{name}.bin"
        fetch(f"{HF_BASE}/voices/{name}.bin", bin_path)
        data[name] = np.fromfile(bin_path, dtype=np.float32).reshape(510, 1, 256)
    np.savez(VOICES_NPZ, **data)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--voices", nargs="*", default=DEFAULT_VOICES)
    parser.add_argument("--text", default=REFERENCE_TEXT)
    args = parser.parse_args()

    print("[1/2] 準備 Kokoro 模型")
    fetch(f"{HF_BASE}/onnx/model_q8f16.onnx", MODEL_PATH)
    build_voices_npz(args.voices)

    print("[2/2] 產生參考音檔")
    import onnxruntime as ort  # noqa: PLC0415
    import soundfile as sf  # noqa: PLC0415
    from kokoro_onnx.tokenizer import Tokenizer  # noqa: PLC0415

    # 直接跑 ONNX session：onnx-community 版的輸入名稱與 kokoro-onnx 內建的包裝不同
    session = ort.InferenceSession(str(MODEL_PATH), providers=["CPUExecutionProvider"])
    tokenizer = Tokenizer()
    voices = np.load(VOICES_NPZ)

    phonemes = tokenizer.phonemize(args.text, lang="en-us")
    tokens = tokenizer.tokenize(phonemes)
    if len(tokens) > 508:
        tokens = tokens[:508]
    input_ids = np.array([[0, *tokens, 0]], dtype=np.int64)

    REF_DIR.mkdir(parents=True, exist_ok=True)

    for voice in args.voices:
        try:
            style = voices[voice][len(tokens)].astype(np.float32)  # 依 token 長度挑 style
            audio = session.run(
                None,
                {
                    "input_ids": input_ids,
                    "style": style.reshape(1, -1),
                    "speed": np.array([1.0], dtype=np.float32),
                },
            )[0][0]
        except Exception as err:  # noqa: BLE001
            print(f"  ✗ {voice}：{err}", file=sys.stderr)
            continue
        out = REF_DIR / f"{voice}.wav"
        sf.write(out, audio, 24000)
        print(f"  ✓ {out.name}（{len(audio) / 24000:.1f} 秒）")

    print("\n聽聽看喜歡哪個，再拿它當 generate_audio.py 的 --reference。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
