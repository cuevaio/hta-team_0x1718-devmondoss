/**
 * La «verdad» de las cartas de los minijuegos que se pueden jugar en sala
 * (multijugador): qué carta es estafa (o transferencia riesgosa) y de qué
 * tipo. Los textos viven en el cliente (`components/juego2d/realOEstafa.ts`
 * y `pausaOPasa.ts`), adaptados al país; un test verifica que coincidan.
 *
 * Así el servidor de la sala califica las respuestas sin confiar en el
 * celular de cada jugador.
 *
 * Dueño: Tony_dev (demo jugable).
 */

export type JuegoSala = 'real_o_estafa' | 'pausa_o_pasa';

export type VerdadCarta = { id: string; categoria: string; estafa: boolean };

export const CARTAS_ROE: VerdadCarta[] = [
  { id: 'sms_bloqueo', categoria: 'link_falso', estafa: true },
  { id: 'llamada_codigo', categoria: 'falso_banco', estafa: true },
  { id: 'familiar_nuevo', categoria: 'falso_familiar', estafa: true },
  { id: 'captura_pago', categoria: 'comprobante_falso', estafa: true },
  { id: 'premio', categoria: 'premio_falso', estafa: true },
  { id: 'empleo_likes', categoria: 'empleo_falso', estafa: true },
  { id: 'inversion', categoria: 'inversion_falsa', estafa: true },
  { id: 'prestamo', categoria: 'prestamo_falso', estafa: true },
  { id: 'marketplace', categoria: 'marketplace', estafa: true },
  { id: 'whatsapp_codigo', categoria: 'robo_cuenta', estafa: true },
  { id: 'extorsion', categoria: 'extorsion', estafa: true },
  { id: 'soporte_remoto', categoria: 'soporte_falso', estafa: true },
  { id: 'romance', categoria: 'romance', estafa: true },
  { id: 'correo_clave', categoria: 'link_falso', estafa: true },
  { id: 'multa', categoria: 'link_falso', estafa: true },
  { id: 'accidente', categoria: 'falso_familiar', estafa: true },
  { id: 'pago_error', categoria: 'comprobante_falso', estafa: true },
  { id: 'clave_por_sms', categoria: 'falso_banco', estafa: true },
  { id: 'paquete', categoria: 'link_falso', estafa: true },
  { id: 'app_recibiste', categoria: 'real', estafa: false },
  { id: 'sms_compra', categoria: 'real', estafa: false },
  { id: 'mama_pan', categoria: 'real', estafa: false },
  { id: 'codigo_propio', categoria: 'real', estafa: false },
  { id: 'pepe_pedido', categoria: 'real', estafa: false },
  { id: 'hijo_llego', categoria: 'real', estafa: false },
  { id: 'app_sesion', categoria: 'real', estafa: false },
  { id: 'recibo_luz', categoria: 'real', estafa: false },
  { id: 'aviso_banco', categoria: 'real', estafa: false },
  { id: 'sueldo', categoria: 'real', estafa: false },
];

/** ¿PAUSA O PASA?: `estafa` = la transferencia es riesgosa (hay que pausarla). */
export const CARTAS_POP: VerdadCarta[] = [
  { id: 'llamada_todo', categoria: 'guardian', estafa: true },
  { id: 'celular_madrugada', categoria: 'guardian', estafa: true },
  { id: 'memoria_mula', categoria: 'memoria', estafa: true },
  { id: 'destino_extranos', categoria: 'detective', estafa: true },
  { id: 'chip_duplicado', categoria: 'guardian', estafa: true },
  { id: 'vacia_cuenta', categoria: 'guardian', estafa: true },
  { id: 'bodega', categoria: 'normal', estafa: false },
  { id: 'llamada_mama', categoria: 'normal', estafa: false },
  { id: 'celular_alquiler', categoria: 'normal', estafa: false },
  { id: 'luz', categoria: 'normal', estafa: false },
  { id: 'alto_alquiler', categoria: 'normal', estafa: false },
  { id: 'hotel_sin_senal', categoria: 'normal', estafa: false },
];

export const CARTAS: Record<JuegoSala, VerdadCarta[]> = {
  real_o_estafa: CARTAS_ROE,
  pausa_o_pasa: CARTAS_POP,
};
