import {cpSync, mkdirSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {buildBrowserConsumer} from './check-browser.ts';
import {runProcess} from '../subprocess.ts';

const archive = resolve(process.argv[2]);
const directory = resolve(process.argv[3]);
const root = resolve(import.meta.dirname, '../..');
const consumer = join(directory, 'consumer');
mkdirSync(consumer);
writeFileSync(join(consumer, 'package.json'), '{"private":true}\n');
runProcess({cwd: consumer, args: ['install', '--ignore-scripts', archive], timeout: 60000});
cpSync(join(root, 'scripts/package/fixtures'), join(consumer, 'scripts/package/fixtures'), {
  recursive: true,
});
writeFileSync(join(directory, 'embedding.js'), await buildBrowserConsumer(consumer));
