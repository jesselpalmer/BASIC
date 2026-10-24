import {describe, expect, it} from 'bun:test';
import {Basic} from '../index.ts';

const cases = [-2, 0, 2].flatMap((start) =>
  [-2, 0, 2].flatMap((end) => [-2, -1, 1, 2].map((step) => ({start, end, step}))),
);

describe('loop boundary cross-product', () => {
  it.each(cases)('matches integer loop bounds %j', ({start, end, step}) => {
    // Closed-form counts provide an independent oracle for the interpreter's
    // repeated increment/comparison algorithm, including empty/equal bounds.
    const count = Math.max(0, Math.floor((end - start) / step) + 1);
    const expected = Array.from({length: count}, (_, i) => start + i * step);
    const output: string[] = [];
    const basic = new Basic({write: (text) => output.push(text)});
    basic.reset(
      `10 FOR I=${start} TO ${end} STEP ${step}\n20 PRINT I\n30 NEXT I\n40 PRINT "final:";I`,
    );
    for (let budget = 0; budget < 64 && basic.status !== 'halted'; budget++) basic.step();
    expect(basic.status).toBe('halted');
    expect(output).toEqual([...expected.map((n) => `${n}\n`), `final:${start + count * step}\n`]);
  });

  it('skips an empty inner loop while preserving the active outer frame', () => {
    const output: string[] = [];
    const basic = new Basic({write: (text) => output.push(text)});
    basic.reset(
      '10 FOR I=1 TO 2\n20 FOR J=2 TO 1\n30 PRINT "skipped"\n40 NEXT J\n50 PRINT I;":";J\n60 NEXT I',
    );
    for (let budget = 0; budget < 32 && basic.status !== 'halted'; budget++) basic.step();
    expect(basic.status).toBe('halted');
    expect(output).toEqual(['1:2\n', '2:2\n']);
  });
});
