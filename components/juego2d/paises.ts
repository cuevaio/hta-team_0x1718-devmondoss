/**
 * Contexto por país. La mecánica y las decisiones son las mismas (el motor
 * real); cambian los nombres, la moneda, los lugares y las modalidades
 * locales reportadas.
 *
 * Marcas: el banco y la billetera que «sufren» el fraude en el juego son
 * FICTICIOS (Banco Andino, ChaskiPay…). Las billeteras reales (Yape, Nequi,
 * Mercado Pago…) solo se nombran como contexto de cómo paga la gente, nunca
 * como la app que falla (docs/DEMO_JUEGO.md §8).
 */

export type { PaisJuego as PaisId } from "@/lib/juego/arcade";
import type { PaisJuego as PaisId } from "@/lib/juego/arcade";

export type Dato = { cifra: string; texto: string; fuente: string };

export type Pais = {
  id: PaisId;
  nombre: string;
  /** Franjas de la bandera (colores) y su orientación. */
  bandera: { colores: string[]; vertical: boolean };
  /** Montos del juego en PEN (lo que ve el motor) → moneda local. */
  factor: number;
  simbolo: string;
  /** Separador de miles de la moneda local. */
  miles: "," | ".";
  banco: string;
  billetera: string;
  /** Contexto real: cómo paga la gente. */
  billeterasReales: string;
  /** Versión corta para tarjetas (≤ 19 caracteres). */
  billeterasCortas: string;
  tienda: string;
  rosa: string;
  jorge: string;
  lucia: string;
  pepe: string;
  hijo: string;
  sierra: string;
  /** SMS falso de la ruta «sin señal». */
  smsFalso: string;
  /** Lo que dice el estafador en la llamada (ruta «la llamada»). */
  llamadaGancho: string;
  /** Comprobante falso (ruta «el comprobante»). */
  comprobante: string;
  defensaComprobante: string;
  /** Dato local para el epílogo (con fuente). Sin dato confiable, no se inventa. */
  datoLocal: Dato | null;
  /** Fuente de la modalidad local (para el epílogo). */
  modalidad: string;
};

