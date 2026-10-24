import type {Host} from '../../../core/types.ts';
import {parseDecimalArgument} from '../../../core/decimal.ts';
export default function abs(line: string | undefined, host: Pick<Host, 'write'>) {
  host.write(`${Math.abs(parseDecimalArgument(line))}\n`);
}
