"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var repl_1 = require("./repl/repl");
var exec_program_1 = require("./exec_program/exec_program");
var App = /** @class */ (function () {
    function App() {
        this.main();
    }
    App.prototype.main = function () {
        var isTooManyArgs = process.argv.length > 3;
        var isFilenameInputted = process.argv.length === 3;
        if (isTooManyArgs) {
            console.log('Usage: nBASIC [script]');
        }
        else if (isFilenameInputted) {
            var filePath = process.argv[2];
            this.runFile(filePath);
        }
        else {
            this.runPrompt();
        }
    };
    App.prototype.runFile = function (filePath) {
        var program = new exec_program_1.ExecProgram();
        program.start(filePath);
    };
    App.prototype.runPrompt = function () {
        var repl = new repl_1.REPL();
        repl.start();
    };
    return App;
}());
var app = new App();
//# sourceMappingURL=app.js.map