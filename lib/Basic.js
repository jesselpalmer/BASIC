"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var repl_1 = require("./repl/repl");
var exec_program_1 = require("./exec_program/exec_program");
var INVALID_ARGUMENT_EXIT_CODE = 9;
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
            process.exit(INVALID_ARGUMENT_EXIT_CODE);
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
        var repl = new repl_1.REPL();
        repl.start();
    };
    return Basic;
}());
var basic = new Basic();
//# sourceMappingURL=Basic.js.map