import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { POST as registrar, GET as resumen, DELETE as borrar } from '@/app/api/juego/arcade/route';
import { RegistroArcade, arcade } from '@/lib/juego/arcade';

/** Modos arcade del juego: ranking, en qué estafas cae la gente y encuesta. */

const json = (method: string, cuerpo?: unknown) =>
  new Request('http://test/api/juego/arcade', {
    method,
    headers: { 'content-type': 'application/json' },
    ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
  });

const realOEstafa = (alias: string, puntaje: number, extra: Record<string, unknown> = {}) => ({
  modo: 'real_o_estafa',
  alias,
  pais: 'pe',
  puntaje,
  respuestas: [
    { carta: 'familiar_whatsapp', categoria: 'falso_familiar', estafa: true, dijo_estafa: false, ms: 2100 },
    { carta: 'banco_sms_link', categoria: 'link_falso', estafa: true, dijo_estafa: true, ms: 900 },
    { carta: 'real_mama', categoria: 'real', estafa: false, dijo_estafa: true, ms: 1500 },
  ],
  ...extra,
});

describe('/api/juego/arcade', () => {
  beforeEach(() => arcade.limpiar());
  afterEach(() => arcade.limpiar());

  it('registra una jugada y devuelve su posición en el ranking', async () => {
    const r1 = await registrar(json('POST', realOEstafa('Ana', 900)));
    expect(r1.status).toBe(201);
    expect((await r1.json()).posicion).toBe(1);
    const r2 = await registrar(json('POST', realOEstafa('Beto', 500)));
    expect((await r2.json()).posicion).toBe(2);
  });

  it('el ranking guarda el mejor puntaje de cada alias', async () => {
    await registrar(json('POST', realOEstafa('Ana', 300)));
    await registrar(json('POST', realOEstafa('ana', 1200)));
    await registrar(json('POST', realOEstafa('Beto', 800)));
    const r = await (await resumen(json('GET'))).json();
    expect(r.jugadas).toBe(3);
    expect(r.jugadores).toBe(2);
    expect(r.ranking.real_o_estafa.map((f: { puntaje: number }) => f.puntaje)).toEqual([1200, 800]);
  });

  it('calcula en qué estafas cae la gente y cuántos mensajes reales rechaza', async () => {
    await registrar(json('POST', realOEstafa('Ana', 300)));
    const r = await (await resumen(json('GET'))).json();
    const familiar = r.caidas.find((c: { categoria: string }) => c.categoria === 'falso_familiar');
    expect(familiar).toMatchObject({ vistas: 1, cayeron: 1, pct: 100 });
    expect(r.caidas[0].categoria).toBe('falso_familiar');
    expect(r.reales_rechazados_pct).toBe(100);
  });

  it('cuenta las respuestas de la encuesta de un toque', async () => {
    await registrar(json('POST', realOEstafa('Ana', 1, { encuesta: { vivido: 'cercano', espera: '5min' } })));
    await registrar(json('POST', realOEstafa('Beto', 1, { encuesta: { vivido: 'cercano' } })));
    const r = await (await resumen(json('GET'))).json();
    expect(r.encuesta.vivido).toEqual({ cercano: 2 });
    expect(r.encuesta.espera).toEqual({ '5min': 1 });
  });

  it('registra SIGUE EL DINERO', async () => {
    const r = await registrar(
      json('POST', { modo: 'sigue_el_dinero', alias: 'Det', pais: 'mx', puntaje: 4200, recuperado_pct: 70, falsos_positivos: 1, mulas: 3, segundos: 41 }),
    );
    expect(r.status).toBe(201);
    const s = await (await resumen(json('GET'))).json();
    expect(s.ranking.sigue_el_dinero[0]).toEqual({ alias: 'Det', pais: 'mx', puntaje: 4200 });
    expect(s.por_pais).toEqual({ mx: 1 });
  });

  it('registra ATRAPA LA MULA y ¿PAUSA O PASA?, y arma el ranking general', async () => {
    await registrar(json('POST', realOEstafa('Ana', 1000)));
    await registrar(json('POST', { modo: 'atrapa_la_mula', alias: 'Ana', pais: 'pe', puntaje: 2000, aciertos: 18, errores: 1, escapados: 3 }));
    await registrar(
      json('POST', {
        modo: 'pausa_o_pasa',
        alias: 'Beto',
        pais: 'co',
        puntaje: 2500,
        respuestas: [
          { carta: 'llamada_todo', categoria: 'guardian', estafa: true, dijo_estafa: false, ms: 3000 },
          { carta: 'bodega', categoria: 'normal', estafa: false, dijo_estafa: false, ms: 900 },
          { carta: 'llamada_mama', categoria: 'normal', estafa: false, dijo_estafa: true, ms: 1200 },
        ],
      }),
    );
    const r = await (await resumen(json('GET'))).json();
    expect(r.ranking.atrapa_la_mula[0].puntaje).toBe(2000);
    expect(r.ranking.pausa_o_pasa[0].alias).toBe('Beto');
    expect(r.general.map((f: { alias: string; puntaje: number }) => [f.alias, f.puntaje])).toEqual([
      ['Ana', 3000],
      ['Beto', 2500],
    ]);
    expect(r.pausa_o_pasa).toEqual({ riesgosas_pasadas_pct: 100, legitimas_pausadas_pct: 50 });
  });

  it('rechaza alias de contacto, respuestas de encuesta inventadas y texto libre', async () => {
    expect((await registrar(json('POST', realOEstafa('ana@correo.com', 1)))).status).toBe(400);
    expect((await registrar(json('POST', realOEstafa('Ana', 1, { encuesta: { vivido: 'quizas' } })))).status).toBe(400);
    expect((await registrar(json('POST', realOEstafa('Ana', 1, { encuesta: { comentario: 'hola' } })))).status).toBe(400);
    expect((await registrar(json('POST', realOEstafa('Ana', 1, { pais: 'cl' })))).status).toBe(400);
    expect(arcade.cantidad).toBe(0);
  });

  it('DELETE borra todo', async () => {
    await registrar(json('POST', realOEstafa('Ana', 1)));
    expect((await borrar(json('DELETE'))).status).toBe(200);
    expect(arcade.cantidad).toBe(0);
  });
});

describe('RegistroArcade con archivo', () => {
  it('sobrevive a un reinicio del proceso', () => {
    const dir = mkdtempSync(join(tmpdir(), 'arcade-'));
    try {
      const archivo = join(dir, 'sub', 'arcade.json');
      const a = new RegistroArcade(archivo);
      a.registrar({ modo: 'sigue_el_dinero', alias: 'X', pais: 'pe', puntaje: 10, recuperado_pct: 0, falsos_positivos: 0, mulas: 0, segundos: 5 });
      const b = new RegistroArcade(archivo);
      expect(b.cantidad).toBe(1);
      expect(b.resumen().ranking.sigue_el_dinero[0].alias).toBe('X');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
