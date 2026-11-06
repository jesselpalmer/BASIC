import * as api from 'node-basic-lang/browser';
import * as root from 'node-basic-lang';
import {runBrowserEmbedding} from './browser-acceptance.ts';

if ('compareMa2Relation' in root) throw new Error('MA2 relation conformance must remain private');

(globalThis as unknown as {basicEmbedding: ReturnType<typeof runBrowserEmbedding>}).basicEmbedding =
  runBrowserEmbedding(api, root);
