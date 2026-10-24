// Complete signed-decimal arguments shared by the legacy numeric commands.
export function parseDecimalArgument(source: string | undefined): number {
  const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
  const value = Number(source);
  if (typeof source !== 'string' || !decimal.test(source.trim()) || !Number.isFinite(value)) {
    throw new Error('Invalid number');
  }
  return value;
}
