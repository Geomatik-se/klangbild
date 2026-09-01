import { AudioEngine } from './audio-engine.js';
import { PALETTES, setPalette } from './palettes.js';

const engine = new AudioEngine();
const stage = document.getElementById('stage');
const hint = document.getElementById('hint');
const media = document.getElementById('media');
const mediaBox = document.getElementById('mediaBox');
const btnMediaShow = document.getElementById('btnMediaShow');
const fileInput = document.getElementById('fileInput');
const kbControls = document.getElementById('klangbildControls');
const kbStatus = document.getElementById('kbStatus');
const btnExport = document.getElementById('btnExport');

// Visualizer werden erst bei Bedarf geladen (Three.js nur für den 3D-Modus).
const loaders = {
  bars: () => import('./visualizers/bars.js').then(m => m.BarsVisualizer),
  particles: () => import('./visualizers/particles.js').then(m => m.ParticlesVisualizer),
  scene3d: () => import('./visualizers/scene3d.js').then(m => m.Scene3DVisualizer),
  notes: () => import('./visualizers/notes.js').then(m => m.NotesVisualizer),
  klangbild: () => import('./visualizers/klangbild.js').then(m => m.KlangbildVisualizer),
};

let current = null;
let currentMode = null;
let currentFile = null;
let mediaURL = null;

async function setMode(mode) {
  if (mode === currentMode) return;
  currentMode = mode;
  document.querySelectorAll('.modes button').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === mode));
  kbControls.hidden = mode !== 'klangbild';

  if (current) {
    current.destroy();
    current = null;
  }
  const Cls = await loaders[mode]();
  if (mode !== currentMode) return; // Nutzer hat inzwischen weitergeklickt
  current = new Cls(stage, engine);
}

function hideHint() {
  hint.style.display = 'none';
}

// ---------- Datei laden ----------
function loadFile(file) {
  if (!file) return;
  currentFile = file;
  if (mediaURL) URL.revokeObjectURL(mediaURL);
  mediaURL = URL.createObjectURL(file);
  media.src = mediaURL;
  mediaBox.classList.add('visible');
  btnMediaShow.hidden = true;
  try {
    engine.useMediaElement(media);
  } catch (err) {
    alert('Audio konnte nicht initialisiert werden: ' + err.message);
    return;
  }
  media.play().catch(() => { /* Nutzer startet über die Steuerleiste */ });
  hideHint();
  kbStatus.textContent = '';
  btnExport.disabled = true;
}

document.getElementById('btnFile').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));

window.addEventListener('dragover', e => {
  e.preventDefault();
  document.body.classList.add('drag');
});
window.addEventListener('dragleave', e => {
  if (!e.relatedTarget) document.body.classList.remove('drag');
});
window.addEventListener('drop', e => {
  e.preventDefault();
  document.body.classList.remove('drag');
  loadFile(e.dataTransfer.files[0]);
});

// ---------- System-Audio ----------
document.getElementById('btnSystem').addEventListener('click', async () => {
  try {
    await engine.useSystemAudio();
    media.pause();
    mediaBox.classList.remove('visible');
    btnMediaShow.hidden = true;
    currentFile = null;
    hideHint();
    if (currentMode === 'klangbild') {
      kbStatus.textContent = 'Hinweis: Das statische Klangbild braucht eine geladene Datei.';
    }
  } catch (err) {
    if (err.name !== 'NotAllowedError') {
      alert('System-Audio nicht verfügbar: ' + err.message);
    }
  }
});

// ---------- Klangbild (statisch) ----------
document.getElementById('btnRender').addEventListener('click', async () => {
  if (!currentFile) {
    alert('Bitte zuerst eine Audio- oder Videodatei laden – das Klangbild braucht den ganzen Song.');
    return;
  }
  if (currentMode !== 'klangbild' || !current) return;
  const style = document.getElementById('kbStyle').value;
  const btn = document.getElementById('btnRender');
  btn.disabled = true;
  btnExport.disabled = true;
  try {
    await current.render(currentFile, style, msg => { kbStatus.textContent = msg; });
    btnExport.disabled = false;
  } catch (err) {
    kbStatus.textContent = 'Fehler: ' + err.message;
  } finally {
    btn.disabled = false;
  }
});

btnExport.addEventListener('click', () => {
  if (current && current.exportPNG) current.exportPNG(currentFile ? currentFile.name : 'song');
});

// Liedsteuerung aus- und einblenden (die Wiedergabe läuft dabei weiter)
document.getElementById('btnMediaClose').addEventListener('click', () => {
  mediaBox.classList.remove('visible');
  btnMediaShow.hidden = false;
});
btnMediaShow.addEventListener('click', () => {
  mediaBox.classList.add('visible');
  btnMediaShow.hidden = true;
});

// ---------- Farbpalette ----------
const paletteSelect = document.getElementById('paletteSelect');
for (const [id, p] of Object.entries(PALETTES)) {
  const opt = document.createElement('option');
  opt.value = id;
  opt.textContent = p.name;
  paletteSelect.appendChild(opt);
}
try {
  const saved = localStorage.getItem('klangbild-palette');
  if (saved && PALETTES[saved]) {
    setPalette(saved);
    paletteSelect.value = saved;
  }
} catch (_) { /* localStorage nicht verfügbar – Standardpalette */ }

paletteSelect.addEventListener('change', () => {
  setPalette(paletteSelect.value);
  try { localStorage.setItem('klangbild-palette', paletteSelect.value); } catch (_) {}
  // Live-Visualizer lesen die Palette pro Frame; 3D braucht einen Anstoß,
  // das statische Klangbild ein erneutes Rendern.
  if (current && current.applyPalette) current.applyPalette();
  if (currentMode === 'klangbild' && current && current.off) {
    kbStatus.textContent = 'Palette geändert – „Klangbild erzeugen" wendet sie an.';
  }
});

// ---------- Modus-Umschaltung & Vollbild ----------
document.querySelectorAll('.modes button').forEach(b =>
  b.addEventListener('click', () => setMode(b.dataset.mode)));

document.getElementById('btnFullscreen').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.body.requestFullscreen();
});

// ---------- Render-Schleife ----------
function loop() {
  requestAnimationFrame(loop);
  const f = engine.update();
  if (current) current.update(f);
}

setMode('bars');
loop();
