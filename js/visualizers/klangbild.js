import { Visualizer } from './visualizer.js';
import { palette, hueAt, heatColor } from '../palettes.js';

// Statisches Klangbild: dekodiert den ganzen Song und rendert ihn als ein Bild –
// wahlweise als Spektrogramm oder als kreisförmigen "Song-Fingerabdruck".
// Gerendert wird in eine Offscreen-Canvas in Exportauflösung, die Anzeige ist
// nur eine eingepasste Kopie davon.

// Iterative Radix-2-FFT (in-place, komplex).
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < half; j++) {
        const ur = re[i + j], ui = im[i + j];
        const vr = re[i + j + half] * cr - im[i + j + half] * ci;
        const vi = re[i + j + half] * ci + im[i + j + half] * cr;
        re[i + j] = ur + vr;
        im[i + j] = ui + vi;
        re[i + j + half] = ur - vr;
        im[i + j + half] = ui - vi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

export class KlangbildVisualizer extends Visualizer {
  constructor(container, engine) {
    super(container, engine);
    this.g = this.canvas.getContext('2d');
    this.off = null;   // Offscreen-Canvas mit dem fertigen Bild
    this.geom = null;  // Geometrie des Bildes für die Abspielmarke
    this.media = document.getElementById('media');
    this._lastT = -1;
    this._blit();
  }

  // Das Bild selbst ist statisch; pro Frame wird nur die Abspielmarke
  // an der aktuellen Wiedergabeposition nachgeführt.
  update() {
    if (!this.off || !this.geom || !this.media.duration) return;
    const t = this.media.currentTime / this.media.duration;
    if (t === this._lastT) return;
    this._lastT = t;
    this._blit();
  }

  resize() {
    super.resize();
    if (this.g) this._blit();
  }

  _blit() {
    const g = this.g, w = this.width, h = this.height;
    g.fillStyle = '#0b0b12';
    g.fillRect(0, 0, w, h);
    if (!this.off) {
      g.fillStyle = '#8a8a9a';
      g.font = `${16 * this.dpr}px "Segoe UI", sans-serif`;
      g.textAlign = 'center';
      g.fillText('Datei laden und unten auf „Klangbild erzeugen" klicken.', w / 2, h / 2);
      return;
    }
    // Eingepasst zeichnen (Letterbox)
    const s = Math.min(w / this.off.width, h / this.off.height);
    const dw = this.off.width * s, dh = this.off.height * s;
    const dx = (w - dw) / 2, dy = (h - dh) / 2;
    g.drawImage(this.off, dx, dy, dw, dh);
    this._drawPlayhead(dx, dy, s);
  }

  // Abspielmarke: Linie im Spektrogramm bzw. rotierender Zeiger im Kreis.
  _drawPlayhead(dx, dy, s) {
    if (!this.geom || !this.media.duration) return;
    const t = Math.min(1, this.media.currentTime / this.media.duration);
    const g = this.g, geo = this.geom;
    g.save();
    g.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    g.lineWidth = Math.max(1.5, 2 * this.dpr * s);
    g.shadowColor = palette().accent;
    g.shadowBlur = 8 * this.dpr * s;
    g.beginPath();
    if (geo.type === 'spectro') {
      const x = dx + t * this.off.width * s;
      g.moveTo(x, dy + geo.top * s);
      g.lineTo(x, dy + geo.bottom * s);
    } else {
      const a = t * Math.PI * 2 - Math.PI / 2;
      g.moveTo(dx + (geo.cx + Math.cos(a) * geo.rIn) * s, dy + (geo.cy + Math.sin(a) * geo.rIn) * s);
      g.lineTo(dx + (geo.cx + Math.cos(a) * geo.rOut) * s, dy + (geo.cy + Math.sin(a) * geo.rOut) * s);
    }
    g.stroke();
    g.restore();
  }

  async _decode(file) {
    const buf = await file.arrayBuffer();
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    try {
      return await ac.decodeAudioData(buf);
    } finally {
      ac.close();
    }
  }

  async render(file, style, onStatus) {
    onStatus('Dekodiere Audio …');
    const audio = await this._decode(file);
    // Kanäle zu Mono mischen
    const n = audio.length;
    const mono = new Float32Array(n);
    for (let c = 0; c < audio.numberOfChannels; c++) {
      const d = audio.getChannelData(c);
      for (let i = 0; i < n; i++) mono[i] += d[i] / audio.numberOfChannels;
    }

    if (style === 'spectro') {
      await this._renderSpectrogram(mono, audio.sampleRate, file.name, audio.duration, onStatus);
    } else {
      await this._renderCircle(mono, file.name, audio.duration, onStatus);
    }
    this._blit();
    onStatus('Fertig – bereit zum Export.');
  }

  _label(g, name, duration, w, h) {
    const min = Math.floor(duration / 60), sec = Math.round(duration % 60);
    g.font = '600 28px "Segoe UI", sans-serif';
    g.textAlign = 'left';
    g.fillStyle = 'rgba(232, 232, 240, 0.85)';
    g.fillText(name.replace(/\.[^.]+$/, ''), 40, h - 36);
    g.textAlign = 'right';
    g.fillStyle = 'rgba(138, 138, 154, 0.85)';
    g.fillText(`${min}:${String(sec).padStart(2, '0')} · Klangbild`, w - 40, h - 36);
  }

  async _renderSpectrogram(mono, sampleRate, name, duration, onStatus) {
    const W = 1920, H = 1080;
    const off = document.createElement('canvas');
    off.width = W;
    off.height = H;
    const g = off.getContext('2d');
    g.fillStyle = '#08080e';
    g.fillRect(0, 0, W, H);

    const fftSize = 2048;
    const half = fftSize / 2;
    const specTop = 30, specBottom = H - 90;
    const specH = specBottom - specTop;
    const hop = Math.max(1, Math.floor((mono.length - fftSize) / W));

    // Hann-Fenster vorberechnen
    const win = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));

    const re = new Float32Array(fftSize);
    const im = new Float32Array(fftSize);
    const img = g.createImageData(1, specH);

    // Logarithmische Frequenzachse von 30 Hz bis Nyquist
    const fMin = 30, fMax = sampleRate / 2;
    const binOf = (yFrac) => {
      const f = fMin * Math.pow(fMax / fMin, yFrac);
      return Math.min(half - 1, Math.round((f / fMax) * half));
    };

    for (let x = 0; x < W; x++) {
      const start = x * hop;
      for (let i = 0; i < fftSize; i++) {
        re[i] = (mono[start + i] || 0) * win[i];
        im[i] = 0;
      }
      fft(re, im);
      for (let y = 0; y < specH; y++) {
        // y = 0 ist oben = hohe Frequenzen
        const bin = binOf(1 - y / specH);
        const mag = Math.hypot(re[bin], im[bin]) / fftSize;
        const db = 20 * Math.log10(mag + 1e-9);
        const t = Math.min(1, Math.max(0, (db - -90) / 70)); // -90..-20 dB → 0..1
        const [r, gr, b] = heatColor(t);
        const o = y * 4;
        img.data[o] = r;
        img.data[o + 1] = gr;
        img.data[o + 2] = b;
        img.data[o + 3] = 255;
      }
      g.putImageData(img, x, specTop);
      if (x % 160 === 0) {
        onStatus(`Rendere Spektrogramm … ${Math.round((x / W) * 100)} %`);
        await new Promise(r => setTimeout(r)); // UI nicht blockieren
      }
    }

    this._label(g, name, duration, W, H);
    this.geom = { type: 'spectro', top: specTop, bottom: specBottom };
    this.off = off;
    this._lastT = -1;
  }

  async _renderCircle(mono, name, duration, onStatus) {
    const S = 2000;
    const off = document.createElement('canvas');
    off.width = S;
    off.height = S;
    const g = off.getContext('2d');

    const bg = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    bg.addColorStop(0, '#12121c');
    bg.addColorStop(1, '#08080e');
    g.fillStyle = bg;
    g.fillRect(0, 0, S, S);

    const slices = 1440;
    const perSlice = Math.floor(mono.length / slices);
    const cx = S / 2, cy = S / 2;
    const rBase = S * 0.26, rMax = S * 0.21;

    // Pro Winkel-Segment: Lautstärke (RMS) → Strahllänge,
    // Nulldurchgangsrate (≈ Helligkeit des Klangs) → Helligkeit der Farbe.
    let peak = 0;
    const rms = new Float32Array(slices);
    const zcr = new Float32Array(slices);
    for (let s = 0; s < slices; s++) {
      let sum = 0, crossings = 0;
      const a = s * perSlice;
      for (let i = 0; i < perSlice; i++) {
        const v = mono[a + i];
        sum += v * v;
        if (i > 0 && (v >= 0) !== (mono[a + i - 1] >= 0)) crossings++;
      }
      rms[s] = Math.sqrt(sum / perSlice);
      zcr[s] = crossings / perSlice;
      if (rms[s] > peak) peak = rms[s];
      if (s % 300 === 0) {
        onStatus(`Analysiere … ${Math.round((s / slices) * 100)} %`);
        await new Promise(r => setTimeout(r));
      }
    }

    g.lineCap = 'round';
    for (let s = 0; s < slices; s++) {
      const amp = Math.pow(rms[s] / (peak || 1), 0.7); // Dynamik anheben
      const angle = (s / slices) * Math.PI * 2 - Math.PI / 2; // Start oben, im Uhrzeigersinn
      const len = amp * rMax;
      const hue = hueAt(s / slices); // Paletten-Verlauf über die Songdauer
      const light = 35 + Math.min(1, zcr[s] * 12) * 35;
      g.strokeStyle = `hsla(${hue}, ${palette().sat}%, ${light}%, 0.9)`;
      g.lineWidth = (Math.PI * 2 * rBase) / slices * 0.9;
      g.beginPath();
      g.moveTo(cx + Math.cos(angle) * (rBase - len * 0.55), cy + Math.sin(angle) * (rBase - len * 0.55));
      g.lineTo(cx + Math.cos(angle) * (rBase + len), cy + Math.sin(angle) * (rBase + len));
      g.stroke();
    }

    // Titel in der Mitte
    g.textAlign = 'center';
    g.fillStyle = 'rgba(232, 232, 240, 0.9)';
    g.font = '600 44px "Segoe UI", sans-serif';
    const title = name.replace(/\.[^.]+$/, '');
    g.fillText(title.length > 28 ? title.slice(0, 27) + '…' : title, cx, cy - 4);
    const min = Math.floor(duration / 60), sec = Math.round(duration % 60);
    g.fillStyle = 'rgba(138, 138, 154, 0.9)';
    g.font = '30px "Segoe UI", sans-serif';
    g.fillText(`${min}:${String(sec).padStart(2, '0')}`, cx, cy + 44);

    this.geom = { type: 'circle', cx, cy, rIn: rBase - rMax * 0.6, rOut: rBase + rMax };
    this.off = off;
    this._lastT = -1;
  }

  async exportPNG(name) {
    if (!this.off) return false;
    const blob = await new Promise(r => this.off.toBlob(r, 'image/png'));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(name || 'song').replace(/\.[^.]+$/, '')}-klangbild.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    return true;
  }
}
