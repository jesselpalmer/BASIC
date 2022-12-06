/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/basic.js":
/*!**********************!*\
  !*** ./src/basic.js ***!
  \**********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ Basic)\n/* harmony export */ });\n/* harmony import */ var _shared_constants__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./shared/constants */ \"./src/shared/constants.js\");\n/* harmony import */ var _exec_program_exec_program__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./exec_program/exec_program */ \"./src/exec_program/exec_program.js\");\n/* harmony import */ var _repl_repl__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./repl/repl */ \"./src/repl/repl.js\");\nfunction _typeof(obj) { \"@babel/helpers - typeof\"; return _typeof = \"function\" == typeof Symbol && \"symbol\" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && \"function\" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? \"symbol\" : typeof obj; }, _typeof(obj); }\nfunction _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError(\"Cannot call a class as a function\"); } }\nfunction _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if (\"value\" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }\nfunction _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, \"prototype\", { writable: false }); return Constructor; }\nfunction _toPropertyKey(arg) { var key = _toPrimitive(arg, \"string\"); return _typeof(key) === \"symbol\" ? key : String(key); }\nfunction _toPrimitive(input, hint) { if (_typeof(input) !== \"object\" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || \"default\"); if (_typeof(res) !== \"object\") return res; throw new TypeError(\"@@toPrimitive must return a primitive value.\"); } return (hint === \"string\" ? String : Number)(input); }\n\n\n\nvar Basic = /*#__PURE__*/function () {\n  function Basic() {\n    _classCallCheck(this, Basic);\n    this.main();\n  }\n  _createClass(Basic, [{\n    key: \"main\",\n    value: function main() {\n      var isTooManyArgs = process.argv.length > 3;\n      var isFilenameInputted = process.argv.length === 3;\n      var filenameIndex = 2;\n      if (isTooManyArgs) {\n        console.log('Usage: nBASIC [script]');\n        process.exit(_shared_constants__WEBPACK_IMPORTED_MODULE_0__[\"default\"].ExitCodes.INVALID_ARGUMENT);\n      } else if (isFilenameInputted) {\n        var filePath = process.argv[filenameIndex];\n        this.runFile(filePath);\n      } else {\n        this.runPrompt();\n      }\n    }\n  }, {\n    key: \"runFile\",\n    value: function runFile(filePath) {\n      var program = new _exec_program_exec_program__WEBPACK_IMPORTED_MODULE_1__[\"default\"]();\n      program.start(filePath);\n    }\n  }, {\n    key: \"runPrompt\",\n    value: function runPrompt() {\n      var repl = new _repl_repl__WEBPACK_IMPORTED_MODULE_2__[\"default\"]();\n      repl.start();\n    }\n  }]);\n  return Basic;\n}();\n\n\n//# sourceURL=webpack://node-basic-lang/./src/basic.js?");

/***/ }),

/***/ "./src/exec_program/exec_program.js":
/*!******************************************!*\
  !*** ./src/exec_program/exec_program.js ***!
  \******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ ExecProgram)\n/* harmony export */ });\n/* harmony import */ var readline__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! readline */ \"readline\");\n/* harmony import */ var readline__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(readline__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! fs */ \"fs\");\n/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var _validators_line_validator__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./validators/line_validator */ \"./src/exec_program/validators/line_validator.js\");\n/* harmony import */ var _executors_line_executor__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./executors/line_executor */ \"./src/exec_program/executors/line_executor.js\");\nfunction _typeof(obj) { \"@babel/helpers - typeof\"; return _typeof = \"function\" == typeof Symbol && \"symbol\" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && \"function\" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? \"symbol\" : typeof obj; }, _typeof(obj); }\nfunction _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError(\"Cannot call a class as a function\"); } }\nfunction _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if (\"value\" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }\nfunction _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, \"prototype\", { writable: false }); return Constructor; }\nfunction _toPropertyKey(arg) { var key = _toPrimitive(arg, \"string\"); return _typeof(key) === \"symbol\" ? key : String(key); }\nfunction _toPrimitive(input, hint) { if (_typeof(input) !== \"object\" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || \"default\"); if (_typeof(res) !== \"object\") return res; throw new TypeError(\"@@toPrimitive must return a primitive value.\"); } return (hint === \"string\" ? String : Number)(input); }\n\n\n\n\nvar ExecProgram = /*#__PURE__*/function () {\n  function ExecProgram() {\n    _classCallCheck(this, ExecProgram);\n  }\n  _createClass(ExecProgram, [{\n    key: \"start\",\n    value: function start(filePath) {\n      this.openFile(filePath);\n    }\n  }, {\n    key: \"openFile\",\n    value: function openFile(filePath) {\n      var _this = this;\n      var fileEncoding = 'utf-8';\n      fs__WEBPACK_IMPORTED_MODULE_1__.readFile(filePath, fileEncoding, function (err) {\n        if (err) throw err;\n        console.log(\"OK: \".concat(filePath));\n        var rd = readline__WEBPACK_IMPORTED_MODULE_0__.createInterface({\n          input: fs__WEBPACK_IMPORTED_MODULE_1__.createReadStream(filePath),\n          output: process.stdout,\n          terminal: false\n        });\n        rd.on('line', _this.readLine);\n      });\n    }\n  }, {\n    key: \"readLine\",\n    value: function readLine(line) {\n      var fv = new _validators_line_validator__WEBPACK_IMPORTED_MODULE_2__.LineValidator();\n      var le = new _executors_line_executor__WEBPACK_IMPORTED_MODULE_3__.LineExecutor();\n      if (fv.isLineValid(line)) {\n        le.execLine(line);\n      } else {\n        console.log(\"INVALID: \".concat(line));\n      }\n    }\n  }]);\n  return ExecProgram;\n}();\n\n\n//# sourceURL=webpack://node-basic-lang/./src/exec_program/exec_program.js?");

