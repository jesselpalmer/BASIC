export default function abs(line, host) {
  const number = parseFloat(line);
  if (!Number.isFinite(number)) throw new Error('Invalid number');
  host.write(`${Math.abs(number)}\n`);
}
