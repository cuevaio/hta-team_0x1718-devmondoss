import type { Boton, Motor } from "./motor";
import { dinero, type Pais } from "./paises";
import { PAL, Pincel, W, envolver, facil, type Caja } from "./pincel";

/**
 * ¿REAL O ESTAFA? — arcade de 45 segundos: llegan mensajes, llamadas y
 * capturas; el jugador decide rápido. Combo, vidas y ranking.
 *
 * Cada respuesta es un dato: en qué estafas cae la gente y cuántos mensajes
 * reales rechaza (el costo de desconfiar de todo). Los mensajes son
 * modalidades públicas y reportadas, sin guiones operativos; los bancos y
 * billeteras que aparecen son los ficticios del país.
 */

type Canal = "SMS" | "WHATSAPP" | "LLAMADA" | "CORREO" | "APP" | "CHAT" | "CAPTURA";

export type Carta = {
  id: string;
  categoria: string;
  estafa: boolean;
  canal: Canal;
  de: string;
  texto: string;
  pista: string;
};

export const NOMBRE_CATEGORIA: Record<string, string> = {
  link_falso: "el link falso",
  falso_banco: "el falso banco",
  falso_familiar: "el falso familiar",
  comprobante_falso: "el comprobante falso",
  premio_falso: "el premio falso",
  empleo_falso: "el trabajo falso",
  inversion_falsa: "la inversión milagro",
  prestamo_falso: "el préstamo falso",
  marketplace: "el comprador falso",
  robo_cuenta: "el código de WhatsApp",
  extorsion: "la extorsión",
  soporte_falso: "el falso soporte",
  romance: "el amor por internet",
};

const COLOR_CANAL: Record<Canal, string> = {
  SMS: PAL.azul,
  WHATSAPP: "#2f9e5c",
  LLAMADA: PAL.rojoOscuro,
  CORREO: PAL.violeta,
  APP: PAL.navy,
  CHAT: "#b0569b",
  CAPTURA: PAL.ambarOscuro,
};

