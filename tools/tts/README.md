# 語音音檔生成

用開源模型幫「龍龍語言教室」的每個單字與句子產生真人感語音，
捷克文與英文**共用同一個可愛女聲**。生成好的音檔放在 `public/audio/`，
網頁載入時優先播放音檔，找不到才退回系統語音。

| 用途 | 模型 | 授權 |
|---|---|---|
| 產生「可愛女聲」參考音 | [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M)（`af_bella` 等） | Apache-2.0 |
| 複製該聲音講捷克文／英文 | [XTTS-v2](https://huggingface.co/coqui/XTTS-v2) | Coqui CPML（非商用，個人學習可） |

## 一次性設定

```bash
uv venv tools/tts/.venv --python 3.11
uv pip install --python tools/tts/.venv/bin/python coqui-tts kokoro-onnx soundfile
```

`ffmpeg` 需要另外安裝（`brew install ffmpeg`），用來把 wav 壓成 m4a。

## 流程

```bash
# 1. 從 app 的資料檔匯出所有要發音的文字（改了單字或課程後要重跑）
node tools/tts/export_terms.mjs

# 2. 產生候選參考音，聽聽看喜歡哪個
tools/tts/.venv/bin/python tools/tts/make_reference.py
open tools/tts/reference

# 3. 先試跑 10 筆確認音質
tools/tts/.venv/bin/python tools/tts/generate_audio.py \
  --reference tools/tts/reference/af_bella.wav --limit 10

# 4. 滿意後跑全部（可隨時 Ctrl-C 中斷，重跑會自動接續）
tools/tts/.venv/bin/python tools/tts/generate_audio.py \
  --reference tools/tts/reference/af_bella.wav
```

常用選項：

- `--kind term` / `--kind sentence`：只生成單字或只生成句子
- `--lang cs` / `--lang en`：只生成單一語言
- `--redo`：重跑已存在的檔案（換聲音時用）
- `--device mps`：試試 Apple GPU（不穩就用預設的 cpu）
- `--manifest-only`：只重建 `public/audio/manifest.json`

## 之後新增單字時

```bash
node tools/tts/export_terms.mjs
tools/tts/.venv/bin/python tools/tts/generate_audio.py --reference tools/tts/reference/af_bella.wav
```

只有新的項目會被生成，舊音檔不動。

## 換一個聲音

把 `--reference` 換成別的 wav（例如自己錄的 10 秒），加上 `--redo` 重跑全部即可。
