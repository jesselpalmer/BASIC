// eslint-disable-next-line @typescript-eslint/no-require-imports -- Verify the installed CommonJS subpath.
import api = require('node-basic-lang/browser');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Verify both supported public entries.
import root = require('node-basic-lang');
import {runBrowserEmbedding} from './browser-acceptance.ts';
console.log(
  'BROWSER_EMBEDDING_COMPLETE ' + JSON.stringify(await runBrowserEmbedding(api, root.parseProgram)),
);
