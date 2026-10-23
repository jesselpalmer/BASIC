export default function int(line, host) {
  const number = Number(line);
  const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

  if (typeof line !== 'string' || !decimal.test(line.trim()) ||
      !Number.isFinite(number)) {
    throw new Error('Invalid number');
  }
  host.write(`${Math.floor(number)}\n`);
}
