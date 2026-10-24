import type {Host} from '../../../core/types.ts';
export default function cls(host: Pick<Host, 'clear'>) {
  host.clear();
}
