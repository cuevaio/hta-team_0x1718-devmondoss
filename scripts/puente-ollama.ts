/**
 * Puente a Ollama: la app corre en Railway y el modelo en la Mac.
 *
 *   npm run puente-ollama                 # puente + túnel; imprime la URL y la clave
 *   npm run puente-ollama -- --railway    # además conecta Railway solo (y lo desconecta al cerrar)
 *
 * Qué hace:
 *   1. Un servidor en 127.0.0.1:11435 que reenvía a Ollama (127.0.0.1:11434)
 *      SOLO chat, carga y lista de modelos, y SOLO con la cabecera
 *      `x-puente-token` correcta. Ollama nunca queda abierto a internet (su
 *      API también permite bajar y borrar modelos).
 *   2. Un túnel rápido de Cloudflare hacia ese puente (URL pública).
 *   3. Precarga el modelo en memoria.
 *   4. Con `--railway`: pone en Railway OLLAMA_URL, OLLAMA_TOKEN, OLLAMA_MODELO
 *      y OLLAMA_THINK (un redeploy). Al cerrar con Ctrl+C borra OLLAMA_MODELO y
 *      OLLAMA_URL: Railway vuelve a agentes simulados (otro redeploy).
 *
 * Si la Mac se apaga o el túnel se cae con Railway conectado, no se rompe
 * nada: el cortacircuitos de los agentes pasa a reglas + memoria.
 *
 * Opciones: --modelo M (por defecto OLLAMA_MODELO o qwen3.5:9b), --puerto N,
 * --think false|low|… (por defecto false), --proyecto ID, --servicio S.
 *
 * Dueño: Tony_dev.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createServer, request, type IncomingMessage, type ServerResponse } from 'node:http';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';

const PROYECTO = 'fcc57ed2-badd-4342-a270-03ea1e8b9ba3';
const SERVICIO = 'web';
const OLLAMA = { host: '127.0.0.1', port: 11434 };
/** Lo único que pasa por el puente. */
const PERMITIDO: Record<string, string> = { 'POST /api/chat': '', 'POST /api/generate': '', 'GET /api/tags': '' };
const MAX_CUERPO = 2 * 1024 * 1024;

const arg = (n: string) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const conRailway = process.argv.includes('--railway');
const modelo = arg('--modelo') ?? process.env.OLLAMA_MODELO?.trim() ?? 'qwen3.5:9b';
const think = arg('--think') ?? 'false';
const puerto = Number(arg('--puerto') ?? 11435);
const proyecto = arg('--proyecto') ?? PROYECTO;
const servicio = arg('--servicio') ?? SERVICIO;
const token = process.env.PUENTE_TOKEN?.trim() || randomBytes(24).toString('base64url');

