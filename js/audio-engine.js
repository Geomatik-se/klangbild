// Kapselt Web Audio: Quellen (Datei / System-Audio), Analyse und Beat-Erkennung.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.mediaSource = null;     // MediaElementAudioSourceNode (nur einmal pro Element erlaubt)
    this.streamSource = null;    // MediaStreamAudioSourceNode
    this.stream = null;          // aktiver getDisplayMedia-Stream
    this.freq = null;
    this.wave = null;

    // Beat-Erkennung: gleitender Energie-Durchschnitt des Bassbereichs
    this._energyHistory = [];
    this._lastBeat = 0;

    this.frame = {
      freq: null, wave: null,
      bass: 0, mid: 0, treble: 0, level: 0,
      beat: false, time: 0,
    };
  }

  _ensureContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;
      this.freq = new Uint8Array(this.analyser.frequencyBinCount);
      this.wave = new Uint8Array(this.analyser.fftSize);
      this.frame.freq = this.freq;
      this.frame.wave = this.wave;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  // Datei-Wiedergabe über ein <video>-Element (spielt auch reine Audiodateien).
  useMediaElement(el) {
    this._ensureContext();
    this._stopStream();
    if (!this.mediaSource) {
      this.mediaSource = this.ctx.createMediaElementSource(el);
    }
    this.mediaSource.disconnect();
    this.mediaSource.connect(this.analyser);
    this.mediaSource.connect(this.ctx.destination);
  }

  // System-Audio über Bildschirmfreigabe (Chrome/Edge unter Windows).
  async useSystemAudio() {
    this._ensureContext();
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    if (stream.getAudioTracks().length === 0) {
      stream.getTracks().forEach(t => t.stop());
      throw new Error('Die Freigabe enthält keine Audiospur. Bitte beim Teilen „Audio teilen" ankreuzen (Tab oder gesamter Bildschirm).');
    }
    this._stopStream();
    if (this.mediaSource) this.mediaSource.disconnect();
    this.stream = stream;
    this.streamSource = this.ctx.createMediaStreamSource(stream);
    // Nicht mit destination verbinden – das System-Audio läuft ja bereits hörbar.
    this.streamSource.connect(this.analyser);
    // Beendet der Nutzer die Freigabe, aufräumen:
    stream.getAudioTracks()[0].addEventListener('ended', () => this._stopStream());
    return stream;
  }

  _stopStream() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.streamSource) {
      this.streamSource.disconnect();
      this.streamSource = null;
    }
  }

  get active() {
    return !!this.ctx;
  }

  // Mittelwert eines Frequenzbereichs (Anteile 0..1 des Spektrums), normiert auf 0..1.
  _band(from, to) {
    const n = this.freq.length;
    const a = Math.floor(from * n), b = Math.max(a + 1, Math.floor(to * n));
    let sum = 0;
    for (let i = a; i < b; i++) sum += this.freq[i];
    return sum / ((b - a) * 255);
  }

  // Einmal pro Frame aufrufen; aktualisiert this.frame.
  update() {
    if (!this.ctx) return this.frame;
    this.analyser.getByteFrequencyData(this.freq);
    this.analyser.getByteTimeDomainData(this.wave);

    const f = this.frame;
    f.bass = this._band(0.0, 0.08);
    f.mid = this._band(0.08, 0.4);
    f.treble = this._band(0.4, 1.0);
    f.level = f.bass * 0.5 + f.mid * 0.35 + f.treble * 0.15;
    f.time = this.ctx.currentTime;

    // Beat: Bass-Energie deutlich über gleitendem Durchschnitt, mit Sperrzeit.
    const hist = this._energyHistory;
    hist.push(f.bass);
    if (hist.length > 43) hist.shift(); // ~0,7 s bei 60 fps
    const avg = hist.reduce((s, v) => s + v, 0) / hist.length;
    f.beat = false;
    if (f.bass > 0.15 && f.bass > avg * 1.35 && f.time - this._lastBeat > 0.25) {
      f.beat = true;
      this._lastBeat = f.time;
    }
    return f;
  }
}