export function mazo(pais: Pais): Carta[] {
  const $ = (n: number) => dinero(pais, n);
  const { banco, billetera, hijo, pepe } = pais;
  const e = (id: string, categoria: string, canal: Canal, de: string, texto: string, pista: string): Carta => ({ id, categoria, estafa: true, canal, de, texto, pista });
  const r = (id: string, canal: Canal, de: string, texto: string, pista: string): Carta => ({ id, categoria: "real", estafa: false, canal, de, texto, pista });
  return [
    e("sms_bloqueo", "link_falso", "SMS", "Número desconocido", `${banco}: tu cuenta será BLOQUEADA hoy. Valida tus datos aquí: bit.ly/val1da`, "Tu banco no te manda links para validar datos. Entra solo desde tu app."),
    e("llamada_codigo", "falso_banco", "LLAMADA", `Seguridad ${banco}`, "Detectamos un consumo raro. Para anularlo, dígame el código que le acaba de llegar.", "Nadie del banco te pide códigos ni claves. Cuelga y llama tú."),
    e("familiar_nuevo", "falso_familiar", "WHATSAPP", "Número nuevo", `Hola, soy ${hijo}. Cambié de número. ¿Me pasas ${$(800)} urgente? Mañana te devuelvo.`, "Llama al número DE SIEMPRE antes de mandar dinero."),
    e("captura_pago", "comprobante_falso", "CAPTURA", "Cliente apurado", `¡Ya te pagué ${$(250)} por ${billetera}! Mira la captura y dame rápido.`, "Revisa el pago en TU app. Una captura se edita en segundos."),
    e("premio", "premio_falso", "SMS", "Sorteo", `¡FELICIDADES! Ganaste un celular con ${billetera}. Paga ${$(30)} de envío: bit.ly/prem10`, "Si para cobrar un premio tienes que pagar, no ganaste nada."),
    e("empleo_likes", "empleo_falso", "WHATSAPP", "Reclutadora", `Trabajo desde casa: gana ${$(200)} al día dando likes. Deposita ${$(50)} para activar.`, "Ningún trabajo real te cobra por empezar."),
    e("inversion", "inversion_falsa", "CHAT", "Asesor cripto", "Duplica tu dinero en 7 días GARANTIZADO. Quedan 3 cupos: invierte HOY.", "Ganancia garantizada + prisa = estafa."),
    e("prestamo", "prestamo_falso", "SMS", "Préstamos Ya", `Préstamo APROBADO de ${$(3000)} sin revisar tu historial. Paga ${$(90)} de seguro para liberarlo.`, "Un préstamo real no te cobra por adelantado."),
    e("marketplace", "marketplace", "CHAT", "Comprador", "Quiero tu bici. Te llegará un código por SMS: pásamelo para confirmar el pago.", "Ese código es para entrar a TU cuenta. Nunca lo compartas."),
    e("whatsapp_codigo", "robo_cuenta", "WHATSAPP", "Amiga Carla", "¡Hola! Te llegó un código mío por error, ¿me lo reenvías? Es urgente.", "A tu amiga le robaron el WhatsApp. Ahora van por el tuyo."),
    e("extorsion", "extorsion", "WHATSAPP", "Cobranzas", "Tienes una deuda. Si no pagas HOY, enviamos tus fotos a todos tus contactos.", "Es extorsión: no pagues, guarda pruebas y denuncia."),
    e("soporte_remoto", "soporte_falso", "LLAMADA", `Soporte ${billetera}`, "Vimos una compra rara. Instale esta app para que le ayudemos a anularla.", "Nadie de soporte te pide instalar apps: con eso controlan tu celular."),
    e("romance", "romance", "CHAT", "Match de la app", "Mi amor, estoy varado en el aeropuerto. ¿Me prestas para la multa? Te devuelvo al llegar.", "Amor por internet que te pide dinero: alerta roja."),
    e("correo_clave", "link_falso", "CORREO", "seguridad-banco.net", "Actualiza tu clave en 24 horas o perderás tu cuenta: [ACTUALIZAR AQUÍ]", "Mira el remitente y la amenaza: es phishing."),
    e("multa", "link_falso", "SMS", "Tránsito", "Tienes una multa. Págala HOY con 50% de descuento: bit.ly/mult4", "Las multas se consultan en la web oficial, no en un link."),
    e("accidente", "falso_familiar", "LLAMADA", "Número desconocido", `Su hijo tuvo un accidente. Deposite ${$(1500)} para la clínica, ¡ahora!`, "Cuelga y llama a tu familiar. El susto es su herramienta."),
    r("app_recibiste", "APP", billetera, `Recibiste ${$(25)} de Ana M. por «almuerzo».`, "Un aviso de tu app que no te pide nada: era real."),
    r("sms_compra", "SMS", banco, `Compra por ${$(38)} en Supermercado. Si no la reconoces, llama al número detrás de tu tarjeta.`, "Te manda al número oficial, no a un link: era real."),
    r("mama_pan", "WHATSAPP", "Mamá", "Hijito, ¿compras pan al venir? Gracias.", "Tu contacto de siempre, sin dinero ni prisa: era real."),
    r("codigo_propio", "SMS", banco, "Tu código es 482911 para la operación que TÚ iniciaste. No lo compartas con nadie.", "Un código que tú pediste es normal. Compartirlo, nunca."),
    r("pepe_pedido", "LLAMADA", pepe, "¡Buenas! Ya llegó tu pedido. ¿Te lo mando mañana temprano?", "Tu proveedor de siempre, sin pedir nada raro: era real."),
    r("hijo_llego", "WHATSAPP", hijo, "Ya llegué a casa. Buenas noches.", "Su número de siempre y nada de dinero: era real."),
    r("app_sesion", "APP", banco, "Iniciaste sesión en un equipo nuevo. Si no fuiste tú, revísalo aquí en la app.", "Un aviso dentro de tu app oficial: era real."),
    r("recibo_luz", "CORREO", "Empresa de luz", "Tu recibo del mes ya está disponible. Págalo en tu app o banco de siempre.", "Te informa y te manda a tus canales de siempre: era real."),
  ];
}

export type Respuesta = { carta: string; categoria: string; estafa: boolean; dijo_estafa: boolean; ms: number };

