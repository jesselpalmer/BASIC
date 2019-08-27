# BASIC

BASIC interpreter

## Installation

1. Install library:

  ```bash
  npm install node-basic-lang
  ```

2. Create a file to import the library such as app.js:

  ```javascript
  var nodeBasic = require('node-basic-lang');
  ```

3. Create a BASIC program using the guidelines below.

4. Run the BASIC program that you created

  ```bash
  node <filename you created in step 2> <program name>
  ```
  
  Example:

  ```bash
  node app.js game.bas
  ```

## Usage

### Valid commands

`CLS` - Clears the console.  
`PRINT` - Prints lines to the console.  
`REM` - Comments for the user. The interpreter ignores these lines.
`END` - Exits the program.

### File extensions

File should end in `.bas`.

### Sample file

```bas
10 REM "BASIC HELLO WORLD PROGRAM"
20 CLS
30 PRINT "HELLO WORLD"
40 PRINT "HELLO WORLD 2X"
50 PRINT "HELLO WORLD 3X"
60 END
```
