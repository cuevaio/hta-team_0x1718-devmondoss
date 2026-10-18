/**
 * Audio del juego: efectos y música chiptune generados con WebAudio
 * (onda cuadrada + triangular). Sin archivos de audio ni música de terceros.
 */

const SEMITONO: Record<string, number> = {
  C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11,
};

function frecuencia(nota: string): number | null {
  const m = /^([A-G]#?)(\d)$/.exec(nota);
  if (!m) return null;
  const midi = SEMITONO[m[1]] + (Number(m[2]) + 1) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** `bateria`: `k` bombo, `s` caja, `h` platillo, `.` silencio (una corchea cada uno). */
type Pista = { bpm: number; melodia: string; bajo: string; tipo?: OscillatorType; bateria?: string };

/** Cada token es una corchea: nota (`A4`), `-` = sostener, `.` = silencio. */
const PISTAS: Record<string, Pista> = {
  titulo: {
    bpm: 132,
    melodia: "E5 - G5 - C6 - B5 A5 G5 - E5 - D5 E5 F5 - E5 - D5 - C5 - - - G4 - C5 - E5 - D5 C5 D5 - G4 - A4 B4 C5 - D5 - E5 - D5 - - - . . . .",
    bajo: "C3 - C3 - G2 - G2 - A2 - A2 - E2 - E2 - F2 - F2 - C3 - C3 - F2 - F2 - G2 - G2 - C3 - G2 - C3 - . .",
  },
  barrio: {
    bpm: 104,
    melodia: "A4 - C5 - F5 - E5 C5 D5 - - . A4 C5 D5 - C5 - A4 - G4 - F4 - - - . . A4 - C5 - F5 - G5 A5 G5 - F5 - E5 - D5 - C5 - - - . . . .",
    bajo: "F2 - . F2 C3 - . C3 D3 - . D3 A2 - . A2 A#2 - . A#2 F2 - . F2 G2 - . G2 C3 - . C3",
  },
  llamada: {
    bpm: 150,
    melodia: "A4 . A4 C5 . A4 E5 - D5 . C5 . B4 . G#4 - A4 . A4 C5 . A4 F5 - E5 . D5 . C5 . B4 -",
    bajo: "A2 . A2 . A2 . A2 . A2 . A2 . E2 . E2 . F2 . F2 . F2 . F2 . E2 . E2 . G#2 . E2 .",
    tipo: "square",
    bateria: "k h s h k h s h k h s h k k s h",
  },
  guardian: {
    bpm: 140,
    melodia: "C5 . E5 . G5 - C6 - B5 . G5 . A5 - - . F5 . A5 . C6 - E6 - D6 - C6 - - - . .",
    bajo: "C3 . C3 . E3 . E3 . G2 . G2 . F2 . F2 . F2 . F2 . A2 . A2 . G2 . G2 . C3 . C3 .",
  },
  triste: {
    bpm: 72,
    melodia: "D5 - - C5 A4 - - . F4 - G4 - A4 - - - D5 - - E5 F5 - E5 D5 C5 - A4 - - - . .",
    bajo: "D3 - - - A2 - - - A#2 - - - A2 - - - D3 - - - A#2 - - - G2 - - - A2 - - -",
    tipo: "triangle",
  },
  arcade: {
    bpm: 168,
    melodia: "E5 . E5 G5 . E5 A5 . G5 . E5 . D5 . C5 . D5 . D5 F5 . D5 G5 . F5 . D5 . C5 . B4 . C5 . E5 . G5 . C6 . B5 . A5 . G5 . A5 . G5 . E5 . D5 - - - . .",
    bajo: "C3 C3 . C3 G2 . C3 . A2 A2 . A2 E2 . A2 . F2 F2 . F2 C3 . F2 . G2 G2 . G2 D3 . G2 .",
    tipo: "square",
    bateria: "k h s h k k s h",
  },
  detective: {
    bpm: 120,
    melodia: "A4 . . C5 . . B4 . G#4 - - . E4 . . . A4 . . C5 . . E5 . D5 - - . B4 . . . F5 . . E5 . . D5 . C5 - - . B4 . . . A4 . C5 . B4 . G#4 . A4 - - - . . . .",
    bajo: "A2 . A2 . A2 . A2 . E2 . E2 . E2 . E2 . F2 . F2 . F2 . F2 . E2 . E2 . G#2 . E2 .",
    tipo: "square",
    bateria: "k . h . s . h . k . k . s . h h",
  },
  suspenso: {
    bpm: 80,
    melodia: ". . . . E5 . . . . . . . D#5 . . . . . . . E5 . . . G5 . F#5 . D#5 - - - . . . . . . . .",
    bajo: "E2 - - - E2 - - - E2 - - - E2 - - - C2 - - - C2 - - - B1 - - - B1 - - -",
    tipo: "triangle",
    bateria: "k . . k . . . . k . . k . . . .",
  },
  mula: {
    bpm: 156,
    melodia: "G4 . B4 D5 . B4 G5 . F#5 . D5 . E5 . C5 . A4 . C5 E5 . C5 A5 . G5 . E5 . F#5 . D5 . G4 . B4 D5 . B4 G5 . A5 . B5 . A5 G5 F#5 . E5 . D5 . . . G5 - - - . . . .",
    bajo: "G2 . G3 . G2 . G3 . E2 . E3 . E2 . E3 . C2 . C3 . C2 . C3 . D2 . D3 . D2 . D3 .",
    tipo: "square",
    bateria: "k h s h k h s s",
  },
  jefe: {
    bpm: 172,
    melodia: "D5 D5 . D5 F5 . D5 . C5 . A#4 . A4 . . . D5 D5 . D5 F5 . G5 . A5 . G5 . F5 . E5 . D5 D5 . D5 F5 . D5 . C5 . A#4 . C5 . A4 . D5 - - - . . . . . . . .",
    bajo: "D2 D3 D2 D3 D2 D3 D2 D3 A#1 A#2 A#1 A#2 A#1 A#2 A#1 A#2 C2 C3 C2 C3 C2 C3 C2 C3 A1 A2 A1 A2 A1 A2 A1 A2",
    tipo: "square",
    bateria: "k h s h k k s h k h s h k s s s",
  },
  intro: {
    bpm: 112,
    melodia: ". . . . . . . . A4 . . . . . . . . . . . . . . . G#4 . . . . . . .",
    bajo: "A1 . A1 . A1 . A1 . A1 . A1 . A1 . A1 . F1 . F1 . F1 . F1 . E1 . E1 . E1 . E1 .",
    tipo: "triangle",
    bateria: "k . . . k . . . k . . . k . k .",
  },
  noche: {
    bpm: 96,
    melodia: "E4 . G4 . B4 . A4 . G4 . F#4 . E4 - - . B3 . E4 . G4 . F#4 . D4 . E4 - - - . .",
    bajo: "E2 - . E2 . E2 . . C2 - . C2 . C2 . . A1 - . A1 . A1 . . B1 - . B1 . B1 . .",
    tipo: "triangle",
  },
};

export class Audio {
  private ctx: AudioContext | null = null;
  private silenciado = false;
  private pista: Pista | null = null;
  private nombrePista: string | null = null;
  private paso = 0;
  private ruidoBuf: AudioBuffer | null = null;
  /** Multiplica el tempo de la pista (urgencia). Vuelve a 1 al cambiar de pista. */
  ritmo = 1;
  private proximo = 0;
  private reloj = 0;

  constructor() {
    try {
      this.silenciado = window.localStorage.getItem("ter-silencio") === "1";
    } catch {
      this.silenciado = false;
    }
  }

  get silencio() {
    return this.silenciado;
  }

  set silencio(v: boolean) {
    this.silenciado = v;
    try {
      window.localStorage.setItem("ter-silencio", v ? "1" : "0");
    } catch {
      // sin almacenamiento: queda en memoria
    }
  }

  /** Debe llamarse dentro de un gesto del usuario (un toque). */
  desbloquear() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      try {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AC();
      } catch {
        this.ctx = null;
        return;
      }
      this.reloj = window.setInterval(() => this.programar(), 40);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  detener() {
    window.clearInterval(this.reloj);
    void this.ctx?.close();
    this.ctx = null;
  }

  private nota(freq: number, inicio: number, dur: number, vol: number, tipo: OscillatorType) {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = tipo;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, inicio);
    g.gain.linearRampToValueAtTime(vol, inicio + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, inicio + dur);
    o.connect(g).connect(c.destination);
    o.start(inicio);
    o.stop(inicio + dur + 0.02);
  }

  tono(freq: number, dur: number, vol = 0.04, retraso = 0, tipo: OscillatorType = "square") {
    if (this.silenciado || !this.ctx) return;
    this.nota(freq, this.ctx.currentTime + retraso, dur, vol, tipo);
  }

  // ── Música ───────────────────────────────────────────────

  musica(nombre: keyof typeof PISTAS | null) {
    if (nombre === this.nombrePista) return;
    this.nombrePista = nombre;
    this.pista = nombre ? PISTAS[nombre] : null;
    this.ritmo = 1;
    this.paso = 0;
    this.proximo = this.ctx ? this.ctx.currentTime + 0.05 : 0;
  }

  private programar() {
    const c = this.ctx;
    const p = this.pista;
    if (!c || !p) return;
    const corchea = 60 / (p.bpm * this.ritmo) / 2;
    if (this.proximo < c.currentTime) this.proximo = c.currentTime + 0.05;
    while (this.proximo < c.currentTime + 0.15) {
      if (!this.silenciado) {
        this.voz(p.melodia, this.paso, corchea, 0.022, p.tipo ?? "square");
        this.voz(p.bajo, this.paso, corchea, 0.045, "triangle");
        if (p.bateria) this.golpeBateria(p.bateria, this.paso, this.proximo);
      }
      this.paso++;
      this.proximo += corchea;
    }
  }

  private voz(linea: string, paso: number, corchea: number, vol: number, tipo: OscillatorType) {
    const tokens = linea.split(/\s+/);
    const i = paso % tokens.length;
    const f = frecuencia(tokens[i]);
    if (!f) return;
    let largo = 1;
    while (tokens[(i + largo) % tokens.length] === "-" && largo < tokens.length) largo++;
    this.nota(f, this.proximo, largo * corchea * 0.92, vol, tipo);
  }

  private golpeBateria(linea: string, paso: number, t: number) {
    const tokens = linea.split(/\s+/);
    const g = tokens[paso % tokens.length];
    if (g === "k") this.bombo(t, 0.09);
    else if (g === "s") this.ruidoEn(t, 0.08, 0.035, 1800, "highpass");
    else if (g === "h") this.ruidoEn(t, 0.025, 0.012, 7000, "highpass");
  }

  private bombo(t: number, vol: number) {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.18);
  }

  private ruidoEn(t: number, dur: number, vol: number, corte: number, tipo: BiquadFilterType) {
    const c = this.ctx!;
    if (!this.ruidoBuf) {
      this.ruidoBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = this.ruidoBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = c.createBufferSource();
    src.buffer = this.ruidoBuf;
    const f = c.createBiquadFilter();
    f.type = tipo;
    f.frequency.value = corte;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  /** Tono que se desliza de `desde` a `hasta` Hz (sirenas, caídas, subidas). */
  private barrido(desde: number, hasta: number, dur: number, vol: number, tipo: OscillatorType = "square", retraso = 0) {
    if (this.silenciado || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + retraso;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(desde, t);
    o.frequency.exponentialRampToValueAtTime(hasta, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private ruido(dur: number, vol: number, corte: number, tipo: BiquadFilterType = "lowpass", retraso = 0) {
    if (this.silenciado || !this.ctx) return;
    this.ruidoEn(this.ctx.currentTime + retraso, dur, vol, corte, tipo);
  }

  // ── Efectos de escena ────────────────────────────────────

  /** Latido: suspenso y urgencia. */
  latido() {
    if (this.silenciado || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.bombo(t, 0.12);
    this.bombo(t + 0.16, 0.08);
  }
  alarma() {
    for (let i = 0; i < 3; i++) {
      this.barrido(700, 1100, 0.18, 0.03, "square", i * 0.36);
      this.barrido(1100, 700, 0.18, 0.03, "square", i * 0.36 + 0.18);
    }
  }
  whoosh() {
    this.ruido(0.25, 0.05, 1200, "bandpass");
    this.barrido(300, 1200, 0.22, 0.012, "sawtooth");
  }
  boom() {
    this.barrido(120, 30, 0.5, 0.09, "sine");
    this.ruido(0.4, 0.06, 400, "lowpass");
  }
  glitch() {
    for (let i = 0; i < 6; i++) this.tono(200 + Math.random() * 1800, 0.03, 0.02, i * 0.035, "square");
    this.ruido(0.12, 0.03, 3000, "highpass");
  }
  drenar() {
    this.barrido(1400, 120, 0.9, 0.03, "square");
    for (let i = 0; i < 8; i++) this.tono(1800 - i * 150, 0.04, 0.015, i * 0.1);
  }
  tension() {
    this.barrido(200, 900, 1.2, 0.02, "sawtooth");
  }
  cuenta(final = false) {
    this.tono(final ? 1320 : 660, final ? 0.25 : 0.1, 0.04);
  }
  estrella(i = 0) {
    this.tono(1046 * Math.pow(1.26, i), 0.12, 0.035);
    this.tono(1568 * Math.pow(1.26, i), 0.18, 0.025, 0.06);
  }
  logro() {
    [784, 988, 1175, 1568].forEach((f, i) => this.tono(f, 0.1, 0.035, i * 0.07));
    this.tono(2093, 0.3, 0.03, 0.3, "triangle");
  }
  nivel() {
    [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tono(f, 0.12, 0.04, i * 0.08));
    if (!this.silenciado && this.ctx) this.bombo(this.ctx.currentTime + 0.56, 0.1);
  }
  congelar() {
    [2400, 2000, 2600, 1800].forEach((f, i) => this.tono(f, 0.05, 0.02, i * 0.04, "triangle"));
    this.ruido(0.2, 0.03, 5000, "highpass");
  }

  // ── Efectos ──────────────────────────────────────────────

  blip() {
    this.tono(880, 0.03, 0.012);
  }
  mover() {
    this.tono(660, 0.04, 0.025);
  }
  confirmar() {
    this.tono(990, 0.05, 0.03);
    this.tono(1320, 0.06, 0.03, 0.05);
  }
  ring() {
    for (let i = 0; i < 8; i++) this.tono(i % 2 ? 1400 : 1100, 0.06, 0.035, i * 0.07);
  }
  exito() {
    [523, 659, 784, 1046].forEach((f, i) => this.tono(f, 0.14, 0.035, i * 0.09));
  }
  fallo() {
    [392, 330, 262, 196].forEach((f, i) => this.tono(f, 0.2, 0.035, i * 0.16, "triangle"));
  }
  golpe() {
    this.tono(140, 0.12, 0.05, 0, "sawtooth");
    this.tono(90, 0.15, 0.04, 0.04, "square");
  }
  monedas() {
    for (let i = 0; i < 6; i++) this.tono(1600 + i * 120, 0.05, 0.02, i * 0.05);
  }
  sello() {
    this.tono(220, 0.08, 0.06, 0, "square");
    this.tono(440, 0.12, 0.04, 0.05, "square");
  }
  acierto(combo = 0) {
    const base = 660 + Math.min(combo, 8) * 60;
    this.tono(base, 0.05, 0.03);
    this.tono(base * 1.5, 0.08, 0.03, 0.05);
  }
  error() {
    this.tono(160, 0.18, 0.05, 0, "sawtooth");
    this.tono(110, 0.22, 0.04, 0.08, "square");
  }
  tic() {
    this.tono(1200, 0.02, 0.015);
  }
  pisada() {
    this.tono(180, 0.02, 0.01, 0, "triangle");
  }
}
