/**
 * Sirve el pitch en http://localhost:4000 (otro puerto: PUERTO=5000 npm run pitch).
 * Sin dependencias: solo entrega los archivos de esta carpeta.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const carpeta = fileURLToPath(new URL('.', import.meta.url));
const puerto = Number(process.env.PUERTO ?? 4000);
const tipos = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

createServer(async (req, res) => {
  const ruta = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)).replace(/^[/\\]+/, '');
  const archivo = join(carpeta, ruta || 'index.html');
  // Solo archivos de esta carpeta y de los tipos del pitch.
  if (!archivo.startsWith(carpeta.endsWith(sep) ? carpeta : carpeta + sep) || !(extname(archivo) in tipos)) {
    res.writeHead(404).end();
    return;
  }
  try {
    const cuerpo = await readFile(archivo);
    res.writeHead(200, { 'Content-Type': tipos[extname(archivo)], 'Cache-Control': 'no-store' }).end(cuerpo);
  } catch {
    res.writeHead(404).end();
  }
}).listen(puerto, () => {
  console.log(`\n  Mule Zero · pitch → http://localhost:${puerto}\n  ← → para avanzar · F pantalla completa · Ctrl+C para cerrar\n`);
});
