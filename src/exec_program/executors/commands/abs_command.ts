export default function abs(line: string): void {
  const number = parseFloat(line)

  if (isNaN(number)) {
    console.error('Invalid number')
  } else {
    console.log(Math.abs(number))
  }
}
