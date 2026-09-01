// Zentrale Farbpaletten. Jede Palette definiert:
//   hue    – Farbton-Verlauf [Start, Ende] in Grad; wird überall dort benutzt,
//            wo Werte über eine Achse laufen (Balken, Songdauer, 3D-Ring)
//   sat    – Sättigung in % (0 = Graustufen)
//   accent – Akzentfarbe (Wellenform, Abspielmarke, 3D-Drahtgitter)
//   heat   – Farbverlauf fürs Spektrogramm als Stützstellen [t, r, g, b]

export const PALETTES = {
  spektrum: {
    name: 'Spektrum',
    hue: [265, 0], sat: 85, accent: '#00d4ff',
    heat: [
      [0.0, 8, 8, 18], [0.25, 70, 20, 110], [0.5, 200, 60, 60],
      [0.75, 255, 170, 40], [1.0, 255, 255, 230],
    ],
  },
  nordlicht: {
    name: 'Nordlicht',
    hue: [290, 130], sat: 75, accent: '#7cffc4',
    heat: [
      [0.0, 8, 10, 20], [0.25, 20, 60, 95], [0.5, 20, 160, 140],
      [0.75, 120, 230, 160], [1.0, 240, 255, 230],
    ],
  },
  feuer: {
    name: 'Feuer',
    hue: [0, 55], sat: 95, accent: '#ffb347',
    heat: [
      [0.0, 12, 4, 4], [0.3, 95, 12, 10], [0.6, 220, 80, 20],
      [0.85, 255, 180, 50], [1.0, 255, 255, 220],
    ],
  },
  ozean: {
    name: 'Ozean',
    hue: [250, 175], sat: 80, accent: '#66e0ff',
    heat: [
      [0.0, 4, 8, 20], [0.3, 15, 40, 110], [0.6, 20, 110, 190],
      [0.85, 90, 200, 240], [1.0, 230, 250, 255],
    ],
  },
  wald: {
    name: 'Wald',
    hue: [70, 165], sat: 60, accent: '#a8e063',
    heat: [
      [0.0, 6, 12, 8], [0.3, 20, 60, 30], [0.6, 45, 130, 60],
      [0.85, 140, 200, 110], [1.0, 240, 255, 225],
    ],
  },
  mono: {
    name: 'Monochrom',
    hue: [0, 0], sat: 0, accent: '#ffffff',
    heat: [
      [0.0, 0, 0, 0], [0.5, 120, 120, 125], [1.0, 255, 255, 255],
    ],
  },
};

let current = PALETTES.spektrum;

export function setPalette(id) {
  if (PALETTES[id]) current = PALETTES[id];
}

export function palette() {
  return current;
}

// Farbton an Position t (0..1) im Verlauf der aktuellen Palette.
export function hueAt(t) {
  const [a, b] = current.hue;
  return a + (b - a) * t;
}

// Spektrogramm-Farbe für Intensität t (0..1) aus den heat-Stützstellen.
export function heatColor(t) {
  const stops = current.heat;
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, r0, g0, b0] = stops[i - 1];
      const [t1, r1, g1, b1] = stops[i];
      const k = (t - t0) / (t1 - t0);
      return [r0 + (r1 - r0) * k, g0 + (g1 - g0) * k, b0 + (b1 - b0) * k];
    }
  }
  const [, r, g, b] = stops[stops.length - 1];
  return [r, g, b];
}
