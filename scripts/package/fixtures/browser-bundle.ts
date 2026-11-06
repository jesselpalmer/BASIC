import * as api from 'node-basic-lang/browser';
import * as root from 'node-basic-lang';
import {runBrowserEmbedding} from './browser-acceptance.ts';

if ('compareMa2Relation' in root) throw new Error('MA2 relation conformance must remain private');

if ('createBasicPlusMa2ArrayStore' in root)
  throw new Error('MA2 array conformance must remain private');
let nativeArrayOutput = '';
const nativeArrays = new root.Basic({
  write: (text) => {
    nativeArrayOutput += text;
  },
});
for (let run = 0; run < 2; run++) {
  nativeArrays.run('10 DIM A(1)\n20 A(1)=2\n30 PRINT A(0);A(1)');
}
if (nativeArrayOutput !== '02\n02\n')
  throw new Error('Native array defaults and fresh ownership changed');

(globalThis as unknown as {basicEmbedding: ReturnType<typeof runBrowserEmbedding>}).basicEmbedding =
  runBrowserEmbedding(api, root);
