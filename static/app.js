/* ── Ambient Scribe — Frontend Logic ──────────────────────────────────── */

// ── DOM refs ──────────────────────────────────────────────────────────────
const $ = (s) => document.getElementById(s);
const modelSelect   = $("model-select");
const refreshModels = $("refresh-models");
const modelHint     = $("model-hint");
const startBtn      = $("start-btn");
const stopBtn       = $("stop-btn");
const goBtn         = $("go-btn");
const timerEl       = $("timer");
const recDot        = $("rec-dot");
const recLabel      = $("rec-label");
const waveformEl    = $("waveform");
const audioUpload   = $("audio-upload");
const uploadName    = $("upload-name");
const transcriptBody = $("transcript-body");
const transcriptFoot = $("transcript-foot");
const copyTranscript = $("copy-transcript");
const regenBtn       = $("regen-btn");
const soapEmpty      = $("soap-empty");
const soapSections   = $("soap-sections");
const soapFoot       = $("soap-foot");
const soapInfo       = $("soap-info");
const copySoap       = $("copy-soap");
const exportTxt      = $("export-txt");
const clearBtn       = $("clear-btn");
const progressEl     = $("progress");
const psTranscribe   = $("ps-transcribe");
const psGenerate     = $("ps-generate");

// ── State ─────────────────────────────────────────────────────────────────
let mediaRecorder = null;
let audioChunks   = [];
let audioBlob     = null;
let timerInterval = null;
let seconds       = 0;
let transcript    = "";
let analyser      = null;
let animFrame     = null;

// ── Init ──────────────────────────────────────────────────────────────────
loadModels();

// ── Models ────────────────────────────────────────────────────────────────
async function loadModels() {
  modelHint.textContent = "";
  try {
    const r = await fetch("/api/models");
    const d = await r.json();
    modelSelect.innerHTML = "";
    if (d.error) {
      modelHint.textContent = d.error;
      modelSelect.innerHTML = '<option disabled selected>No models</option>';
      return;
    }
    if (!d.models.length) {
      modelSelect.innerHTML = '<option disabled selected>No models installed</option>';
      modelHint.textContent = "Pull a model: ollama pull llama3";
      return;
    }
    d.models.forEach((m, i) => {
      const o = document.createElement("option");
      o.value = m; o.textContent = m;
      if (i === 0) o.selected = true;
      modelSelect.appendChild(o);
    });
    modelHint.textContent = `${d.models.length} model(s) available`;
  } catch {
    modelSelect.innerHTML = '<option disabled selected>Error</option>';
    modelHint.textContent = "Could not connect to server";
  }
}
refreshModels.addEventListener("click", loadModels);

// ── Recording ─────────────────────────────────────────────────────────────
startBtn.addEventListener("click", startRecording);
stopBtn.addEventListener("click", stopRecording);

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    audioBlob = null;

    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || "audio/webm" });
      stream.getTracks().forEach((t) => t.stop());
      goBtn.disabled = false;
      uploadName.textContent = "";
      cancelAnimationFrame(animFrame);
      drawIdle();
    };

    mediaRecorder.start();
    startBtn.disabled = true;
    stopBtn.disabled = false;
    goBtn.disabled = true;
    recDot.classList.add("active");
    recLabel.textContent = "Recording…";
    seconds = 0;
    timerEl.textContent = "00:00";
    timerInterval = setInterval(tickTimer, 1000);

    // Waveform visualiser
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    drawWaveform();

    toast("🎙️ Recording started");
  } catch (err) {
    toast("⚠️ Microphone access denied");
    console.error(err);
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  clearInterval(timerInterval);
  startBtn.disabled = false;
  stopBtn.disabled = true;
  recDot.classList.remove("active");
  recLabel.textContent = "Stopped";
  toast("⏹ Recording stopped — ready to transcribe");
}

function tickTimer() {
  seconds++;
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  timerEl.textContent = `${m}:${s}`;
}

// ── Waveform ──────────────────────────────────────────────────────────────
function drawWaveform() {
  const ctx = waveformEl.getContext("2d");
  const W = waveformEl.width;
  const H = waveformEl.height;
  const bufLen = analyser.frequencyBinCount;
  const data = new Uint8Array(bufLen);

  function render() {
    animFrame = requestAnimationFrame(render);
    analyser.getByteTimeDomainData(data);
    ctx.clearRect(0, 0, W, H);

    ctx.strokeStyle = "#0ea5e9";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const slice = W / bufLen;
    let x = 0;
    for (let i = 0; i < bufLen; i++) {
      const v = data[i] / 128.0;
      const y = (v * H) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += slice;
    }
    ctx.lineTo(W, H / 2);
    ctx.stroke();
  }
  render();
}

function drawIdle() {
  const ctx = waveformEl.getContext("2d");
  ctx.clearRect(0, 0, waveformEl.width, waveformEl.height);
  ctx.strokeStyle = "#1e2d44";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, waveformEl.height / 2);
  ctx.lineTo(waveformEl.width, waveformEl.height / 2);
  ctx.stroke();
}
drawIdle();

