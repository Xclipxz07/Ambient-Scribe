# 🏥 Ambient Scribe

**Private AI Medical Documentation for UK Clinics & Care Homes**

Ambient Scribe listens to a doctor-patient consultation, transcribes it using **OpenAI Whisper** (running locally), and generates a structured **SOAP note** using a local LLM via **Ollama**. No data ever leaves the device — HIPAA/GDPR compliant by design.

---

## ✨ Features

- 🎙️ **Live recording** — record consultations directly in the browser
- 📎 **Upload audio** — import pre-recorded `.wav`, `.mp3`, `.m4a`, `.webm` files
- 📝 **Local transcription** — OpenAI Whisper runs 100% on your machine
- 🧠 **SOAP note generation** — structured Subjective/Objective/Assessment/Plan
- 🔄 **Model switching** — choose any locally-installed Ollama model
- ✏️ **Editable notes** — click to edit any SOAP section before exporting
- 📋 **Copy to clipboard** — one-click copy of transcript or SOAP note
- 💾 **Export .txt** — download timestamped clinical notes
- 🔒 **100% local** — zero cloud dependencies, zero data transmission

---

## 🛡️ Privacy & Compliance

| Aspect | Detail |
|---|---|
| **Data storage** | Audio is processed in memory and immediately deleted |
| **Network** | Server binds to `127.0.0.1` only — not accessible from other devices |
| **Cloud calls** | None. Whisper and Ollama both run locally |
| **HIPAA** | Compliant by design — no PHI leaves the device |
| **GDPR** | No data processing, storage, or transmission to third parties |

---

## 📋 Prerequisites

1. **Python 3.10+** — [python.org](https://www.python.org/downloads/)
2. **Ollama** — [ollama.ai](https://ollama.ai)
3. **FFmpeg** — required by Whisper for audio processing
   ```bash
   # macOS
   brew install ffmpeg

   # Ubuntu/Debian
   sudo apt install ffmpeg
   ```

---

## 🚀 Quick Start

```bash
# 1. Clone / navigate to the project
cd "Ambient Scribe"

# 2. Create a virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Pull an Ollama model (if you haven't already)
ollama pull llama3
# or: ollama pull mistral, ollama pull phi3, ollama pull gemma

# 5. Start Ollama (in a separate terminal)
ollama serve

# 6. Start Ambient Scribe
python app.py
```

Open **http://localhost:5000** in your browser.

---

## 🧠 Recommended Ollama Models

| Model | Size | Speed | Clinical Quality | Best For |
|---|---|---|---|---|
| `llama3` | 4.7 GB | ⚡⚡ | ⭐⭐⭐⭐ | Best overall balance |
| `mistral` | 4.1 GB | ⚡⚡⚡ | ⭐⭐⭐ | Fast, good quality |
| `phi3` | 2.3 GB | ⚡⚡⚡⚡ | ⭐⭐⭐ | Lightweight laptops |
| `gemma` | 5.0 GB | ⚡⚡ | ⭐⭐⭐ | Good alternative |
| `llama3:70b` | 40 GB | ⚡ | ⭐⭐⭐⭐⭐ | Best quality (needs GPU) |

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|---|---|---|
| `WHISPER_MODEL` | `base` | Whisper model size: `base`, `small`, `medium` |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API endpoint |

```bash
# Example: use a more accurate Whisper model
WHISPER_MODEL=small python app.py
```

---

## 📁 Project Structure

```
Ambient Scribe/
├── app.py              # Flask backend (Whisper + Ollama)
├── requirements.txt    # Python dependencies
├── README.md           # This file
├── .gitignore
└── static/
    ├── index.html      # Main UI
    ├── style.css       # Dark clinical design
    └── app.js          # Recording, API, UI logic
```

---

## 🎯 Target Market

- **UK private clinics** — GPs, specialists, physiotherapists
- **Care home managers** — resident assessments, handover notes
- **Any clinician** who wants to stop typing during consultations

---

## 📜 License

MIT — see [LICENSE](LICENSE) for details.
Made with ❤️ by Apex Innovations.
