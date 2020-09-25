"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Repl = void 0;
var header_1 = require("./header");
var Repl = /** @class */ (function () {
    function Repl() {
    }
    Repl.prototype.start = function () {
        var header = new header_1.Header();
        header.printWelcome();
        console.log('>>>');
    };
    return Repl;
}());
exports.Repl = Repl;
//# sourceMappingURL=Repl.js.map