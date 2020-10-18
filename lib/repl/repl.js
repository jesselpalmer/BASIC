"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var readline = require("readline");
var exec_program_1 = require("../exec_program/exec_program");
var constants_1 = require("../shared/constants");
var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
var Repl = /** @class */ (function () {
    function Repl() {
    }
    Repl.prototype.start = function () {
        var program = new exec_program_1.default();
        console.log(constants_1.default.Strings.Repl.WELCOME_MESSAGE);
        rl.setPrompt(constants_1.default.Strings.Repl.PROMPT);
        rl.prompt();
        rl.on('line', function (line) {
            var isLineEmpty = line === null || line === '';
            if (isLineEmpty) {
                console.log(constants_1.default.Strings.Repl.EXIT_MESSAGE);
                process.exit(constants_1.default.ExitCodes.NORMAL);
            }
            program.readLine(line);
            rl.prompt();
        }).on('close', function () {
            console.log();
            console.log(constants_1.default.Strings.Repl.EXIT_MESSAGE);
            process.exit(constants_1.default.ExitCodes.NORMAL);
        });
    };
    return Repl;
}());
exports.default = Repl;
//# sourceMappingURL=repl.js.map