function claveValida(dada: string | string[] | undefined): boolean {
  if (typeof dada !== 'string') return false;
  const a = Buffer.from(dada);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

function puente(req: IncomingMessage, res: ServerResponse) {
  const ruta = `${req.method} ${(req.url ?? '').split('?')[0]}`;
  if (!(ruta in PERMITIDO)) {
    res.writeHead(404).end();
    return;
  }
  if (!claveValida(req.headers['x-puente-token'])) {
    res.writeHead(403).end();
    return;
  }
  let tam = 0;
  const destino = request(
    { ...OLLAMA, method: req.method, path: req.url, headers: { 'content-type': 'application/json' } },
    (r) => {
      res.writeHead(r.statusCode ?? 502, { 'content-type': r.headers['content-type'] ?? 'application/json' });
      r.pipe(res);
    },
  );
  destino.on('error', () => {
    if (!res.headersSent) res.writeHead(502);
    res.end(JSON.stringify({ error: 'Ollama no responde en la Mac' }));
  });
  req.on('data', (c: Buffer) => {
    tam += c.length;
    if (tam > MAX_CUERPO) {
      destino.destroy();
      if (!res.headersSent) res.writeHead(413);
      res.end();
      req.destroy();
    }
  });
  req.pipe(destino);
}

function cloudflared(): string | null {
  const r = spawnSync('which', ['cloudflared'], { encoding: 'utf8' });
  if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  const local = join(homedir(), '.local', 'bin', 'cloudflared');
  return existsSync(local) ? local : null;
}

function abrirTunel(local: string): Promise<{ url: string | null; proceso: ChildProcess | null }> {
  const bin = cloudflared();
  if (!bin) return Promise.resolve({ url: null, proceso: null });
  const proceso = spawn(bin, ['tunnel', '--no-autoupdate', '--url', local], { stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((ok) => {
    const t = setTimeout(() => ok({ url: null, proceso }), 30_000);
    const leer = (b: Buffer) => {
      const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(b.toString());
      if (m) {
        clearTimeout(t);
        ok({ url: m[0], proceso });
      }
    };
    proceso.stdout?.on('data', leer);
    proceso.stderr?.on('data', leer);
  });
}

function railway(args: string[]): boolean {
  const r = spawnSync('railway', [...args, '-p', proyecto, '-s', servicio, '-e', 'production'], { encoding: 'utf8' });
  if (r.status !== 0) console.error(`   ✗ railway ${args.slice(0, 2).join(' ')}: ${(r.stderr || r.stdout).trim().split('\n')[0]}`);
  return r.status === 0;
}

async function esperarTunel(url: string) {
  // El DNS del túnel nuevo tarda unos segundos en responder.
  for (let i = 0; i < 20; i++) {
    try {
      const r = await fetch(`${url}/api/tags`, { headers: { 'x-puente-token': token }, signal: AbortSignal.timeout(5000) });
      if (r.ok) return true;
    } catch {
      // todavía no
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

async function main() {
  // 1. Ollama local y el modelo
  try {
    const r = await fetch(`http://${OLLAMA.host}:${OLLAMA.port}/api/tags`, { signal: AbortSignal.timeout(3000) });
    const tags = (await r.json()) as { models?: Array<{ name: string }> };
    if (!tags.models?.some((m) => m.name === modelo || m.name === `${modelo}:latest`)) {
      throw new Error(`Ollama no tiene ${modelo}: corre  ollama pull ${modelo}`);
    }
  } catch (e) {
    throw new Error(e instanceof Error && e.message.startsWith('Ollama no tiene') ? e.message : 'Ollama no responde: abre la app de Ollama');
  }
  console.log(`▶ precargando ${modelo}…`);
  await fetch(`http://${OLLAMA.host}:${OLLAMA.port}/api/generate`, {
    method: 'POST',
    body: JSON.stringify({ model: modelo, prompt: '', keep_alive: '60m' }),
  }).catch(() => undefined);

  // 2. Puente con clave, solo en localhost (el túnel es lo único que lo publica)
  const servidor = createServer(puente);
  await new Promise<void>((ok, falla) => servidor.once('error', falla).listen(puerto, '127.0.0.1', () => ok()));

  // 3. Túnel
  const { url, proceso } = await abrirTunel(`http://127.0.0.1:${puerto}`);
  if (!url) throw new Error('no se pudo abrir el túnel de Cloudflare (¿cloudflared instalado?)');
  console.log('▶ esperando que el túnel responda…');
  if (!(await esperarTunel(url))) throw new Error(`el túnel ${url} no respondió`);

  const caffeinate = platform() === 'darwin' ? spawn('caffeinate', ['-i', '-w', String(process.pid)], { stdio: 'ignore' }) : null;

  // 4. Railway
  let conectado = false;
  if (conRailway) {
    console.log('▶ conectando Railway (un redeploy, ~1-2 min)…');
    conectado =
      railway(['variable', 'set', `OLLAMA_URL=${url}`, '--skip-deploys']) &&
      railway(['variable', 'set', `OLLAMA_TOKEN=${token}`, '--skip-deploys']) &&
      railway(['variable', 'set', `OLLAMA_THINK=${think}`, '--skip-deploys']) &&
      railway(['variable', 'set', `OLLAMA_MODELO=${modelo}`]);
  }

  console.log('\n────────────────────────────────────────────────────────────');
  console.log(` ✓ Puente a Ollama listo · modelo ${modelo}`);
  console.log(`   URL del puente: ${url}`);
  if (conRailway) {
    console.log(conectado ? '   ✓ Railway conectado: en 1-2 min el monitor dirá «agentes con modelo local»' : '   ✗ No se pudo conectar Railway: revisa `railway login`');
  } else {
    console.log('   Para conectar otra app, ponle estas variables:');
    console.log(`     OLLAMA_URL=${url}`);
    console.log(`     OLLAMA_TOKEN=${token}`);
    console.log(`     OLLAMA_MODELO=${modelo}`);
    console.log(`     OLLAMA_THINK=${think}`);
  }
  console.log('   ⚠ Conecta ANTES del demo: cada cambio de variables reinicia Railway (salas y casos en curso).');
  console.log('   Ctrl+C para cerrar' + (conRailway ? ' (Railway vuelve a agentes simulados).' : '.'));
  console.log('────────────────────────────────────────────────────────────\n');

  let cerrando = false;
  const cerrar = () => {
    if (cerrando) return;
    cerrando = true;
    if (conectado) {
      console.log('▶ desconectando Railway (vuelve a agentes simulados)…');
      railway(['variable', 'delete', 'OLLAMA_URL', '--skip-deploys']);
      railway(['variable', 'delete', 'OLLAMA_TOKEN', '--skip-deploys']);
      railway(['variable', 'delete', 'OLLAMA_MODELO']);
    }
    proceso?.kill();
    caffeinate?.kill();
    servidor.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', cerrar);
  process.on('SIGTERM', cerrar);
  proceso?.once('exit', () => {
    if (!cerrando) console.error('⚠ el túnel se cerró: Railway seguirá funcionando en modo degradado (reglas + memoria). Vuelve a correr el puente.');
  });
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
