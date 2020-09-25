export function abs(line: string): void {
  const number = parseInt(line, 10)

  if (isNaN(number)) {
    console.error('Invalid number')
  } else {
    console.log(Math.abs(parseInt(line, 10)))
  }
}
