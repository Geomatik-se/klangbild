// Gemeinsame Basisklasse: erzeugt eine eigene Canvas im Container und
// kümmert sich um Größenanpassung inkl. devicePixelRatio.
export class Visualizer {
  constructor(container, engine) {
    this.container = container;
    this.engine = engine;
    this.canvas = document.createElement('canvas');
    container.appendChild(this.canvas);
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.dpr = dpr;
    this.width = this.canvas.width;
    this.height = this.canvas.height;
  }

  // Wird pro Frame mit engine.frame aufgerufen – von Unterklassen zu implementieren.
  update(_frame) {}

  destroy() {
    window.removeEventListener('resize', this._onResize);
    this.canvas.remove();
  }
}
