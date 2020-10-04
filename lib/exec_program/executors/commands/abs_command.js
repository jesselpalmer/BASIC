"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function abs(line) {
    var number = parseFloat(line);
    if (isNaN(number)) {
        console.error('Invalid number');
    }
    else {
        console.log(Math.abs(number));
    }
}
exports.default = abs;
//# sourceMappingURL=abs_command.js.map