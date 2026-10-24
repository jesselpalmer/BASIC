import {expect, it, jest} from 'bun:test';
import {createInterface} from 'node:readline';
import {PassThrough} from 'node:stream';
import ReadlineOutput from './readline_output.ts';

it('forwards live terminal dimensions, resize events, and unbuffered output writes', async () => {
  const source = Object.assign(new PassThrough({highWaterMark: 1}), {columns: 80, rows: 24});
  const externalResize = jest.fn();
  source.on('resize', externalResize);
  const output = new ReadlineOutput(source);
  const resized = jest.fn();
  output.on('resize', resized);
  output.attach();
  try {
    expect(output.columns).toBe(80);
    expect(output.rows).toBe(24);
    source.columns = 40;
    source.rows = 12;
    source.emit('resize');
    expect(output.columns).toBe(40);
    expect(output.rows).toBe(12);
    expect(resized).toHaveBeenCalledTimes(1);
    expect(externalResize).toHaveBeenCalledTimes(1);
    expect(output.write('plain')).toBe(false);
    expect(source.read()).toEqual(Buffer.from('plain'));
    await new Promise<void>((resolve, reject) => {
      expect(output.write('callback', (error) => (error ? reject(error) : resolve()))).toBe(false);
      expect(source.read()).toEqual(Buffer.from('callback'));
    });
    await new Promise<void>((resolve, reject) => {
      expect(output.write('é', 'utf8', (error) => (error ? reject(error) : resolve()))).toBe(false);
      expect(source.read()).toEqual(Buffer.from('é'));
    });
    await new Promise<void>((resolve, reject) => {
      expect(
        output.write('default encoding', undefined, (error) => (error ? reject(error) : resolve())),
      ).toBe(false);
      expect(source.read()).toEqual(Buffer.from('default encoding'));
    });
    output.release();
    output.release();
    expect(source.listeners('resize')).toEqual([externalResize]);
    source.emit('resize');
    expect(resized).toHaveBeenCalledTimes(1);
    expect(externalResize).toHaveBeenCalledTimes(2);
    expect(source.destroyed).toBe(false);
  } finally {
    output.release();
    source.destroy();
  }
});

it('releases caller resize callbacks when readline fails after registering its private resize listener', () => {
  const failure = new Error('late construction resume failed');
  const input = Object.assign(new PassThrough(), {
    isTTY: true,
    setRawMode() {
      return input;
    },
  });
  const source = new PassThrough();
  const externalResize = jest.fn();
  source.on('resize', externalResize);
  const output = new ReadlineOutput(source);
  const resume = input.resume.bind(input);
  input.resume = () => {
    if (output.listenerCount('resize')) throw failure;
    return resume();
  };
  output.attach();
  try {
    expect(() => createInterface({input, output, terminal: true})).toThrow(failure);
    // No Interface handle exists. Cleanup must still remove its route to the
    // caller output without trying to identify readline's private callback.
    expect(output.listenerCount('resize')).toBe(1);
    output.release();
    expect(source.listeners('resize')).toEqual([externalResize]);
    source.emit('resize');
    expect(externalResize).toHaveBeenCalledTimes(1);
    expect(source.destroyed).toBe(false);
  } finally {
    output.release();
    input.destroy();
    source.destroy();
  }
});
