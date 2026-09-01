import { Visualizer } from './visualizer.js';
import { palette, hueAt } from '../palettes.js';

// Noten-Visualizer: erkennt die dominante Tonhöhe im Spektrum und zeichnet
// die Noten auf ein Notensystem (Violinschlüssel), das nach links durchläuft.
// Hinweis: Bei polyphoner Musik ist das eine Annäherung an die auffälligste Stimme.

const NAMES_DE = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'B', 'H'];
//                 C    C#    D    D#    E    F    F#    G    G#    A    A#   H
const DIATONIC = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const SHARP = [false, true, false, true, false, false, true, false, true, false, true, false];

const SCROLL_SECONDS = 8;   // so lange braucht eine Note über den Bildschirm
const MIN_FREQ = 70, MAX_FREQ = 1600;

export class NotesVisualizer extends Visualizer {
  constructor(container, engine) {
    super(container, engine);
    this.g = this.canvas.getContext('2d');
    this.notes = [];        // { midi, name, sharp, born, level }
    this._lastMidi = -1;
    this._stableCount = 0;
    this._heldMidi = -1;
  }

  // Stärksten Spektral-Peak suchen, mit parabolischer Interpolation verfeinern.
  _detectPitch(f) {
    const ctx = this.engine.ctx;
    if (!ctx || !f.freq) return null;
    const binHz = ctx.sampleRate / this.engine.analyser.fftSize;
    const lo = Math.max(2, Math.floor(MIN_FREQ / binHz));
    const hi = Math.min(f.freq.length - 2, Math.ceil(MAX_FREQ / binHz));
    let best = -1, bestV = 0;
    for (let i = lo; i <= hi; i++) {
      if (f.freq[i] > bestV) { bestV = f.freq[i]; best = i; }
    }
    if (best < 0 || bestV < 120) return null; // zu leise → keine Note
    const y0 = f.freq[best - 1], y1 = f.freq[best], y2 = f.freq[best + 1];
    const denom = y0 - 2 * y1 + y2;
    const shift = denom === 0 ? 0 : 0.5 * (y0 - y2) / denom;
    return (best + shift) * binHz;
  }

  update(f) {
    const g = this.g, w = this.width, h = this.height;
    g.fillStyle = '#0b0b12';
    g.fillRect(0, 0, w, h);

    const s = Math.min(w, h) * 0.045;          // Linienabstand
    const midY = h * 0.5;
    const bottomLineY = midY + 2 * s;          // unterste Linie = E4
    const now = performance.now() / 1000;
    const p = palette();

    // Notensystem
    g.strokeStyle = 'rgba(232, 232, 240, 0.35)';
    g.lineWidth = Math.max(1, this.dpr);
    for (let i = 0; i < 5; i++) {
      const y = bottomLineY - i * s;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    // Violinschlüssel
    g.fillStyle = 'rgba(232, 232, 240, 0.6)';
    g.font = `${s * 4.4}px "Segoe UI Symbol", serif`;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('\u{1D11E}', s * 0.5, bottomLineY - 2 * s);

    // Tonhöhe erkennen (2 stabile Frames nötig, um Flackern zu vermeiden)
    const freq = f.freq ? this._detectPitch(f) : null;
    if (freq) {
      const midi = Math.round(69 + 12 * Math.log2(freq / 440));
      if (midi === this._lastMidi) this._stableCount++;
      else this._stableCount = 0;
      this._lastMidi = midi;
      if (this._stableCount >= 2 && midi !== this._heldMidi) {
        const pc = ((midi % 12) + 12) % 12;
        this.notes.push({
          midi, born: now,
          name: NAMES_DE[pc],
          sharp: SHARP[pc],
          octave: Math.floor(midi / 12) - 1,
          level: f.level,
        });
        this._heldMidi = midi;
      }
    } else {
      this._heldMidi = -1;
      this._stableCount = 0;
    }

    // Noten zeichnen (wandern von rechts nach links)
    const noteW = s * 0.7;
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const n = this.notes[i];
      const age = now - n.born;
      if (age > SCROLL_SECONDS) { this.notes.splice(i, 1); continue; }
      const x = w - (age / SCROLL_SECONDS) * w;

      const octave = Math.floor(n.midi / 12) - 1;
      const total = octave * 7 + DIATONIC[((n.midi % 12) + 12) % 12];
      const y = bottomLineY - (total - 30) * s / 2; // 30 = E4 auf der untersten Linie

      // Hilfslinien ober-/unterhalb des Systems
      g.strokeStyle = 'rgba(232, 232, 240, 0.3)';
      for (let t = 28; t >= total; t -= 2) {       // unterhalb (C4 = 28 usw.)
        const ly = bottomLineY - (t - 30) * s / 2;
        g.beginPath();
        g.moveTo(x - noteW * 1.6, ly);
        g.lineTo(x + noteW * 1.6, ly);
        g.stroke();
      }
      for (let t = 40; t <= total; t += 2) {       // oberhalb (A5 = 40 usw.)
        const ly = bottomLineY - (t - 30) * s / 2;
        g.beginPath();
        g.moveTo(x - noteW * 1.6, ly);
        g.lineTo(x + noteW * 1.6, ly);
        g.stroke();
      }

      // Farbe aus der Palette: tiefe Töne → Anfang, hohe → Ende des Verlaufs
      const hue = hueAt(Math.min(1, Math.max(0, (n.midi - 40) / 44)));
      const alpha = Math.min(1, (SCROLL_SECONDS - age) / 1.5);
      g.fillStyle = `hsla(${hue}, ${p.sat}%, 62%, ${alpha})`;
      g.strokeStyle = g.fillStyle;

      // Notenkopf (leicht gedrehte Ellipse) + Hals
      g.save();
      g.translate(x, y);
      g.rotate(-0.3);
      g.beginPath();
      g.ellipse(0, 0, noteW, noteW * 0.72, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
      g.lineWidth = Math.max(1.5, 0.12 * s);
      g.beginPath();
      if (total >= 34) { // ab H4 Hals nach unten
        g.moveTo(x - noteW * 0.92, y + noteW * 0.1);
        g.lineTo(x - noteW * 0.92, y + s * 3);
      } else {
        g.moveTo(x + noteW * 0.92, y - noteW * 0.1);
        g.lineTo(x + noteW * 0.92, y - s * 3);
      }
      g.stroke();

      // Vorzeichen
      if (n.sharp) {
        g.font = `${s * 1.3}px "Segoe UI", sans-serif`;
        g.textAlign = 'right';
        g.fillText('♯', x - noteW * 1.4, y);
      }
    }

    // Aktuelle Note groß anzeigen
    g.textAlign = 'right';
    g.textBaseline = 'top';
    if (this._heldMidi >= 0) {
      const pc = ((this._heldMidi % 12) + 12) % 12;
      const hue = hueAt(Math.min(1, Math.max(0, (this._heldMidi - 40) / 44)));
      g.fillStyle = `hsl(${hue}, ${p.sat}%, 65%)`;
      g.font = `600 ${s * 2.2}px "Segoe UI", sans-serif`;
      g.fillText(`${NAMES_DE[pc]}${Math.floor(this._heldMidi / 12) - 1}`, w - s, s);
    } else {
      g.fillStyle = 'rgba(138, 138, 154, 0.6)';
      g.font = `600 ${s * 2.2}px "Segoe UI", sans-serif`;
      g.fillText('–', w - s, s);
    }
  }
}
