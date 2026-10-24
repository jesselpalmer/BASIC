import type {Host} from '../../../core/types.ts';
import {parseDecimalArgument} from '../../../core/decimal.ts';
export default function int(line: string | undefined, host: Pick<Host, 'write'>) {
  host.write(`${Math.floor(parseDecimalArgument(line))}\n`);
}
