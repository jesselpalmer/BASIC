import type {Host} from '../../../core/types.ts';
export default function abs(line: string | undefined, host: Pick<Host, 'write'>) {
  const number = parseFloat(line ?? '');
  if (!Number.isFinite(number)) throw new Error('Invalid number');
  host.write(`${Math.abs(number)}\n`);
}
