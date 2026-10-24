import type {Host} from '../../../core/types.ts';
export default function print(line: string | undefined, host: Pick<Host, 'write'>) {
  host.write(`${line}\n`);
}
