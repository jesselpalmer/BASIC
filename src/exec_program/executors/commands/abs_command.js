export default function abs(line) {
  const number = parseFloat(line);

  if (isNaN(number)) {
    console.error('Invalid number');
  } else {
    console.log(Math.abs(number));
  }
}