/***/ }),

/***/ "./src/exec_program/executors/commands/abs_command.js":
/*!************************************************************!*\
  !*** ./src/exec_program/executors/commands/abs_command.js ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ abs)\n/* harmony export */ });\nfunction abs(line) {\n  var number = parseFloat(line);\n  if (isNaN(number)) {\n    console.error('Invalid number');\n  } else {\n    console.log(Math.abs(number));\n  }\n}\n\n//# sourceURL=webpack://node-basic-lang/./src/exec_program/executors/commands/abs_command.js?");

/***/ }),

/***/ "./src/exec_program/executors/commands/cls_command.js":
/*!************************************************************!*\
  !*** ./src/exec_program/executors/commands/cls_command.js ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ cls)\n/* harmony export */ });\nfunction cls() {\n  console.clear();\n}\n\n//# sourceURL=webpack://node-basic-lang/./src/exec_program/executors/commands/cls_command.js?");

/***/ }),

/***/ "./src/exec_program/executors/commands/end_command.js":
/*!************************************************************!*\
  !*** ./src/exec_program/executors/commands/end_command.js ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ end)\n/* harmony export */ });\n/* harmony import */ var _shared_constants__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../../shared/constants */ \"./src/shared/constants.js\");\n\nfunction end() {\n  process.exit(_shared_constants__WEBPACK_IMPORTED_MODULE_0__[\"default\"].ExitCodes.NORMAL);\n}\n\n//# sourceURL=webpack://node-basic-lang/./src/exec_program/executors/commands/end_command.js?");

/***/ }),

/***/ "./src/exec_program/executors/commands/int_command.js":
/*!************************************************************!*\
  !*** ./src/exec_program/executors/commands/int_command.js ***!
  \************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ _int)\n/* harmony export */ });\nfunction _int(line) {\n  var number = parseInt(line, 10);\n  if (isNaN(number)) {\n    console.error('Invalid number');\n  } else {\n    console.log(Math.floor(parseInt(line, 10)));\n  }\n}\n\n\n//# sourceURL=webpack://node-basic-lang/./src/exec_program/executors/commands/int_command.js?");

/***/ }),

/***/ "./src/exec_program/executors/commands/print_command.js":
/*!**************************************************************!*\
  !*** ./src/exec_program/executors/commands/print_command.js ***!
  \**************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ print)\n/* harmony export */ });\nfunction print(line) {\n  console.log(\"\".concat(line));\n}\n\n//# sourceURL=webpack://node-basic-lang/./src/exec_program/executors/commands/print_command.js?");

/***/ }),

