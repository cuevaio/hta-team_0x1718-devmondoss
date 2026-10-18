/**
 * La laptop como servidor del demo (INFRA_Y_ORQUESTACION §4–5).
 *
 *   npm run servidor                      # localhost:3000, demo limpio
 *   npm run servidor -- --red --juego     # celulares por Wi-Fi + movimientos en vivo
 *   npm run servidor -- --tunel           # imprime el comando del túnel público
 *   npm run servidor -- --persistir       # Memoria y partidas sobreviven a un reinicio
 *
 * Opciones:
 *   --puerto N     puerto (por defecto 3000)
 *   --red          escucha en 0.0.0.0 (celulares en la misma red). Exige token.
 *   --tunel        imprime el comando de Cloudflare Tunnel. Exige token.
 *   --juego        MOVIMIENTOS_EN_VIVO=1 (DEMO_JUEGO §9)
 *   --persistir    guarda Memoria, partidas y arcade en .datos/ y NO reinicia al arrancar
 *   --sin-build    no corre `next build` (si ya está hecho)
 *
 * Por qué un servidor continuo y no serverless: el estado vive en RAM, y en un proceso
 * continuo la Memoria sobrevive todo el demo (el acto 3, Jorge, depende de eso).
 *
 * El script NO cambia la configuración del sistema ni instala nada: en macOS
 * usa `caffeinate` solo mientras corre; en otros sistemas avisa qué revisar.
 *
 * Dueño: Ale_dev.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'node:net';
import { networkInterfaces, platform } from 'node:os';
import { resolve } from 'node:path';

interface Opciones {
  puerto: number;
  red: boolean;
  tunel: boolean;
  juego: boolean;
  persistir: boolean;
  build: boolean;
}

export function leerOpciones(argv: string[]): Opciones {
  const i = argv.indexOf('--puerto');
  const puerto = i >= 0 ? Number(argv[i + 1]) : 3000;
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
    throw new Error(`--puerto inválido: ${argv[i + 1]}`);
  }
  return {
    puerto,
    red: argv.includes('--red'),
    tunel: argv.includes('--tunel'),
    juego: argv.includes('--juego'),
    persistir: argv.includes('--persistir'),
    build: !argv.includes('--sin-build'),
  };
}

/** Variables de entorno del servidor. Exponerlo fuera de localhost exige token. */
export function entornoServidor(o: Opciones, base: NodeJS.ProcessEnv = process.env) {
  const env: NodeJS.ProcessEnv = { ...base, NODE_ENV: 'production' };
  const expuesto = o.red || o.tunel;
  let tokenGenerado = false;
  if (expuesto && !env.DEMO_TOKEN?.trim()) {
    env.DEMO_TOKEN = randomBytes(12).toString('base64url');
    tokenGenerado = true;
  }
  if (o.juego) env.MOVIMIENTOS_EN_VIVO = '1';
  if (o.persistir) {
    env.MEMORIA_ARCHIVO ??= resolve('.datos/memoria.json');
    env.PARTIDAS_ARCHIVO ??= resolve('.datos/partidas.json');
    env.ARCADE_ARCHIVO ??= resolve('.datos/arcade.json');
  }
  return { env, expuesto, tokenGenerado };
}

function ipsLocales(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((n): n is NonNullable<typeof n> => Boolean(n) && n!.family === 'IPv4' && !n!.internal)
    .map((n) => n.address);
}

/**
 * Binario de Next para el build, lanzado con `node` directamente: sin shell ni
 * `npx` (con `shell: true` Node concatena los argumentos sin escaparlos).
 */
const NEXT_BIN = resolve('node_modules/next/dist/bin/next');

/** ¿Está libre el puerto? Si quedó un servidor anterior, mejor decirlo claro. */
export function puertoLibre(puerto: number, host: string): Promise<boolean> {
  return new Promise((ok) => {
    const s = createServer()
      .once('error', () => ok(false))
      .once('listening', () => s.close(() => ok(true)))
      .listen(puerto, host);
  });
}

/** ¿Sigue vivo el proceso? `kill(pid, 0)` no envía señal: solo comprueba. */
export function procesoVivo(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM: existe pero es de otro usuario → está vivo.
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}

async function esperarSalud(url: string, intentos = 60): Promise<Record<string, unknown>> {
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(`${url}/api/health`);
      if (r.ok) return (await r.json()) as Record<string, unknown>;
    } catch {
      // todavía arrancando
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`el servidor no respondió en ${url}/api/health`);
}

