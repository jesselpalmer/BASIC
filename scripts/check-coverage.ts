import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {coverageInventory} from './coverage-inventory.ts';

const root = resolve(import.meta.dirname, '..');
const report = coverageInventory(root, readFileSync(resolve(root, 'coverage/lcov.info'), 'utf8'));
writeFileSync(resolve(root, 'coverage/inventory.json'), JSON.stringify(report, null, 2) + '\n');
console.log(
  `Coverage inventory: ${report.measuredRuntimeFiles.length} measured runtime modules; ${report.subprocessOnlyFiles.length} subprocess entrypoint; ${report.typeOnlyFiles.length} type-only module.`,
);