/***/ "./src/exec_program/executors/line_executor.js":
/*!*****************************************************!*\
  !*** ./src/exec_program/executors/line_executor.js ***!
  \*****************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"LineExecutor\": () => (/* binding */ LineExecutor)\n/* harmony export */ });\n/* harmony import */ var _commands_abs_command__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./commands/abs_command */ \"./src/exec_program/executors/commands/abs_command.js\");\n/* harmony import */ var _commands_cls_command__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./commands/cls_command */ \"./src/exec_program/executors/commands/cls_command.js\");\n/* harmony import */ var _commands_end_command__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./commands/end_command */ \"./src/exec_program/executors/commands/end_command.js\");\n/* harmony import */ var _commands_int_command__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./commands/int_command */ \"./src/exec_program/executors/commands/int_command.js\");\n/* harmony import */ var _commands_print_command__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./commands/print_command */ \"./src/exec_program/executors/commands/print_command.js\");\nfunction _typeof(obj) { \"@babel/helpers - typeof\"; return _typeof = \"function\" == typeof Symbol && \"symbol\" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && \"function\" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? \"symbol\" : typeof obj; }, _typeof(obj); }\nfunction _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError(\"Cannot call a class as a function\"); } }\nfunction _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if (\"value\" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }\nfunction _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, \"prototype\", { writable: false }); return Constructor; }\nfunction _toPropertyKey(arg) { var key = _toPrimitive(arg, \"string\"); return _typeof(key) === \"symbol\" ? key : String(key); }\nfunction _toPrimitive(input, hint) { if (_typeof(input) !== \"object\" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || \"default\"); if (_typeof(res) !== \"object\") return res; throw new TypeError(\"@@toPrimitive must return a primitive value.\"); } return (hint === \"string\" ? String : Number)(input); }\n\n\n\n\n\nvar LineExecutor = /*#__PURE__*/function () {\n  function LineExecutor() {\n    _classCallCheck(this, LineExecutor);\n  }\n  _createClass(LineExecutor, [{\n    key: \"execLine\",\n    value: function execLine(line) {\n      var command = line.split(' ')[1];\n      var message = line.split(/[\"\"]/)[1];\n      switch (command) {\n        case 'ABS':\n          (0,_commands_abs_command__WEBPACK_IMPORTED_MODULE_0__[\"default\"])(message);\n          break;\n        case 'CLS':\n          (0,_commands_cls_command__WEBPACK_IMPORTED_MODULE_1__[\"default\"])();\n          break;\n        case 'END':\n          (0,_commands_end_command__WEBPACK_IMPORTED_MODULE_2__[\"default\"])();\n          break;\n        case 'INT':\n          (0,_commands_int_command__WEBPACK_IMPORTED_MODULE_3__[\"default\"])(message);\n          break;\n        case 'PRINT':\n          (0,_commands_print_command__WEBPACK_IMPORTED_MODULE_4__[\"default\"])(message);\n          break;\n        case 'REM':\n          break;\n        case '':\n          break;\n        default:\n          console.log(\"Invalid command\");\n      }\n    }\n  }]);\n  return LineExecutor;\n}();\n\n//# sourceURL=webpack://node-basic-lang/./src/exec_program/executors/line_executor.js?");

/***/ }),

/***/ "./src/exec_program/validators/line_validator.js":
/*!*******************************************************!*\
  !*** ./src/exec_program/validators/line_validator.js ***!
  \*******************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"LineValidator\": () => (/* binding */ LineValidator)\n/* harmony export */ });\nfunction _typeof(obj) { \"@babel/helpers - typeof\"; return _typeof = \"function\" == typeof Symbol && \"symbol\" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && \"function\" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? \"symbol\" : typeof obj; }, _typeof(obj); }\nfunction _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError(\"Cannot call a class as a function\"); } }\nfunction _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if (\"value\" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }\nfunction _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, \"prototype\", { writable: false }); return Constructor; }\nfunction _toPropertyKey(arg) { var key = _toPrimitive(arg, \"string\"); return _typeof(key) === \"symbol\" ? key : String(key); }\nfunction _toPrimitive(input, hint) { if (_typeof(input) !== \"object\" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || \"default\"); if (_typeof(res) !== \"object\") return res; throw new TypeError(\"@@toPrimitive must return a primitive value.\"); } return (hint === \"string\" ? String : Number)(input); }\nvar LineValidator = /*#__PURE__*/function () {\n  function LineValidator() {\n    _classCallCheck(this, LineValidator);\n    this._usedLineNumbers = new Set();\n  }\n  _createClass(LineValidator, [{\n    key: \"hasLineNumberBeenUsed\",\n    value: function hasLineNumberBeenUsed(lineNumberStr) {\n      var radix = 10;\n      var lineNumber = parseInt(lineNumberStr, radix);\n      var hasLineNumBeenUsed = false;\n      if (LineValidator._usedLineNumbers.has(lineNumber)) {\n        console.log(\"INVALID: Line number has been used \".concat(lineNumber));\n        hasLineNumBeenUsed = true;\n      } else {\n        LineValidator._usedLineNumbers.add(lineNumber);\n      }\n      return hasLineNumBeenUsed;\n    }\n  }, {\n    key: \"isLineNumberANumber\",\n    value: function isLineNumberANumber(lineNumberStr) {\n      var radix = 10;\n      var isLineValid = true;\n      if (isNaN(parseInt(lineNumberStr, radix))) {\n        console.log(\"INVALID: Line number is not a valid number \".concat(lineNumberStr));\n        isLineValid = false;\n      }\n      return isLineValid;\n    }\n  }, {\n    key: \"isLineValid\",\n    value: function isLineValid(line) {\n      var lineTokens = line.split(' ');\n      var lineNumber = lineTokens[0];\n      var isLineValid = true;\n      if (!this.isLineNumberANumber(lineNumber)) {\n        isLineValid = false;\n      } else if (this.hasLineNumberBeenUsed(lineNumber)) {\n        isLineValid = false;\n      }\n      return isLineValid;\n    }\n  }]);\n  return LineValidator;\n}();\n\n//# sourceURL=webpack://node-basic-lang/./src/exec_program/validators/line_validator.js?");

