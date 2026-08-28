import { createServer } from 'node:http';

const server = createServer((request, response) => {
  const url = new URL(request.url || '/', 'http://127.0.0.1:9191');
  response.setHeader('access-control-allow-origin', 'http://127.0.0.1:8080');
  response.setHeader('content-type', 'application/json');
  const token = url.searchParams.get('license');
  if (token === 'unavailable-cached-license') {
    response.writeHead(503).end(JSON.stringify({ error: 'offline' }));
    return;
  }
  const valid = token === 'valid-family-license';
  const reason = valid ? 'ok' : token === 'revoked-family-license' ? 'revoked' : 'invalid';
  response.writeHead(200).end(JSON.stringify({ valid, reason, expires_at: null }));
});

server.listen(9191, '127.0.0.1');

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
