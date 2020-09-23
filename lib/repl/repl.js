"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REPL = void 0;
var header_1 = require("./header");
var REPL = /** @class */ (function () {
    function REPL() {
    }
    REPL.prototype.start = function () {
        var header = new header_1.Header();
        header.printWelcome();
        console.log('>>>');
    };
    return REPL;
}());
exports.REPL = REPL;
//# sourceMappingURL=repl.js.map