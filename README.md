# BASIC
BASIC Interpreter that can be installed using Node.js.

# Installation
1. Clone the repo:

  `git clone https://github.com/jesselpalmer/BASIC.git`

2. cd into the BASIC repo:

  `cd BASIC`

3. Install dependencies:

  `npm install`

4. Run TypeScript complier:

  `tsc`

5. cd into the src directory:

  `cd src`

6. Create a BASIC program using the guidelines below.

7. Run the BASIC program that you created

  `node app <program name>`

# Usage
## Valid commands
`PRINT` - Prints lines to the console.   
`REM` - Comments for the user. The interpreter ignores these lines.

## File extensions
File should end in `.bas`.

## Sample file
```bas
10 REM "BASIC HELLO WORLD PROGRAM"
20 PRINT "HELLO WORLD"
30 PRINT "HELLO WORLD 2X"
40 PRINT "HELLO WORLD 3X"
```
