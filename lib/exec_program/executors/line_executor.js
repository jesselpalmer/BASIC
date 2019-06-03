"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var print_command_1 = require("./commands/print_command");
var rem_command_1 = require("./commands/rem_command");
var LineExecutor = /** @class */ (function () {
    function LineExecutor() {
    }
    LineExecutor.prototype.execLine = function (line) {
        var command = line.split(' ')[1];
        var message = line.split(/[""]/)[1];
        switch (command) {
            case 'PRINT':
                print_command_1.print(message);
                break;
            case 'REM':
                rem_command_1.rem(message);
                break;
            default:
                console.log("Invalid command");
        }
    };
    return LineExecutor;
}());
exports.LineExecutor = LineExecutor;
//# sourceMappingURL=line_executor.js.map