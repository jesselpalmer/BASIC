export default function int(line) {
  const number = Number(line);
  const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

  if (typeof line !== 'string' || !decimal.test(line.trim()) ||
      !Number.isFinite(number)) {
    console.error('Invalid number');
  } else {
    console.log(Math.floor(number));
  }
}
