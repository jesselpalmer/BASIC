import * as api from 'node-basic-lang/browser';
import * as root from 'node-basic-lang';
import {runBrowserEmbedding} from './browser-acceptance.ts';
console.log('BROWSER_EMBEDDING_COMPLETE ' + JSON.stringify(await runBrowserEmbedding(api, root)));
