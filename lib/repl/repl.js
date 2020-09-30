"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var header_1 = require("./header");
var Repl = /** @class */ (function () {
    function Repl() {
    }
    Repl.prototype.start = function () {
        var header = new header_1.default();
        header.printWelcome();
        console.log('>>>');
    };
    return Repl;
}());
exports.default = Repl;
//# sourceMappingURL=repl.js.map