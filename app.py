"""
Ambient Scribe — Local AI Medical Documentation
Flask backend: Whisper transcription + Ollama SOAP note generation.
All processing is 100% local. No data leaves the device.
"""

import os
import tempfile
import logging

import requests
import whisper
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# ── Config ─────────────────────────────────────────────────────────────────────
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "base")
DEFAULT_MODEL = "llama3"

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ── Flask ──────────────────────────────────────────────────────────────────────
app = Flask(__name__, static_folder="static", static_url_path="/static")
CORS(app)

log.info(f"Loading Whisper model '{WHISPER_MODEL}'…")
whisper_model = whisper.load_model(WHISPER_MODEL)
log.info("Whisper ready ✓")


# ── Routes ─────────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return send_from_directory("static", "index.html")


@app.route("/api/models", methods=["GET"])
def list_models():
    """List locally-installed Ollama models."""
    try:
        r = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        r.raise_for_status()
        names = [m["name"] for m in r.json().get("models", [])]
        return jsonify({"models": names})
    except requests.ConnectionError:
        return jsonify({"models": [], "error": "Ollama not running. Start with: ollama serve"})
    except Exception as e:
        return jsonify({"models": [], "error": str(e)}), 500


@app.route("/api/transcribe", methods=["POST"])
def transcribe():
    """Transcribe uploaded audio via local Whisper."""
    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio = request.files["audio"]
    suffix = ".webm"
    if audio.filename and "." in audio.filename:
        suffix = "." + audio.filename.rsplit(".", 1)[-1]

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        audio.save(tmp.name)
        tmp_path = tmp.name

    try:
        log.info(f"Transcribing {tmp_path}")
        result = whisper_model.transcribe(tmp_path, language="en")
        text = result["text"].strip()
        log.info(f"Done — {len(text)} chars")
        return jsonify({"transcript": text})
    except Exception as e:
        log.error(f"Transcription error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@app.route("/api/generate", methods=["POST"])
def generate_soap():
    """Generate a SOAP note from a transcript using Ollama."""
    body = request.get_json(force=True)
    transcript = body.get("transcript", "").strip()
    model = body.get("model", DEFAULT_MODEL)

    if not transcript:
        return jsonify({"error": "Empty transcript"}), 400

    prompt = f"""You are a clinical documentation assistant for a UK private clinic or care home.
Convert the consultation transcript below into a structured SOAP note.

CRITICAL FORMATTING RULES — follow exactly:
- Output ONLY the four sections below, nothing else.
- Each section heading must appear on its own line, exactly as written (no asterisks, no bold, no parentheses, no numbers).
- Do NOT add a preamble, title, patient name, or date.
- Do NOT fabricate details not present in the transcript.
- Use clear, concise UK clinical language.

TRANSCRIPT:
\"\"\"{transcript}\"\"\"

Subjective:
[Patient's reported symptoms, chief complaint, history, duration, severity]

Objective:
[Examination findings, observations, vitals — only if mentioned in the transcript]

Assessment:
[Diagnosis or differential diagnoses and brief clinical reasoning]

Plan:
[Treatment, medications, investigations, referrals, follow-up, safety-netting advice]
"""

    try:
        log.info(f"Generating SOAP with {model}")
        r = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={"model": model, "prompt": prompt, "stream": False},
            timeout=120,
        )
        r.raise_for_status()
        raw = r.json().get("response", "").strip()
        return jsonify({"soap": raw, "sections": _parse_soap(raw)})
    except requests.ConnectionError:
        return jsonify({"error": "Ollama not running. Start with: ollama serve"}), 503
    except requests.Timeout:
        return jsonify({"error": "Ollama timed out — try a smaller model"}), 504
    except Exception as e:
        log.error(f"Generation error: {e}")
        return jsonify({"error": str(e)}), 500


import re as _re

def _parse_soap(text: str) -> dict:
    """Robustly split raw SOAP text into {s, o, a, p} sections.

    Handles multiple heading styles:
      - Plain:      Subjective:
      - Bold:       **Subjective:**
      - With letter: S (Subjective):
      - Uppercase:  SUBJECTIVE
    """
    sections = {"s": "", "o": "", "a": "", "p": ""}
    # Map keyword → section key
    keyword_map = {
        "subjective": "s",
        "objective":  "o",
        "assessment": "a",
        "plan":       "p",
    }
    # Matches any line whose FIRST meaningful word is a section keyword
    # Strips leading **, S (, numbers, dashes, etc.
    heading_re = _re.compile(
        r"^[\*\s#\-\d\.]*(?:[A-Z]\s*[\(\s])?(?P<kw>subjective|objective|assessment|plan)",
        _re.IGNORECASE,
    )
    current = None
    for line in text.splitlines():
        m = heading_re.match(line.strip())
        if m:
            current = keyword_map[m.group("kw").lower()]
            continue
        if current is not None:
            sections[current] += line + "\n"
    return {k: v.strip() for k, v in sections.items()}


# ── Main ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════════╗
║        Ambient Scribe — Local AI Medical Scribe     ║
║  🔒 All data stays on this device. 100% private.    ║
╚══════════════════════════════════════════════════════╝
  → http://localhost:5001
""")
    app.run(host="127.0.0.1", port=5001, debug=False)