export const PAISES: Record<PaisId, Pais> = {
  pe: {
    id: "pe",
    nombre: "PERÚ",
    bandera: { colores: ["#d91023", "#ffffff", "#d91023"], vertical: true },
    factor: 1,
    simbolo: "S/",
    miles: ",",
    banco: "Banco Andino",
    billetera: "ChaskiPay",
    billeterasReales: "Yape o Plin",
    billeterasCortas: "Yape · Plin",
    tienda: "BODEGA",
    rosa: "ROSA",
    jorge: "JORGE",
    lucia: "LUCÍA",
    pepe: "DON PEPE",
    hijo: "Kevin",
    sierra: "Choquequirao, Cusco",
    smsFalso: "Tu cuenta será bloqueada. Valida tus datos aquí: bit.ly/...",
    llamadaGancho: "Le hablamos del área de seguridad de Banco Andino.",
    comprobante: "¡Ya te yapeé, casera! Mira la captura.",
    defensaComprobante: "Revisa el pago en TU app, no en la captura. Yape hasta agregó un código de seguridad de 3 dígitos para eso.",
    datoLocal: { cifra: "19,602", texto: "denuncias por fraude informático en Perú, solo de enero a julio de 2026.", fuente: "Ministerio Público" },
    modalidad: "«Yape falso»: capturas falsas contra bodegas y boticas (prensa peruana, 2023-2025).",
  },
  co: {
    id: "co",
    nombre: "COLOMBIA",
    bandera: { colores: ["#fcd116", "#fcd116", "#003893", "#ce1126"], vertical: false },
    factor: 1050,
    simbolo: "$",
    miles: ".",
    banco: "Banco Cordillera",
    billetera: "Bolsillo",
    billeterasReales: "Nequi o Daviplata",
    billeterasCortas: "Nequi · Daviplata",
    tienda: "TIENDA",
    rosa: "DOÑA MARTA",
    jorge: "ANDRÉS",
    lucia: "VALENTINA",
    pepe: "DON HERNÁN",
    hijo: "Santi",
    sierra: "Ciudad Perdida, Sierra Nevada",
    smsFalso: "Tienes un pago pendiente por llave. Confírmalo aquí o se reversa: bit.ly/...",
    llamadaGancho: "Le hablamos del área de seguridad de Banco Cordillera.",
    comprobante: "¡Ya le pasé, vecina! Mire el comprobante.",
    defensaComprobante: "Revisa el pago en TU app, no en la captura: muchas billeteras tienen cómo verificar una transacción.",
    datoLocal: { cifra: "+64,000", texto: "denuncias por estafas digitales en Colombia en 2025.", fuente: "Centro Cibernético Policial, según prensa" },
    modalidad: "SMS de «pago pendiente» con enlace falso, usando el nombre de Bre-B (alertas de 2025-2026).",
  },
  mx: {
    id: "mx",
    nombre: "MÉXICO",
    bandera: { colores: ["#006847", "#ffffff", "#ce1126"], vertical: true },
    factor: 5,
    simbolo: "$",
    miles: ",",
    banco: "Banco Maguey",
    billetera: "Monedero Ya",
    billeterasReales: "transferencias SPEI o Mercado Pago",
    billeterasCortas: "SPEI · Mercado Pago",
    tienda: "ABARROTES",
    rosa: "DOÑA LUPE",
    jorge: "TOÑO",
    lucia: "XIMENA",
    pepe: "DON CHUY",
    hijo: "Beto",
    sierra: "Sierra Tarahumara",
    smsFalso: "Detectamos un cargo no reconocido. Cancélalo aquí: bit.ly/...",
    llamadaGancho: "Le llamo de Banco Maguey: tiene un cargo no reconocido.",
    comprobante: "¡Ya te transferí, güera! Aquí está el comprobante.",
    defensaComprobante: "Revisa el depósito en TU app o banca en línea, no en la foto del comprobante.",
    datoLocal: { cifra: "35,762", texto: "reclamaciones por posible fraude en México de enero a mayo de 2026 (+18% en la banca).", fuente: "CONDUSEF, según prensa" },
    modalidad: "Llamada del «ejecutivo» por un cargo no reconocido: de las vías más usadas (CONDUSEF, 2026).",
  },
  ar: {
    id: "ar",
    nombre: "ARGENTINA",
    bandera: { colores: ["#74acdf", "#ffffff", "#74acdf"], vertical: false },
    factor: 1000,
    simbolo: "$",
    miles: ".",
    banco: "Banco Pampa",
    billetera: "BilleYa",
    billeterasReales: "Mercado Pago, Ualá o Lemon",
    billeterasCortas: "Mercado Pago · Ualá",
    tienda: "ALMACÉN",
    rosa: "DOÑA ROSA",
    jorge: "MARTÍN",
    lucia: "SOFÍA",
    pepe: "DON TITO",
    hijo: "Nico",
    sierra: "El Chaltén, Patagonia",
    smsFalso: "Tu cuenta tiene un problema. Ingresá acá para no perderla: bit.ly/...",
    llamadaGancho: "Te llamo del soporte de BilleYa por una compra rara.",
    comprobante: "¡Ya te transferí, che! Fijate el comprobante.",
    defensaComprobante: "Revisá el ingreso en TU app, no en la captura.",
    datoLocal: { cifra: "34,468", texto: "denuncias por delitos informáticos en Argentina en 2024; 63% eran fraudes en línea.", fuente: "UFECI, según prensa" },
    modalidad: "Falsos operadores de billeteras que vacían cuentas con transferencias encadenadas (2026).",
  },
  cl: {
    id: "cl",
    nombre: "CHILE",
    bandera: { colores: ["#ffffff", "#d52b1e"], vertical: false },
    factor: 250,
    simbolo: "$",
    miles: ".",
    banco: "Banco Austral",
    billetera: "Monedero Sur",
    billeterasReales: "transferencias, MACH o Tenpo",
    billeterasCortas: "MACH · Tenpo",
    tienda: "ALMACÉN",
    rosa: "DOÑA ROSA",
    jorge: "PATRICIO",
    lucia: "JAVIERA",
    pepe: "DON LUCHO",
    hijo: "Benja",
    sierra: "Torres del Paine",
    smsFalso: "Su clave dinámica vence hoy. Actualícela aquí: bit.ly/...",
    llamadaGancho: "Le llamo de Banco Austral: necesitamos validar su clave dinámica.",
    comprobante: "¡Ya le transferí, vecina! Mire el comprobante.",
    defensaComprobante: "Revise el abono en SU app, no en la foto del comprobante.",
    datoLocal: { cifra: "20,880", texto: "reclamos por fraudes con bancos y retail financiero ante el Sernac en 2025.", fuente: "Sernac, según prensa" },
    modalidad: "El «cuento del tío» digital: una llamada que pide validar la clave dinámica (fallos de 2026).",
  },
  ec: {
    id: "ec",
    nombre: "ECUADOR",
    bandera: { colores: ["#ffdd00", "#ffdd00", "#034ea2", "#ed1c24"], vertical: false },
    factor: 0.27,
    simbolo: "$",
    miles: ",",
    banco: "Banco del Volcán",
    billetera: "PagaYa",
    billeterasReales: "transferencias o DeUna",
    billeterasCortas: "DeUna · transfer.",
    tienda: "TIENDA",
    rosa: "DOÑA CARMITA",
    jorge: "XAVIER",
    lucia: "DOMÉNICA",
    pepe: "DON GALO",
    hijo: "Mateo",
    sierra: "la laguna del Quilotoa",
    smsFalso: "Su cuenta fue bloqueada por seguridad. Reactívela aquí: bit.ly/...",
    llamadaGancho: "Le hablamos del área de seguridad de Banco del Volcán.",
    comprobante: "¡Ya le pasé, veci! Vea la captura.",
    defensaComprobante: "Revise el pago en SU app, no en la captura.",
    datoLocal: { cifra: "4,733", texto: "denuncias por apropiación fraudulenta por medios electrónicos en Ecuador, de enero a noviembre de 2025 (3,701 en 2024).", fuente: "Fiscalía, según prensa" },
    modalidad: "Retiros de cuentas «mientras la gente duerme», denunciados en 2026.",
  },
  bo: {
    id: "bo",
    nombre: "BOLIVIA",
    bandera: { colores: ["#d52b1e", "#f9e300", "#007934"], vertical: false },
    factor: 1.85,
    simbolo: "Bs",
    miles: ".",
    banco: "Banco Illimani",
    billetera: "QR Rápido",
    billeterasReales: "QR o transferencias",
    billeterasCortas: "QR · transfer.",
    tienda: "TIENDA",
    rosa: "DOÑA BETY",
    jorge: "MARCELO",
    lucia: "VALERIA",
    pepe: "DON RENÉ",
    hijo: "Joaquín",
    sierra: "el Salar de Uyuni",
    smsFalso: "Le habla su operador: confirme el código que le llegó para no perder su línea.",
    llamadaGancho: "Le hablamos de Banco Illimani: hay un movimiento sospechoso.",
    comprobante: "¡Ya le pagué por QR, caserita! Mire.",
    defensaComprobante: "Revise el abono en SU app, no en la foto del QR pagado.",
    datoLocal: { cifra: "16,821", texto: "denuncias de posibles estafas digitales en Bolivia, del 1 de enero al 17 de julio de 2026.", fuente: "ATT «Bloquea la Estafa», según prensa" },
    modalidad: "Falsa asistencia del operador para robar códigos, y ventas falsas de dólares pagadas por QR (2026).",
  },
  ve: {
    id: "ve",
    nombre: "VENEZUELA",
    bandera: { colores: ["#ffcc00", "#00247d", "#cf142b"], vertical: false },
    factor: 0.27,
    simbolo: "$",
    miles: ",",
    banco: "Banco Caribe Sur",
    billetera: "PagoYa",
    billeterasReales: "Pago Móvil o transferencias",
    billeterasCortas: "Pago Móvil",
    tienda: "BODEGA",
    rosa: "DOÑA CARMEN",
    jorge: "LUIS",
    lucia: "ANDREÍNA",
    pepe: "EL SEÑOR JOSÉ",
    hijo: "Samuel",
    sierra: "la Gran Sabana",
    smsFalso: "Tu Pago Móvil fue suspendido. Reactívalo aquí: bit.ly/...",
    llamadaGancho: "Le hablamos de Banco Caribe Sur: su cuenta tiene una operación rara.",
    comprobante: "¡Ya te hice el pago móvil, pana! Mira la captura.",
    defensaComprobante: "Revisa el pago en TU app, no en la captura: se edita en segundos.",
    datoLocal: { cifra: "+228%", texto: "subieron los fraudes digitales en Venezuela en 2025: el mayor aumento de la región.", fuente: "AppGate, según prensa" },
    modalidad: "Venta falsa de dólares «a buena tasa» por pago móvil que nunca se entregan.",
  },
  otro: {
    id: "otro",
    nombre: "OTRO PAÍS",
    bandera: { colores: ["#285ea8", "#65be83", "#f1b35b"], vertical: false },
    factor: 0.27,
    simbolo: "$",
    miles: ",",
    banco: "Banco Central del Sur",
    billetera: "MiBilletera",
    billeterasReales: "transferencias y billeteras digitales",
    billeterasCortas: "Billeteras",
    tienda: "TIENDA",
    rosa: "DOÑA ROSA",
    jorge: "JORGE",
    lucia: "LUCÍA",
    pepe: "DON PEPE",
    hijo: "Kevin",
    sierra: "la montaña",
    smsFalso: "Tu cuenta será bloqueada. Valida tus datos aquí: bit.ly/...",
    llamadaGancho: "Le hablamos del área de seguridad de su banco.",
    comprobante: "¡Ya te pagué! Mira la captura.",
    defensaComprobante: "Revisa el pago en TU app, no en la captura.",
    datoLocal: null,
    modalidad: "Las mismas estafas se repiten en toda la región: falso banco, falso familiar y comprobante falso.",
  },
};

