import {expect, test} from 'bun:test';
import Basic from './runtime.ts';

const source =
  '10 A=0\n20 FOR I=1 TO 2\n30 A=A+I\n40 NEXT I\n' +
  '50 PRINT A;\n60 INPUT "NUMBER";N\n70 IF N=3 THEN 90\n' +
  '80 PRINT "WRONG"\n90 PRINT "DONE"\n100 END';

test('native policy keeps shared step, async input and branch ownership', async () => {
  const writes: string[] = [];
  const prompts: string[] = [];
  const basic = new Basic({
    write: (text) => writes.push(text),
    readLine: (prompt) => {
      prompts.push(prompt ?? '');
      return Promise.resolve('3');
    },
  });
  expect(basic.reset(source)).toMatchObject({status: 'ready', nextLocation: {label: 10}});
  expect(writes).toEqual([]);
  while (basic.state.nextLocation?.label !== 60) basic.step();
  expect(writes).toEqual(['3']);
  expect(basic.variables).toContainEqual({name: 'I', value: 3});
  expect((await basic.stepAsync()).nextLocation?.label).toBe(70);
  expect(prompts).toEqual(['NUMBER? ']);
  while (basic.status !== 'halted') basic.step();
  expect(writes).toEqual(['3', 'DONE\n']);
  expect(basic.variables).toContainEqual({name: 'N', value: 3});
  expect((await basic.runAsync()).status).toBe('halted');
  expect(writes).toEqual(['3', 'DONE\n', '3', 'DONE\n']);
});
