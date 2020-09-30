"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function int(line) {
    var number = parseInt(line, 10);
    if (isNaN(number)) {
        console.error('Invalid number');
    }
    else {
        console.log(Math.floor(parseInt(line, 10)));
    }
}
exports.default = int;
//# sourceMappingURL=int_command.js.map