import {resolve} from 'node:path';

const directory = resolve(import.meta.dirname, '../dist/playground');
const files = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html'],
  ['/app.js', 'app.js'],
  ['/app.js.map', 'app.js.map'],
  ['/styles.css', 'styles.css'],
]);
const port = Number(process.env.BASIC_PLAYGROUND_PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('BASIC_PLAYGROUND_PORT must be an integer from 1 to 65535');
}
if (!(await Bun.file(resolve(directory, 'index.html')).exists())) {
  throw new Error('Build the playground first with bun run build:playground');
}
const server = Bun.serve({
  hostname: '127.0.0.1',
  port,
  fetch(request) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', {status: 405, headers: {Allow: 'GET, HEAD'}});
    }
    const path = files.get(new URL(request.url).pathname);
    if (!path) return new Response('Not found', {status: 404});
    const file = Bun.file(resolve(directory, path));
    return new Response(request.method === 'HEAD' ? null : file, {
      headers: {'Content-Type': file.type, 'Cache-Control': 'no-store'},
    });
  },
});
console.log(`BASIC playground: ${server.url}`);
