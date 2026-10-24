import type {Host} from '../../../core/types.ts';
export default function int(line: string | undefined, host: Pick<Host, 'write'>) {
  const number = Number(line);
  const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

  if (typeof line !== 'string' || !decimal.test(line.trim()) || !Number.isFinite(number)) {
    throw new Error('Invalid number');
  }
  host.write(`${Math.floor(number)}\n`);
}
