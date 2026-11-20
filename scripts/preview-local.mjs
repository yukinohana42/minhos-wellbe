import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { root } from './site-content.mjs';
import { safePath } from './site-files.mjs';

const configRoot = path.join(root, '.tmp', 'site');
const { basePath, mode } = JSON.parse(fs.readFileSync(path.join(configRoot, 'build.json'), 'utf8'));
if (mode !== 'review') throw new Error('Preview requires a review build.');
const publicRoot = path.join(configRoot, 'public');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp'
};

const server = http.createServer((request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  response.setHeader('Referrer-Policy', 'no-referrer');
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    if (pathname === '/' || pathname === basePath.slice(0, -1)) {
      response.writeHead(302, { Location: basePath }).end();
      return;
    }
    if (!pathname.startsWith(basePath) || !fs.existsSync(publicRoot)) {
      response.writeHead(404).end();
      return;
    }
    const file = safePath(publicRoot, pathname.slice(1) + (pathname.endsWith('/') ? 'index.html' : ''));
    const contentType = types[path.extname(file)];
    const stat = fs.statSync(file, { throwIfNoEntry: false });
    if (!contentType || !stat?.isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'Content-Type': contentType, 'Content-Length': stat.size });
    if (request.method === 'HEAD') response.end();
    else fs.createReadStream(file).on('error', () => response.destroy()).pipe(response);
  } catch {
    response.writeHead(404).end();
  }
});

server.on('listening', () => {
  console.log('Local: http://127.0.0.1:' + server.address().port + basePath);
});
let chosenPort = Number(process.env.WELLBE_PREVIEW_PORT ?? 4173);
server.on('error', (error) => {
  if (error.code !== 'EADDRINUSE' || chosenPort === 0) throw error;
  chosenPort = 0;
  server.listen(chosenPort, '127.0.0.1');
});
server.listen(chosenPort, '127.0.0.1');
