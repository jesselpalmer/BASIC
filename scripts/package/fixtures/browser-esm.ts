import * as api from 'node-basic-lang/browser';
import {parseProgram} from 'node-basic-lang';
import {runBrowserEmbedding} from './browser-acceptance.ts';
console.log(
  'BROWSER_EMBEDDING_COMPLETE ' + JSON.stringify(await runBrowserEmbedding(api, parseProgram)),
);
