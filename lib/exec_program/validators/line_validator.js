"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var LineValidator = /** @class */ (function () {
    function LineValidator() {
    }
    LineValidator.prototype.hasLineNumberBeenUsed = function (lineNumberStr) {
        var radix = 10;
        var lineNumber = parseInt(lineNumberStr, radix);
        var hasLineNumBeenUsed = false;
        if (LineValidator._usedLineNumbers.indexOf(lineNumber) !== -1) {
            console.log("INVALID: Line number has been used " + lineNumber);
            hasLineNumBeenUsed = true;
        }
        else {
            LineValidator._usedLineNumbers.push(lineNumber);
        }
        return hasLineNumBeenUsed;
    };
    LineValidator.prototype.isLineNumberANumber = function (lineNumberStr) {
        var radix = 10;
        var isLineValid = true;
        if (isNaN(parseInt(lineNumberStr, radix))) {
            console.log("INVALID: Line number is not a valid number " + lineNumberStr);
            isLineValid = false;
        }
        return isLineValid;
    };
    LineValidator.prototype.isLineValid = function (line) {
        var lineTokens = line.split(' ');
        var lineNumber = lineTokens[0];
        var isLineValid = true;
        if (!this.isLineNumberANumber(lineNumber)) {
            isLineValid = false;
        }
        else if (this.hasLineNumberBeenUsed(lineNumber)) {
            isLineValid = false;
        }
        return isLineValid;
    };
    LineValidator._usedLineNumbers = [];
    return LineValidator;
}());
exports.LineValidator = LineValidator;
//# sourceMappingURL=line_validator.js.map