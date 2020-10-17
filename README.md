[![npm](https://img.shields.io/npm/dw/node-basic-lang.svg)](https://www.npmjs.com/package/node-basic-lang)

# BASIC

BASIC interpreter

## Installation

Install the `node-basic-lang` library globally:

  ```bash
  npm install -g node-basic-lang
  ```

## Executing files

1. Create a BASIC program using the [supported commands](#supported-commands) below. Make sure that the file ends in `.bas`.

2. Run the BASIC program that you created

  ```bash
  basic <program name>.bas
  ```
  
  Example:

  ```bash
  basic game.bas
  ```

## Using the REPL

You can use the REPL just by running the following command in the terminal:

 ```bash
  basic
  ```

Make sure that you enter a unique line number for each command, just like you would a normal file. See [supported commands](#supported-commands) below for a list of commands you can use.

## Supported commands

`ABS` - Prints out the absolute value of a number.  
`CLS` - Clears the console.  
`INT` - Prints out an integer by rounding any decimal number down.  
`PRINT` - Prints lines to the console.  
`REM` - Comments for the user. The interpreter ignores these lines.  
`END` - Exits the program.

## Sample file

```bas
10 CLS
20 REM "BASIC HELLO WORLD PROGRAM"
30 PRINT "HELLO WORLD"
40 PRINT "HELLO WORLD 2X"
50 PRINT "HELLO WORLD 3X"
60 ABS "-3.14"
70 INT "1.6180"
80 END
```
