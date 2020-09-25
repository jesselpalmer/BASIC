"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var constants_1 = require("./shared/constants");
var exec_program_1 = require("./exec_program/exec_program");
var repl_1 = require("./repl/repl");
var Basic = /** @class */ (function () {
    function Basic() {
        this.main();
    }
    Basic.prototype.main = function () {
        var isTooManyArgs = process.argv.length > 3;
        var isFilenameInputted = process.argv.length === 3;
        var filenameIndex = 2;
        if (isTooManyArgs) {
            console.log('Usage: nBASIC [script]');
            process.exit(constants_1.default.ExitCodes.INVALID_ARGUMENT);
        }
        else if (isFilenameInputted) {
            var filePath = process.argv[filenameIndex];
            this.runFile(filePath);
        }
        else {
            this.runPrompt();
        }
    };
    Basic.prototype.runFile = function (filePath) {
        var program = new exec_program_1.ExecProgram();
        program.start(filePath);
    };
    Basic.prototype.runPrompt = function () {
        var repl = new repl_1.Repl();
        repl.start();
    };
    return Basic;
}());
exports.default = Basic;
//# sourceMappingURL=basic.js.map