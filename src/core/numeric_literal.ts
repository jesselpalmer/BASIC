/** Complete unsigned native decimal, with an optional scientific exponent. */
export const numericLiteral = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?$/;

/** INPUT permits one leading sign; source signs remain unary operators. */
export const signedNumericLiteral = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?$/;
