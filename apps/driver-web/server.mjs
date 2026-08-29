import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join, normalize } from 'path';
import { fileURLToPath } from 'url';
import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import net from 'net';
import tls from 'tls';

const PORT = process.env.PORT ?? 3300;

// API target: prefer a full API_URL (http or https), else API_HOST/API_PORT (http).
let apiProto = 'http';
let apiHost = process.env.API_HOST ?? '127.0.0.1';
let apiPort = Number(process.env.API_PORT ?? 3000);
if (process.env.API_URL) {
  const u = new URL(process.env.API_URL);
  apiProto = u.protocol.replace(':', '');
  apiHost = u.hostname;
  apiPort = u.port ? Number(u.port) : (apiProto === 'https' ? 443 : 80);
}

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'public');

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  if (req.url.startsWith('/api')) {
    const opts = {
      host: apiHost,
      port: apiPort,
      method: req.method,
      path: req.url,
      headers: req.headers,
    };
    const proxyReq = (apiProto === 'https' ? httpsRequest : httpRequest)(opts, (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', () => {
      if (!res.headersSent) res.writeHead(502).end('Bad gateway');
    });
    req.pipe(proxyReq);
    return;
  }

  let path = '/';
  try {
    path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {}
  if (path === '/') path = '/index.html';

  const file = normalize(join(root, path));
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }

  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    try {
      const body = await readFile(join(root, 'index.html'));
      res.writeHead(200, { 'Content-Type': types['.html'] });
      res.end(body);
    } catch {
      res.writeHead(404).end('Not found');
    }
  }
});

server.on('upgrade', (req, clientSocket, head) => {
  const reqHead =
    `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n` +
    Object.entries(req.headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\r\n') +
    '\r\n\r\n';
  const target = (apiProto === 'https' ? tls.connect : net.connect)(apiPort, apiHost, () => {
    target.write(reqHead);
    if (head && head.length) target.write(head);
    target.pipe(clientSocket);
    clientSocket.pipe(target);
  });
  target.on('error', () => clientSocket.destroy());
  clientSocket.on('error', () => target.destroy());
});

server.listen(PORT, () => {
  process.stdout.write(`iSafeDrive driver web -> http://localhost:${PORT} (API proxy -> ${apiProto}://${apiHost}:${apiPort})\n`);
});