// ── File upload ───────────────────────────────────────────────────────────
audioUpload.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  audioBlob = file;
  uploadName.textContent = file.name;
  goBtn.disabled = false;
  toast(`📎 Loaded: ${file.name}`);
});

// ── Transcribe & Generate ─────────────────────────────────────────────────
goBtn.addEventListener("click", runPipeline);
regenBtn.addEventListener("click", () => generateSOAP(transcript));

async function runPipeline() {
  if (!audioBlob) { toast("⚠️ No audio — record or upload first"); return; }

  const model = modelSelect.value;
  if (!model) { toast("⚠️ Select a model first"); return; }

  // Show progress
  progressEl.style.display = "flex";
  soapEmpty.style.display = "none";
  soapSections.style.display = "none";
  soapFoot.style.display = "none";
  setStep("transcribe", "active");
  setStep("generate", "pending");

  goBtn.disabled = true;

  // 1. Transcribe
  try {
    const fd = new FormData();
    fd.append("audio", audioBlob, "recording.webm");
    const r = await fetch("/api/transcribe", { method: "POST", body: fd });
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    transcript = d.transcript;
    transcriptBody.innerHTML = `<p>${escHtml(transcript)}</p>`;
    transcriptFoot.style.display = "block";
    copyTranscript.disabled = false;
    setStep("transcribe", "done");
    toast("✅ Transcription complete");
  } catch (err) {
    setStep("transcribe", "error");
    toast(`❌ Transcription failed: ${err.message}`);
    goBtn.disabled = false;
    return;
  }

  // 2. Generate SOAP
  await generateSOAP(transcript);
}

async function generateSOAP(text) {
  const model = modelSelect.value;
  if (!text || !model) return;

  progressEl.style.display = "flex";
  soapEmpty.style.display = "none";
  soapSections.style.display = "none";
  soapFoot.style.display = "none";
  setStep("generate", "active");

  try {
    const r = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: text, model }),
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error);

    // Populate sections
    $("c-s").textContent = d.sections.s || "—";
    $("c-o").textContent = d.sections.o || "—";
    $("c-a").textContent = d.sections.a || "—";
    $("c-p").textContent = d.sections.p || "—";

    progressEl.style.display = "none";
    soapSections.style.display = "flex";
    soapFoot.style.display = "flex";
    soapInfo.textContent = `Generated with ${model}`;
    copySoap.disabled = false;
    exportTxt.disabled = false;
    setStep("generate", "done");
    toast("✅ SOAP note generated");
  } catch (err) {
    setStep("generate", "error");
    toast(`❌ Generation failed: ${err.message}`);
  }

  goBtn.disabled = false;
}

function setStep(name, state) {
  const dot = document.querySelector(`#ps-${name} .pdot`);
  dot.className = "pdot";
  if (state !== "pending") dot.classList.add(state);
}

// ── Copy / Export ─────────────────────────────────────────────────────────
copyTranscript.addEventListener("click", () => {
  navigator.clipboard.writeText(transcript);
  toast("📋 Transcript copied");
});

copySoap.addEventListener("click", () => {
  const text = buildSOAPText();
  navigator.clipboard.writeText(text);
  toast("📋 SOAP note copied");
});

exportTxt.addEventListener("click", () => {
  const text = `AMBIENT SCRIBE — SOAP NOTE\n${"=".repeat(40)}\nDate: ${new Date().toLocaleString()}\nModel: ${modelSelect.value}\n\n${buildSOAPText()}\n\n${"=".repeat(40)}\nTRANSCRIPT:\n${transcript}`;
  const blob = new Blob([text], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `soap-note-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("💾 File downloaded");
});

clearBtn.addEventListener("click", () => {
  transcript = "";
  audioBlob = null;
  transcriptBody.innerHTML = '<p class="muted">Transcription will appear here after recording…</p>';
  transcriptFoot.style.display = "none";
  copyTranscript.disabled = true;
  soapSections.style.display = "none";
  soapFoot.style.display = "none";
  soapEmpty.style.display = "flex";
  progressEl.style.display = "none";
  copySoap.disabled = true;
  exportTxt.disabled = true;
  goBtn.disabled = true;
  recLabel.textContent = "Ready";
  timerEl.textContent = "00:00";
  seconds = 0;
  uploadName.textContent = "";
  toast("🗑 All cleared");
});

function buildSOAPText() {
  return `SUBJECTIVE:\n${$("c-s").textContent}\n\nOBJECTIVE:\n${$("c-o").textContent}\n\nASSESSMENT:\n${$("c-a").textContent}\n\nPLAN:\n${$("c-p").textContent}`;
}

// ── Utils ─────────────────────────────────────────────────────────────────
function escHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

let toastTimer;
function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3000);
}