export type ResultadoROE = {
  puntaje: number;
  aciertos: number;
  total: number;
  mejorCombo: number;
  vidas: number;
  respuestas: Respuesta[];
  /** Categorías de estafa en las que cayó (sin repetir). */
  caidas: string[];
  realesRechazados: number;
};

const SEGUNDOS = 45;
const VIDAS = 3;
const CORAZON = [".XX.XX.", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."];

function barajar<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Fase = "cuenta" | "juego" | "bien" | "mal" | "fin";

export function realOEstafa(m: Motor, pais: Pais): Promise<ResultadoROE> {
  // Primero una estafa fácil; después, al azar.
  const todas = mazo(pais);
  const primera = todas.find((c) => c.id === "sms_bloqueo")!;
  const cartas = [primera, ...barajar(todas.filter((c) => c !== primera))];

  let fase: Fase = "cuenta";
  let inicioFase = m.t;
  let idx = 0;
  let restante = SEGUNDOS * 60;
  let vidas = VIDAS;
  let puntaje = 0;
  let mostrado = 0;
  let combo = 0;
  let mejorCombo = 0;
  let aparecio = m.t;
  let salida = 0;
  let ultimoPuntos = "";
  let ultimaCarta: Carta | null = null;
  let presionado: "estafa" | "real" | null = null;
  const respuestas: Respuesta[] = [];

  const botones = (h: number): { estafa: Caja; real: Caja } => ({
    estafa: { x: 8, y: h - 60, w: 84, h: 48 },
    real: { x: 100, y: h - 60, w: 84, h: 48 },
  });
  /** La carta mide lo que su texto; con la pista abierta, sube para dejarle lugar. */
  const cajaCarta = (h: number, carta?: Carta, conPista = false): Caja => {
    const arriba = 36;
    const abajo = h - 70;
    const lineas = carta ? envolver(carta.texto, 19).length : 6;
    const alto = Math.min(abajo - arriba, 56 + lineas * 12 + (carta?.canal === "CAPTURA" ? 32 : 0));
    const pista = conPista && carta ? 36 + envolver(carta.pista, 19).slice(0, 4).length * 11 : 0;
    const libre = abajo - arriba - alto - pista;
    return { x: 12, y: arriba + Math.max(0, Math.round(libre / (conPista ? 3 : 2))), w: W - 24, h: alto };
  };

  let resolver: (r: ResultadoROE) => void = () => {};
  const terminado = new Promise<ResultadoROE>((r) => (resolver = r));

  const cambiar = (f: Fase) => {
    fase = f;
    inicioFase = m.t;
  };

  const terminar = () => {
    cambiar("fin");
    m.musica(null);
    m.audio.boom();
    window.setTimeout(() => {
      m.minijuego(null);
      const caidas = [...new Set(respuestas.filter((r) => r.estafa && !r.dijo_estafa).map((r) => r.categoria))];
      resolver({
        puntaje,
        aciertos: respuestas.filter((r) => r.estafa === r.dijo_estafa).length,
        total: respuestas.length,
        mejorCombo,
        vidas,
        respuestas,
        caidas,
        realesRechazados: respuestas.filter((r) => !r.estafa && r.dijo_estafa).length,
      });
    }, 1600);
  };

  const siguiente = () => {
    idx++;
    if (vidas <= 0 || restante <= 0) return terminar();
    if (idx >= cartas.length) {
      const bono = Math.floor(restante / 60) * 20;
      puntaje += bono;
      m.flotante(`+${bono} TIEMPO`, 40, 120, PAL.ambar);
      return terminar();
    }
    aparecio = m.t;
    cambiar("juego");
  };

  const responder = (dijoEstafa: boolean) => {
    if (fase !== "juego") return;
    const carta = cartas[idx];
    const ms = Math.round(((m.t - aparecio) * 1000) / 60);
    respuestas.push({ carta: carta.id, categoria: carta.categoria, estafa: carta.estafa, dijo_estafa: dijoEstafa, ms });
    ultimaCarta = carta;
    salida = dijoEstafa ? -1 : 1;
    presionado = dijoEstafa ? "estafa" : "real";
    window.setTimeout(() => (presionado = null), 120);
    const caja = cajaCarta(m.h, carta);
    if (dijoEstafa === carta.estafa) {
      combo++;
      mejorCombo = Math.max(mejorCombo, combo);
      const mult = Math.min(4, 1 + Math.floor(combo / 3));
      const rapido = ms < 2500 ? 50 : 0;
      const ganados = 100 * mult + rapido;
      puntaje += ganados;
      ultimoPuntos = `+${ganados}${mult > 1 ? ` x${mult}` : ""}`;
      m.audio.acierto(combo);
      m.vibrar(10);
      m.particulas_(W / 2, caja.y + caja.h / 2, 18, { colores: [PAL.verde, PAL.blanco, PAL.ambar], vel: 2, g: 0.05, vida: 30 });
      if (combo > 0 && combo % 3 === 0) m.flotante(`COMBO x${mult}!`, 54, caja.y + 20, PAL.ambar);
      cambiar("bien");
    } else {
      combo = 0;
      m.audio.error();
      m.vibrar([60, 40, 90]);
      m.sacudir(14);
      m.destello = 6;
      if (carta.estafa) vidas--;
      else restante = Math.max(0, restante - 5 * 60);
      cambiar("mal");
    }
  };

  const tocar = (x: number, y: number) => {
    if (fase === "mal") {
      if (m.t - inicioFase > 24) siguiente();
      return;
    }
    if (fase !== "juego") return;
    const b = botones(m.h);
    const en = (c: Caja) => x >= c.x - 4 && x < c.x + c.w + 4 && y >= c.y - 6 && y < c.y + c.h + 6;
    if (en(b.estafa)) responder(true);
    else if (en(b.real)) responder(false);
  };

  const tecla = (bt: Boton) => {
    if (bt === "izq") responder(true);
    else if (bt === "der") responder(false);
    else if (bt === "a" && fase === "mal" && m.t - inicioFase > 24) siguiente();
  };

  const dibujar = (p: Pincel, t: number) => {
    const h = p.h;
    const f = t - inicioFase;
    // ── lógica por cuadro ──
    if (fase === "cuenta") {
      if (f % 45 === 0 && f < 135) m.audio.cuenta(false);
      if (f >= 150) {
        m.audio.cuenta(true);
        aparecio = t;
        m.musica("arcade");
        cambiar("juego");
      }
    } else if (fase === "juego") {
      restante--;
      if (restante === 600) m.audio.ritmo = 1.2;
      if (restante <= 600 && restante % 45 === 0) m.audio.latido();
      if (restante <= 0) {
        restante = 0;
        terminar();
      }
    } else if (fase === "bien" && f >= 12) {
      siguiente();
    } else if (fase === "mal" && f >= 240) {
      siguiente();
    }
    mostrado += Math.ceil((puntaje - mostrado) / 6);

    // ── fondo ──
    p.degradado(0, h, "#141a3a", "#2a1240");
    const vel = fase === "juego" ? 1 + (SEGUNDOS * 60 - restante) / 900 : 1;
    for (let i = 0; i < 12; i++) {
      const y = (i * 34 + t * vel) % (h + 34) - 34;
      p.alfa(0.12, () => p.rect(PAL.celeste, 0, Math.round(y), W, 1));
    }
    for (let x = 16; x < W; x += 32) p.alfa(0.08, () => p.rect(PAL.celeste, x, 0, 1, h));

    // ── HUD ──
    p.textoSombra(`${String(mostrado).padStart(5, "0")}`, 6, 5, PAL.ambar, PAL.tinta);
    if (combo >= 2) p.textoSombra(`x${Math.min(4, 1 + Math.floor(combo / 3))}`, 52, 5, combo >= 3 ? PAL.verde : PAL.crema, PAL.tinta);
    for (let i = 0; i < VIDAS; i++) {
      const lleno = i < vidas;
      const latido = lleno && fase === "juego" && Math.floor(t / 30) % 2 === 0 && vidas === 1 ? 1 : 0;
      p.sprite(CORAZON, { X: lleno ? PAL.rojo : "#4a4560" }, 128 + i * 11 - latido, 6 - latido, 1);
    }
    const k = restante / (SEGUNDOS * 60);
    const colorTiempo = k > 0.5 ? PAL.verde : k > 0.2 ? PAL.ambar : PAL.rojo;
    p.barra(6, 20, W - 12, k, colorTiempo);
    p.texto(`${Math.ceil(restante / 60)}s`, W - 30, 27, k > 0.2 ? PAL.grisClaro : PAL.rojo);

    // ── carta ──
    const actual = fase === "bien" || fase === "mal" ? (ultimaCarta ?? undefined) : cartas[idx];
    const caja = fase === "cuenta" || fase === "fin" ? { x: 12, y: 50, w: W - 24, h: Math.min(200, h - 130) } : cajaCarta(h, actual, fase === "mal");
    if (fase === "cuenta") {
      const n = 3 - Math.floor(f / 45);
      const texto = n > 0 ? String(n) : "¡YA!";
      const kk = (f % 45) / 45;
      p.centrado("¿REAL O ESTAFA?", caja.y + 10, PAL.crema, 8, PAL.tinta);
      p.centrado("Decide rápido.", caja.y + 30, PAL.grisClaro);
      p.escalado(W / 2, caja.y + caja.h / 2, 1 + (1 - facil.salida(kk)) * 1.5, () => p.centrado(texto, caja.y + caja.h / 2 - 8, PAL.ambar, 16, PAL.tinta));
      p.centrado("ESTAFA = izquierda", caja.y + caja.h - 30, PAL.rojo);
      p.centrado("REAL = derecha", caja.y + caja.h - 16, PAL.verde);
    } else if (fase === "fin") {
      p.escalado(W / 2, caja.y + caja.h / 2, 1 + Math.max(0, 1 - f / 10), () => {
        p.centrado(vidas <= 0 ? "¡SIN VIDAS!" : "¡TIEMPO!", caja.y + caja.h / 2 - 20, vidas <= 0 ? PAL.rojo : PAL.ambar, 16, PAL.tinta);
      });
      p.centrado(`${puntaje} PUNTOS`, caja.y + caja.h / 2 + 8, PAL.crema, 8, PAL.tinta);
    } else {
      // carta que se va
      if (fase === "bien" && ultimaCarta) {
        const kk = Math.min(1, f / 12);
        p.alfa(1 - kk, () => dibujarCarta(p, { ...caja, x: caja.x + salida * Math.round(facil.salida(kk) * 160) }, ultimaCarta!, salida * kk * 0.3));
        p.centrado(ultimoPuntos, caja.y - 2 - Math.round(kk * 10), PAL.verde, 8, PAL.tinta);
      }
      if (fase === "juego") {
        const kk = Math.min(1, (t - aparecio) / 10);
        dibujarCarta(p, { ...caja, y: caja.y - Math.round((1 - facil.salida(kk)) * 30) }, cartas[idx], 0, kk);
      }
      if (fase === "mal" && ultimaCarta) {
        dibujarCarta(p, caja, ultimaCarta, 0);
        const c = ultimaCarta;
        const lineas = envolver(c.pista, 19).slice(0, 4);
        const alto = 30 + lineas.length * 11;
        const y = Math.min(caja.y + caja.h + 4, h - 70 - alto - 12);
        p.caja(8, y, W - 16, alto, PAL.crema, PAL.tinta, c.estafa ? PAL.rojo : PAL.verde);
        p.texto(c.estafa ? "¡ERA ESTAFA!" : "¡ERA REAL!", 16, y + 7, c.estafa ? PAL.rojoOscuro : PAL.verdeOscuro);
        if (c.estafa) p.texto("-1", W - 34, y + 7, PAL.rojo);
        else p.texto("-5s", W - 42, y + 7, PAL.rojo);
        lineas.forEach((l, i) => p.texto(l, 16, y + 20 + i * 11, PAL.tinta));
        if (f > 24 && Math.floor(f / 20) % 2 === 0) p.centrado("toca para seguir", y + alto + 3, PAL.crema, 8, PAL.tinta);
      }
    }

    // ── botones ──
    const b = botones(h);
    const activos = fase === "juego";
    p.alfa(activos ? 1 : 0.5, () => {
      p.boton(b.estafa, "", { color: "#f4c7c3", presionado: presionado === "estafa" });
      p.boton(b.real, "", { color: "#bfe8c9", presionado: presionado === "real" });
      const d1 = presionado === "estafa" ? 2 : 0;
      const d2 = presionado === "real" ? 2 : 0;
      // X
      for (let i = 0; i < 12; i++) {
        p.rect(PAL.rojoOscuro, b.estafa.x + 36 + i, b.estafa.y + 8 + i + d1, 3, 2);
        p.rect(PAL.rojoOscuro, b.estafa.x + 47 - i, b.estafa.y + 8 + i + d1, 3, 2);
      }
      // ✓
      for (let i = 0; i < 5; i++) p.rect(PAL.verdeOscuro, b.real.x + 34 + i, b.real.y + 14 + i + d2, 3, 2);
      for (let i = 0; i < 10; i++) p.rect(PAL.verdeOscuro, b.real.x + 39 + i, b.real.y + 18 - i + d2, 3, 2);
      p.centrado("ESTAFA", b.estafa.y + 30 + d1, PAL.tinta, 8, undefined, b.estafa.x, b.estafa.w);
      p.centrado("REAL", b.real.y + 30 + d2, PAL.tinta, 8, undefined, b.real.x, b.real.w);
    });
  };

  const info = () => ({ fase, estafa: cartas[idx]?.estafa ?? null, botones: botones(m.h) });
  m.minijuego({ dibujar, tocar, tecla, info });
  return terminado;
}

/** Una notificación del celular: canal, remitente y mensaje. También la usa la sala EN VIVO. */
export function dibujarCarta(p: Pincel, c: Caja, carta: Carta, giro = 0, aparicion = 1) {
  const draw = () => {
    p.alfa(0.4, () => p.rect(PAL.negro, c.x + 3, c.y + 5, c.w, c.h));
    p.rect(PAL.tinta, c.x, c.y, c.w, c.h);
    p.rect(PAL.crema, c.x + 2, c.y + 2, c.w - 4, c.h - 4);
    const color = COLOR_CANAL[carta.canal];
    p.rect(color, c.x + 2, c.y + 2, c.w - 4, 16);
    p.texto(carta.canal, c.x + 8, c.y + 6, PAL.blanco);
    if (carta.canal === "LLAMADA") {
      const ring = Math.floor(Date.now() / 150) % 2;
      p.rect(PAL.blanco, c.x + c.w - 18, c.y + 6 - ring, 8, 8);
      p.rect(color, c.x + c.w - 16, c.y + 8 - ring, 4, 4);
    }
    p.texto(carta.de.slice(0, 19), c.x + 8, c.y + 24, PAL.gris);
    p.rect(PAL.grisClaro, c.x + 8, c.y + 35, c.w - 16, 1);
    const lineas = envolver(carta.texto, 19).slice(0, Math.floor((c.h - 50) / 12));
    // burbuja del mensaje
    const altoBurbuja = lineas.length * 12 + 10;
    p.rect("#ffffff", c.x + 6, c.y + 40, c.w - 12, altoBurbuja);
    p.rect(PAL.grisClaro, c.x + 6, c.y + 40 + altoBurbuja, c.w - 12, 1);
    lineas.forEach((l, i) => p.texto(l, c.x + 10, c.y + 46 + i * 12, PAL.tinta));
    if (carta.canal === "CAPTURA") {
      const y = c.y + 46 + altoBurbuja;
      if (y + 30 < c.y + c.h) {
        p.rect(PAL.verde, c.x + 40, y, c.w - 80, 26);
        p.centrado("PAGO OK", y + 9, PAL.blanco, 8, undefined, c.x + 40, c.w - 80);
      }
    }
  };
  if (giro !== 0 || aparicion < 1) {
    p.alfa(aparicion, () => {
      const ctx = p.ctx;
      ctx.save();
      ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
      ctx.rotate(giro);
      ctx.translate(-(c.x + c.w / 2), -(c.y + c.h / 2));
      draw();
      ctx.restore();
    });
  } else draw();
}
