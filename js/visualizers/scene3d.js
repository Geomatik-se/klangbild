import * as THREE from 'three';
import { Visualizer } from './visualizer.js';
import { palette, hueAt, theme } from '../palettes.js';

// 3D-Visualizer: Frequenz-Ring aus Säulen um einen pulsierenden Ikosaeder,
// Kamera kreist langsam um die Szene.
export class Scene3DVisualizer extends Visualizer {
  constructor(container, engine) {
    super(container, engine);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0b0b12, 0.02);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);

    // Zentraler Körper
    this.core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(3, 1),
      new THREE.MeshStandardMaterial({ flatShading: true, metalness: 0.3, roughness: 0.35 })
    );
    this.scene.add(this.core);

    this.wire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(3.6, 1),
      new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.25 })
    );
    this.scene.add(this.wire);

    // Frequenz-Ring
    this.barCount = 96;
    this.bars = [];
    const barGeo = new THREE.BoxGeometry(0.5, 1, 0.5);
    for (let i = 0; i < this.barCount; i++) {
      const mat = new THREE.MeshStandardMaterial();
      const bar = new THREE.Mesh(barGeo, mat);
      const a = (i / this.barCount) * Math.PI * 2;
      bar.position.set(Math.cos(a) * 12, 0, Math.sin(a) * 12);
      bar.lookAt(0, 0, 0);
      this.scene.add(bar);
      this.bars.push(bar);
    }

    // Boden-Gitter und Licht
    const grid = new THREE.GridHelper(80, 40, 0x2e2e3e, 0x1c1c28);
    grid.position.y = -6;
    this.scene.add(grid);
    this.scene.add(new THREE.AmbientLight(0x8888aa, 0.6));
    this.light = new THREE.PointLight(0xffffff, 120, 100);
    this.light.position.set(0, 12, 0);
    this.scene.add(this.light);

    this.angle = 0;
    this.pulse = 0;
    this.applyPalette();
    this._applySize();
  }

  // Färbt Kern, Drahtgitter und Ring nach der aktuellen Palette;
  // wird auch beim Palettenwechsel von außen aufgerufen.
  applyPalette() {
    const p = palette();
    const s = p.sat / 100;
    const bg = new THREE.Color(theme().bg);
    this.scene.background = bg;
    this.scene.fog.color.copy(bg);
    this.core.material.color.setHSL(((hueAt(0.15) % 360) + 360) % 360 / 360, s, 0.55);
    this.core.material.emissive.setHSL(((hueAt(0.15) % 360) + 360) % 360 / 360, s, 0.18);
    this.wire.material.color.set(p.accent);
    for (let i = 0; i < this.barCount; i++) {
      const h = ((hueAt(i / this.barCount) % 360) + 360) % 360 / 360;
      this.bars[i].material.color.setHSL(h, s, 0.55);
      this.bars[i].material.emissive.setHSL(h, s, 0.2);
    }
  }

  _applySize() {
    if (!this.renderer) return;
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  resize() {
    super.resize();
    this._applySize();
  }

  update(f) {
    if (f.freq) {
      // Balkenhöhen aus dem Spektrum (unterer, relevanter Teil)
      const bins = Math.floor(f.freq.length * 0.7);
      for (let i = 0; i < this.barCount; i++) {
        const v = f.freq[Math.floor((i / this.barCount) * bins)] / 255;
        this.bars[i].scale.y = 0.2 + v * 14;
        this.bars[i].position.y = this.bars[i].scale.y / 2 - 6;
      }

      // Beat lässt den Kern aufpulsen, danach sanftes Abklingen
      if (f.beat) this.pulse = 1;
      this.pulse *= 0.94;
      const s = 1 + f.bass * 0.5 + this.pulse * 0.35;
      this.core.scale.setScalar(s);
      this.wire.scale.setScalar(s * 1.05);
      this.core.rotation.y += 0.004 + f.mid * 0.03;
      this.core.rotation.x += 0.002;
      this.wire.rotation.y -= 0.003 + f.treble * 0.02;
      this.light.intensity = 80 + f.level * 300;
    }

    // Kamerafahrt
    this.angle += 0.0018;
    const r = 26;
    this.camera.position.set(Math.cos(this.angle) * r, 6 + Math.sin(this.angle * 0.7) * 3, Math.sin(this.angle) * r);
    this.camera.lookAt(0, 0, 0);

    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.renderer.dispose();
    this.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    this.renderer = null;
    super.destroy();
  }
}
