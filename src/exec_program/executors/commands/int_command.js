export default function int(line) {
  const number = parseInt(line, 10);

  if (isNaN(number)) {
    console.error('Invalid number');
  } else {
    console.log(Math.floor(parseInt(line, 10)));
  }
}
