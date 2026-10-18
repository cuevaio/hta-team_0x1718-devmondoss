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

type Pista = { bpm: number; melodia: string; bajo: string; tipo?: OscillatorType };

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
    this.paso = 0;
    this.proximo = this.ctx ? this.ctx.currentTime + 0.05 : 0;
  }

  private programar() {
    const c = this.ctx;
    const p = this.pista;
    if (!c || !p) return;
    const corchea = 60 / p.bpm / 2;
    if (this.proximo < c.currentTime) this.proximo = c.currentTime + 0.05;
    while (this.proximo < c.currentTime + 0.15) {
      if (!this.silenciado) {
        this.voz(p.melodia, this.paso, corchea, 0.022, p.tipo ?? "square");
        this.voz(p.bajo, this.paso, corchea, 0.045, "triangle");
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
  pisada() {
    this.tono(180, 0.02, 0.01, 0, "triangle");
  }
}
