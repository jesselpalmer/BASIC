"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecProgram = void 0;
var rl = require("readline");
var fs = require("fs");
var line_validator_1 = require("./validators/line_validator");
var line_executor_1 = require("./executors/line_executor");
var ExecProgram = /** @class */ (function () {
    function ExecProgram() {
    }
    ExecProgram.prototype.start = function (filePath) {
        this.openFile(filePath);
    };
    ExecProgram.prototype.openFile = function (filePath) {
        var _this = this;
        var fileEncoding = 'utf-8';
        fs.readFile(filePath, fileEncoding, function (err) {
            if (err)
                throw err;
            console.log("OK: " + filePath);
            var rd = rl.createInterface({
                input: fs.createReadStream(filePath),
                output: process.stdout,
                terminal: false
            });
            rd.on('line', _this.readLine);
        });
    };
    ExecProgram.prototype.readLine = function (line) {
        var fv = new line_validator_1.LineValidator();
        var le = new line_executor_1.LineExecutor();
        if (fv.isLineValid(line)) {
            le.execLine(line);
        }
        else {
            console.log("INVALID: " + line);
        }
    };
    return ExecProgram;
}());
exports.ExecProgram = ExecProgram;
//# sourceMappingURL=exec_program.js.map