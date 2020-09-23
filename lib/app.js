"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var repl_1 = require("./repl/repl");
var exec_program_1 = require("./exec_program/exec_program");
var App = /** @class */ (function () {
    function App() {
        this.main();
    }
    App.prototype.main = function () {
        var filePath = process.argv[2] ? process.argv[2] : null;
        if (filePath) {
            this.execProgram(filePath);
        }
        else {
            this.startRepl();
        }
    };
    App.prototype.execProgram = function (filePath) {
        var program = new exec_program_1.ExecProgram();
        program.start(filePath);
    };
    App.prototype.startRepl = function () {
        var repl = new repl_1.REPL();
        repl.start();
    };
    return App;
}());
var app = new App();
//# sourceMappingURL=app.js.map