"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var readline = require("readline");
var exec_program_1 = require("../exec_program/exec_program");
var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
var Repl = /** @class */ (function () {
    function Repl() {
    }
    Repl.prototype.start = function () {
        var program = new exec_program_1.default();
        console.log("BASIC 0.0.8 (October 17, 2020)");
        rl.setPrompt(">>> ");
        rl.prompt();
        rl.on('line', function (line) {
            if (line === null || line === '') {
                console.log("Have a great day :)");
                process.exit(0);
            }
            program.readLine(line);
            rl.prompt();
        }).on('close', function () {
            console.log();
            console.log("Have a great day :)");
            process.exit(0);
        });
    };
    return Repl;
}());
exports.default = Repl;
//# sourceMappingURL=repl.js.map