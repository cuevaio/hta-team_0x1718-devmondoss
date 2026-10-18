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

export type PaisId = "pe" | "co" | "mx" | "ar";

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
  /** Dato local para el epílogo. */
  datoLocal: Dato;
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
  datos.push(pais.datoLocal);
  datos.push(
    { cifra: "S/ 10,000", texto: "Un cliente en Puno perdió una transferencia inusual. El banco dijo: «se autenticó bien». Indecopi le dio la razón al cliente: autenticar no exime de monitorear.", fuente: "Indecopi, julio 2026" },
    { cifra: "S/ 1,550", texto: "En Tarapoto, otra transferencia no reconocida: el banco es quien tiene que probar que fuiste tú.", fuente: "Indecopi, 2026" },
    { cifra: "31%", texto: "de la población de la región tiene cobertura móvil pero no usa internet móvil. Notificar no es proteger.", fuente: "GSMA" },
  );
  return datos;
}
