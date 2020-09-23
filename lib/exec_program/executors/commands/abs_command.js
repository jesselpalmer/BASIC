"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.abs = void 0;
function abs(line) {
    var number = parseInt(line, 10);
    if (isNaN(number)) {
        console.error('Invalid number');
    }
    else {
        console.log(Math.abs(parseInt(line, 10)));
    }
}
exports.abs = abs;
//# sourceMappingURL=abs_command.js.map