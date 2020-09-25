"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var assert_1 = require("assert");
var basic_1 = require("./basic");
describe("Basic class test suite", function () {
    it("should create an instance", function () {
        assert_1.strictEqual(typeof new basic_1.default(), 'object');
    });
});
//# sourceMappingURL=basic.spec.js.map