# BASIC

BASIC interpreter

## Installation

1. Install library:

  ```bash
  npm install node-basic.js
  ```

2. Create a file to import the library such as app.js:

  ```javascript
  var nodeBasic = require('node-basic.js');
  ```

3. Create a BASIC program using the guidelines below.

4. Run the BASIC program that you created

  ```bash
  node <filename you created in step 2> <program name>
  ```

## Usage

### Valid commands

`PRINT` - Prints lines to the console.  
`REM` - Comments for the user. The interpreter ignores these lines.

### File extensions

File should end in `.bas`.

### Sample file

```bas
10 REM "BASIC HELLO WORLD PROGRAM"
20 PRINT "HELLO WORLD"
30 PRINT "HELLO WORLD 2X"
40 PRINT "HELLO WORLD 3X"
```
