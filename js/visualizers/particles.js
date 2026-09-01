import { Visualizer } from './visualizer.js';
import { palette, hueAt } from '../palettes.js';

// Generativer Visualizer: Partikel strömen aus der Mitte, Beats geben Schub,
// die Tonlage (Bass/Mitten/Höhen) bestimmt die Farbe.
export class ParticlesVisualizer extends Visualizer {
  constructor(container, engine) {
    super(container, engine);
    this.g = this.canvas.getContext('2d');
    this.particles = [];
    this.rotation = 0;
  }

  _spawn(count, speed, hue) {
    const cx = this.width / 2, cy = this.height / 2;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.9);
      this.particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: 1,
        decay: 0.004 + Math.random() * 0.01,
        size: (1.5 + Math.random() * 3.5) * this.dpr,
        hue: hue + (Math.random() * 40 - 20),
      });
    }
  }

  update(f) {
    const g = this.g, w = this.width, h = this.height;

    // Halbtransparent übermalen → Leuchtspuren
    g.fillStyle = 'rgba(11, 11, 18, 0.18)';
    g.fillRect(0, 0, w, h);
    if (!f.freq) return;

    // Farbwahl: dominantes Band bestimmt die Position im Paletten-Verlauf
    let hue;
    if (f.bass >= f.mid && f.bass >= f.treble) hue = hueAt(0.15);  // Bass → Anfang
    else if (f.treble >= f.mid) hue = hueAt(0.85);                 // Höhen → Ende
    else hue = hueAt(0.5);                                         // Mitten → Mitte

    // Laufende Emission je nach Lautstärke, Beats geben Explosionen
    if (f.level > 0.03) this._spawn(Math.round(f.level * 6), (2 + f.mid * 10) * this.dpr, hue);
    if (f.beat) this._spawn(60 + Math.round(f.bass * 80), (6 + f.bass * 18) * this.dpr, hue);

    g.globalCompositeOperation = 'lighter';
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.life -= p.decay;
      if (p.life <= 0 || p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 20) {
        this.particles.splice(i, 1);
        continue;
      }
      g.globalAlpha = p.life * 0.85;
      g.fillStyle = `hsl(${p.hue}, ${palette().sat}%, ${45 + p.life * 25}%)`;
      g.beginPath();
      g.arc(p.x, p.y, p.size * (0.5 + p.life), 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;

    // Pulsierender Ring in der Mitte
    this.rotation += 0.003 + f.level * 0.02;
    const cx = w / 2, cy = h / 2;
    const baseR = Math.min(w, h) * (0.1 + f.bass * 0.12);
    g.beginPath();
    const spikes = 64;
    for (let i = 0; i <= spikes; i++) {
      const idx = Math.floor((i / spikes) * f.freq.length * 0.5);
      const amp = f.freq[idx] / 255;
      const r = baseR + amp * Math.min(w, h) * 0.1;
      const a = this.rotation + (i / spikes) * Math.PI * 2;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.closePath();
    g.strokeStyle = `hsla(${hue}, ${palette().sat}%, 65%, 0.8)`;
    g.lineWidth = 2 * this.dpr;
    g.stroke();
    g.globalCompositeOperation = 'source-over';

    // Speicher schützen
    if (this.particles.length > 4000) this.particles.splice(0, this.particles.length - 4000);
  }
}
