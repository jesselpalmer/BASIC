"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.int = void 0;
function int(line) {
    var number = parseInt(line, 10);
    if (isNaN(number)) {
        console.error('Invalid number');
    }
    else {
        console.log(Math.floor(parseInt(line, 10)));
    }
}
exports.int = int;
//# sourceMappingURL=int_command.js.map