/** Monto del juego (PEN) en la moneda del país, redondeado a algo creíble. */
export function dinero(pais: Pais, montoPen: number): string {
  const bruto = montoPen * pais.factor;
  const paso = bruto >= 1_000_000 ? 100_000 : bruto >= 10_000 ? 1_000 : bruto >= 1_000 ? 100 : 10;
  const valor = Math.round(bruto / paso) * paso;
  const texto = String(valor).replace(/\B(?=(\d{3})+(?!\d))/g, pais.miles);
  return `${pais.simbolo} ${texto}`;
}

/** Datos del epílogo: Perú (con fuente oficial), LATAM y el dato local. */
export function datosEpilogo(pais: Pais): Dato[] {
  const datos: Dato[] = [
    { cifra: "47%", texto: "de usuarios de finanzas digitales en Perú estuvo expuesto a fraude o estafas en un año.", fuente: "SBS y CGAP, 2025" },
    { cifra: "21%", texto: "de ellos perdió dinero.", fuente: "SBS y CGAP, 2025" },
    { cifra: "+155%", texto: "intentos de estafa por ingeniería social en bancos de Latinoamérica.", fuente: "BioCatch, 36 instituciones, 2025" },
    { cifra: "+42%", texto: "cuentas mula reportadas: cada robo necesita una cuenta que lo reciba.", fuente: "BioCatch, 2025" },
  ];
  if (pais.datoLocal) datos.push(pais.datoLocal);
  datos.push(
    { cifra: "S/ 10,000", texto: "Un cliente en Puno perdió una transferencia inusual. El banco dijo: «se autenticó bien». Indecopi le dio la razón al cliente: autenticar no exime de monitorear.", fuente: "Indecopi, julio 2026" },
    { cifra: "S/ 1,550", texto: "En Tarapoto, otra transferencia no reconocida: el banco es quien tiene que probar que fuiste tú.", fuente: "Indecopi, 2026" },
    { cifra: "31%", texto: "de la población de la región tiene cobertura móvil pero no usa internet móvil. Notificar no es proteger.", fuente: "GSMA" },
  );
  return datos;
}
