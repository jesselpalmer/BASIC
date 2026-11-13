import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import reference from '../docs/3dplot-edusystem30-reference.json';
import type * as PublicApi from '../src/index.ts';

export const plotOptions = {dialect: 'edusystem-30'} as const;
export const plotSource = readFileSync(
  new URL('./package/fixtures/classic/3dplot.bas', import.meta.url),
  'utf8',
);

export function assertPlotOutput(output: string): void {
  assert.equal(output, `\n${reference.rows.join('\n')}\n`);
  assert.equal(createHash('sha256').update(output).digest('hex'), reference.outputSha256);
}

export async function runPlotAcceptance(
  api: Pick<typeof PublicApi, 'Basic' | 'parseProgram'>,
): Promise<void> {
  assert.equal(createHash('sha256').update(plotSource).digest('hex'), reference.fixtureSha256);
  const program = api.parseProgram(plotSource, plotOptions);
  assert.equal(program.source, plotSource);

  let output = '';
  const basic = new api.Basic({write: (text) => (output += text)}, plotOptions);
  const initial = await basic.runAsync(program, {instructionLimit: 5000});
  assert.equal(initial.status, 'halted');
  assert.equal(initial.currentLocation?.label, 300);
  assertPlotOutput(output);

  output = '';
  const fresh = await basic.runAsync(undefined, {instructionLimit: 5000});
  assert.equal(fresh.status, 'halted');
  assert.equal(fresh.currentLocation?.label, 300);
  assertPlotOutput(output);
}
