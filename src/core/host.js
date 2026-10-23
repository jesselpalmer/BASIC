export function createHost(overrides = {}) {
  const host = {
    write: () => {},
    clear: () => {},
    readLine: async () => {
      throw new Error('Input is not supported by this host');
    },
    random: Math.random,
  };
  for (const name of Object.keys(host)) {
    if (overrides[name] === undefined) continue;
    if (typeof overrides[name] !== 'function') {
      throw new TypeError(`Host ${name} must be a function`);
    }
    host[name] = overrides[name].bind(overrides);
  }
  return host;
}