async function main() {
  const o = leerOpciones(process.argv.slice(2));
  const { env, expuesto, tokenGenerado } = entornoServidor(o);

  const [mayor] = process.versions.node.split('.').map(Number);
  if (mayor < 20) throw new Error(`Node ${process.versions.node}: se necesita 20 o más`);

  if (o.build) {
    console.log('▶ next build…');
    const b = spawnSync(process.execPath, [NEXT_BIN, 'build'], { stdio: 'inherit', env });
    if (b.status !== 0) throw new Error('next build falló');
  }

  const host = o.red ? '0.0.0.0' : '127.0.0.1';
  if (!(await puertoLibre(o.puerto, host))) {
    const liberar =
      platform() === 'win32'
        ? `netstat -ano | findstr :${o.puerto}   y luego   taskkill /PID <pid> /T /F`
        : `lsof -i :${o.puerto}   y luego   kill <pid>`;
    throw new Error(
      [
        `el puerto ${o.puerto} está ocupado. ¿Quedó un servidor anterior abierto?`,
        `  Para liberarlo: ${liberar}`,
        `  O usa otro: --puerto ${o.puerto + 1}`,
      ].join('\n'),
    );
  }
  // Next corre DENTRO de este proceso (API programática), no como hijo. En
  // Windows, si el padre muere de golpe, un hijo queda huérfano ocupando el
  // puerto: justo el escenario de «reiniciar a mitad del demo». Sin hijo, si
  // este proceso muere, el servidor muere con él.
  //
  // El entorno se fija ANTES de cargar Next: los módulos del servidor (Memoria,
  // movimientos en vivo, token) leen process.env al cargarse.
  Object.assign(process.env, env);
  console.log(`▶ next start en ${host}:${o.puerto} (en este proceso)`);
  const { default: next } = await import('next');
  const app = next({ dev: false, dir: process.cwd(), hostname: host, port: o.puerto });
  await app.prepare();
  const atender = app.getRequestHandler();
  const servidor = createHttpServer((req, res) => void atender(req, res));
  await new Promise<void>((ok, falla) => {
    servidor.once('error', falla);
    servidor.listen(o.puerto, host, () => ok());
  });

  let caffeinate: ChildProcess | null = null;
  if (platform() === 'darwin') {
    // Evita que la Mac se duerma mientras viva ESTE proceso (-w: hasta que muera el pid).
    caffeinate = spawn('caffeinate', ['-i', '-w', String(process.pid)], { stdio: 'ignore' });
  }

  const cerrar = () => {
    caffeinate?.kill();
    servidor.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on('SIGINT', cerrar);
  process.on('SIGTERM', cerrar);

  // Vigilante: si el proceso que nos lanzó (npm/npx/tsx, la terminal) muere de
  // golpe, en Windows este proceso quedaría vivo ocupando el puerto. Se cierra solo.
  const padre = process.ppid;
  setInterval(() => {
    if (!procesoVivo(padre)) {
      console.log('▶ el proceso que lanzó el servidor terminó: cerrando.');
      cerrar();
    }
  }, 2000).unref();

  const local = `http://localhost:${o.puerto}`;
  const salud = await esperarSalud(local);
  const token = env.DEMO_TOKEN?.trim();

  if (!o.persistir) {
    const r = await fetch(`${local}/api/demo/reset`, {
      method: 'POST',
      headers: token ? { 'x-demo-token': token } : {},
    });
    if (!r.ok) throw new Error(`reset falló (${r.status})`);
  }

  const modos = salud.modos as Record<string, boolean>;
  const memoria = salud.memoria as { veredictos: number };
  const conToken = (u: string) => (token ? `${u}/?token=${encodeURIComponent(token)}` : u);

  console.log('\n────────────────────────────────────────────────────────────');
  console.log(` ✓ Servidor listo · agentes: ${String(salud.agentes)}`);
  console.log(`   modos: ${JSON.stringify(modos)}`);
  console.log(o.persistir ? `   Memoria recuperada: ${memoria.veredictos} veredicto(s) (no se reinició)` : '   demo reiniciado: casos, Memoria y movimientos en cero');
  console.log(`\n   Consola del operador: ${conToken(local)}`);
  if (o.red) {
    console.log('   En la red (celulares) — usa la IP de tu Wi-Fi; las demás suelen ser adaptadores virtuales:');
    for (const ip of ipsLocales()) console.log(`     http://${ip}:${o.puerto}`);
  }
  if (token) {
    console.log(`\n   Token del operador${tokenGenerado ? ' (generado)' : ''}: ${token}`);
    console.log('   Solo el operador abre la consola con ?token=…: reiniciar y confirmar mulas lo exigen.');
  }
  if (o.tunel) {
    console.log('\n   URL pública (requiere cloudflared instalado):');
    console.log(`     cloudflared tunnel --url ${local}`);
  }
  if (expuesto) console.log('\n   ⚠ Expuesto fuera de esta máquina: no compartas el token.');
  if (platform() === 'win32') console.log('\n   Windows: enchufa la laptop y desactiva la suspensión mientras presentas.');
  console.log('   Ctrl+C para detener.');
  console.log('────────────────────────────────────────────────────────────\n');
}

// Solo corre al ejecutarlo como script, no al importarlo en los tests.
if (process.argv[1] && /servidor\.ts$/.test(process.argv[1])) {
  main().catch((e) => {
    console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  });
}
