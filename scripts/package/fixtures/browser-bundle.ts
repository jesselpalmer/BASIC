import * as api from 'node-basic-lang/browser';
import * as root from 'node-basic-lang';
import {runBrowserEmbedding} from './browser-acceptance.ts';

(globalThis as unknown as {basicEmbedding: ReturnType<typeof runBrowserEmbedding>}).basicEmbedding =
  runBrowserEmbedding(api, root);
