import { Visualizer } from './visualizer.js';

// Klassischer Visualizer: Frequenz-Balken mit Farbverlauf + Wellenform-Linie.
export class BarsVisualizer extends Visualizer {
  constructor(container, engine) {
    super(container, engine);
    this.g = this.canvas.getContext('2d');
  }

  update(f) {
    const g = this.g, w = this.width, h = this.height;
    g.fillStyle = '#0b0b12';
    g.fillRect(0, 0, w, h);
    if (!f.freq) return;

    // Nur den musikalisch relevanten Teil des Spektrums zeigen (untere ~70 %).
    const bins = Math.floor(f.freq.length * 0.7);
    const barCount = 96;
    const step = bins / barCount;
    const barW = w / barCount;

    for (let i = 0; i < barCount; i++) {
      // Mehrere Bins pro Balken mitteln
      let sum = 0;
      const a = Math.floor(i * step), b = Math.floor((i + 1) * step);
      for (let j = a; j < b; j++) sum += f.freq[j];
      const v = sum / ((b - a) * 255 || 1);

      const barH = v * h * 0.85;
      const hue = 260 - (i / barCount) * 200; // violett → türkis → grün
      const grad = g.createLinearGradient(0, h, 0, h - barH);
      grad.addColorStop(0, `hsl(${hue}, 85%, 45%)`);
      grad.addColorStop(1, `hsl(${hue}, 95%, ${55 + v * 25}%)`);
      g.fillStyle = grad;
      g.fillRect(i * barW + barW * 0.12, h - barH, barW * 0.76, barH);

      // Spiegelung nach oben, dezent
      g.globalAlpha = 0.12;
      g.fillRect(i * barW + barW * 0.12, h - barH * 1.25, barW * 0.76, barH * 0.25);
      g.globalAlpha = 1;
    }

    // Wellenform als Linie im oberen Drittel
    g.beginPath();
    const n = f.wave.length;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * w;
      const y = h * 0.25 + ((f.wave[i] - 128) / 128) * h * 0.18;
      i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.strokeStyle = f.beat ? '#ffffff' : '#00d4ff';
    g.lineWidth = (f.beat ? 3 : 1.5) * this.dpr;
    g.globalAlpha = 0.9;
    g.stroke();
    g.globalAlpha = 1;
  }
}