/***/ }),

/***/ "./src/index.js":
/*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var _basic__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./basic */ \"./src/basic.js\");\n\nnew _basic__WEBPACK_IMPORTED_MODULE_0__[\"default\"]();\n\n//# sourceURL=webpack://node-basic-lang/./src/index.js?");

/***/ }),

/***/ "./src/repl/repl.js":
/*!**************************!*\
  !*** ./src/repl/repl.js ***!
  \**************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ Repl)\n/* harmony export */ });\n/* harmony import */ var _exec_program_exec_program__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../exec_program/exec_program */ \"./src/exec_program/exec_program.js\");\n/* harmony import */ var _shared_constants__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../shared/constants */ \"./src/shared/constants.js\");\nfunction _typeof(obj) { \"@babel/helpers - typeof\"; return _typeof = \"function\" == typeof Symbol && \"symbol\" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && \"function\" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? \"symbol\" : typeof obj; }, _typeof(obj); }\nfunction _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError(\"Cannot call a class as a function\"); } }\nfunction _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if (\"value\" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }\nfunction _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, \"prototype\", { writable: false }); return Constructor; }\nfunction _toPropertyKey(arg) { var key = _toPrimitive(arg, \"string\"); return _typeof(key) === \"symbol\" ? key : String(key); }\nfunction _toPrimitive(input, hint) { if (_typeof(input) !== \"object\" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || \"default\"); if (_typeof(res) !== \"object\") return res; throw new TypeError(\"@@toPrimitive must return a primitive value.\"); } return (hint === \"string\" ? String : Number)(input); }\nvar readline = __webpack_require__(/*! readline */ \"readline\");\n\n\nvar rl = readline.createInterface({\n  input: process.stdin,\n  output: process.stdout\n});\nvar Repl = /*#__PURE__*/function () {\n  function Repl() {\n    _classCallCheck(this, Repl);\n  }\n  _createClass(Repl, [{\n    key: \"start\",\n    value: function start() {\n      var program = new _exec_program_exec_program__WEBPACK_IMPORTED_MODULE_0__[\"default\"]();\n      console.log(_shared_constants__WEBPACK_IMPORTED_MODULE_1__[\"default\"].Strings.Repl.WELCOME_MESSAGE);\n      rl.setPrompt(_shared_constants__WEBPACK_IMPORTED_MODULE_1__[\"default\"].Strings.Repl.PROMPT);\n      rl.prompt();\n      rl.on('line', function (line) {\n        var isLineEmpty = line === null || line === '';\n        if (isLineEmpty) {\n          console.log(_shared_constants__WEBPACK_IMPORTED_MODULE_1__[\"default\"].Strings.Repl.EXIT_MESSAGE);\n          process.exit(_shared_constants__WEBPACK_IMPORTED_MODULE_1__[\"default\"].ExitCodes.NORMAL);\n        }\n        program.readLine(line);\n        rl.prompt();\n      }).on('close', function () {\n        console.log();\n        console.log(_shared_constants__WEBPACK_IMPORTED_MODULE_1__[\"default\"].Strings.Repl.EXIT_MESSAGE);\n        process.exit(_shared_constants__WEBPACK_IMPORTED_MODULE_1__[\"default\"].ExitCodes.NORMAL);\n      });\n    }\n  }]);\n  return Repl;\n}();\n\n\n//# sourceURL=webpack://node-basic-lang/./src/repl/repl.js?");

/***/ }),

/***/ "./src/shared/constants.js":
/*!*********************************!*\
  !*** ./src/shared/constants.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__)\n/* harmony export */ });\nvar constants = {\n  ExitCodes: {\n    NORMAL: 0,\n    INVALID_ARGUMENT: 9\n  },\n  Strings: {\n    Repl: {\n      WELCOME_MESSAGE: 'BASIC 0.0.10 (December 6, 2022)',\n      PROMPT: '>>> ',\n      EXIT_MESSAGE: 'Have a great day :)'\n    }\n  }\n};\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (constants);\n\n//# sourceURL=webpack://node-basic-lang/./src/shared/constants.js?");

/***/ }),

/***/ "fs":
/*!*********************!*\
  !*** external "fs" ***!
  \*********************/
/***/ ((module) => {

module.exports = require("fs");

/***/ }),

/***/ "readline":
/*!***************************!*\
  !*** external "readline" ***!
  \***************************/
/***/ ((module) => {

module.exports = require("readline");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = __webpack_require__("./src/index.js");
/******/ 	
/******/ })()
;