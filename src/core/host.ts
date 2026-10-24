import type {Host} from './types.ts';
export type {Host} from './types.ts';

export function createHost(overrides: Partial<Host> = {}): Host {
  const bind = <K extends keyof Host>(name: K, fallback: Host[K]): Host[K] => {
    const callback = overrides[name];
    if (callback === undefined) return fallback;
    if (typeof callback !== 'function') {
      throw new TypeError(`Host ${name} must be a function`);
    }
    return callback.bind(overrides) as Host[K];
  };
  return {
    write: bind('write', () => {}),
    clear: bind('clear', () => {}),
    ...(overrides.draw === undefined ? {} : {draw: bind('draw', undefined)}),
    readLine: bind('readLine', () =>
      Promise.reject(new Error('Input is not supported by this host')),
    ),
    random: bind('random', Math.random),
  };
}
