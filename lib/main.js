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

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ Basic)\n/* harmony export */ });\n/* harmony import */ var os__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! os */ \"os\");\n/* harmony import */ var os__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(os__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! fs */ \"fs\");\n/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! path */ \"path\");\n/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(path__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var readline__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! readline */ \"readline\");\n/* harmony import */ var readline__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(readline__WEBPACK_IMPORTED_MODULE_3__);\n/* harmony import */ var _shared_constants__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./shared/constants */ \"./src/shared/constants.js\");\nfunction _typeof(obj) { \"@babel/helpers - typeof\"; return _typeof = \"function\" == typeof Symbol && \"symbol\" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && \"function\" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? \"symbol\" : typeof obj; }, _typeof(obj); }\nfunction _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError(\"Cannot call a class as a function\"); } }\nfunction _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if (\"value\" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }\nfunction _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, \"prototype\", { writable: false }); return Constructor; }\nfunction _toPropertyKey(arg) { var key = _toPrimitive(arg, \"string\"); return _typeof(key) === \"symbol\" ? key : String(key); }\nfunction _toPrimitive(input, hint) { if (_typeof(input) !== \"object\" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || \"default\"); if (_typeof(res) !== \"object\") return res; throw new TypeError(\"@@toPrimitive must return a primitive value.\"); } return (hint === \"string\" ? String : Number)(input); }\n\n\n\n\n\nvar Basic = /*#__PURE__*/function () {\n  function Basic() {\n    _classCallCheck(this, Basic);\n    this.main();\n  }\n  _createClass(Basic, [{\n    key: \"run\",\n    value: function run(source) {\n      var tokens = source.split(' ');\n      tokens.forEach(function (token) {\n        console.log(token);\n      });\n    }\n  }, {\n    key: \"runPrompt\",\n    value: function runPrompt() {\n      var _this = this;\n      console.log(_shared_constants__WEBPACK_IMPORTED_MODULE_4__[\"default\"].Strings.Repl.WELCOME_MESSAGE);\n      var rl = readline__WEBPACK_IMPORTED_MODULE_3___default().createInterface({\n        input: process.stdin,\n        output: process.stdout\n      });\n      rl.setPrompt(_shared_constants__WEBPACK_IMPORTED_MODULE_4__[\"default\"].Strings.Repl.PROMPT);\n      rl.prompt();\n      rl.on('line', function (line) {\n        var isLineEmpty = line === null || line === '';\n        if (isLineEmpty) {\n          console.log(_shared_constants__WEBPACK_IMPORTED_MODULE_4__[\"default\"].Strings.Repl.EXIT_MESSAGE);\n          process.exit(_shared_constants__WEBPACK_IMPORTED_MODULE_4__[\"default\"].ExitCodes.NORMAL);\n        }\n        _this.run(line);\n        rl.prompt();\n      }).on('close', function () {\n        console.log(_shared_constants__WEBPACK_IMPORTED_MODULE_4__[\"default\"].Strings.Repl.EXIT_MESSAGE);\n        process.exit(_shared_constants__WEBPACK_IMPORTED_MODULE_4__[\"default\"].ExitCodes.NORMAL);\n      });\n    }\n  }, {\n    key: \"runFile\",\n    value: function runFile(filePathStr) {\n      var filePath = path__WEBPACK_IMPORTED_MODULE_2___default().basename(filePathStr);\n      try {\n        var data = fs__WEBPACK_IMPORTED_MODULE_1___default().readFileSync(filePath, {\n          flag: 'r'\n        });\n        this.run(data.toString(_shared_constants__WEBPACK_IMPORTED_MODULE_4__[\"default\"].DEFAULT_CHAR_SET));\n      } catch (err) {\n        console.error(err);\n        process.exit((os__WEBPACK_IMPORTED_MODULE_0___default().constants.errno.ENOENT));\n      }\n    }\n  }, {\n    key: \"main\",\n    value: function main() {\n      var isTooManyArgs = process.argv.length > 3;\n      var isFilenameInputted = process.argv.length === 3;\n      var filenameIndex = 2;\n      if (isTooManyArgs) {\n        console.log(_shared_constants__WEBPACK_IMPORTED_MODULE_4__[\"default\"].ErrorMessages.E2BIG);\n        process.exit((os__WEBPACK_IMPORTED_MODULE_0___default().constants.errno.E2BIG));\n      } else if (isFilenameInputted) {\n        var filePath = process.argv[filenameIndex];\n        this.runFile(filePath);\n      } else {\n        this.runPrompt();\n      }\n    }\n  }]);\n  return Basic;\n}();\n\n\n//# sourceURL=webpack://node-basic-lang/./src/basic.js?");

/***/ }),

/***/ "./src/index.js":
/*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var _basic__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./basic */ \"./src/basic.js\");\n\nnew _basic__WEBPACK_IMPORTED_MODULE_0__[\"default\"]();\n\n//# sourceURL=webpack://node-basic-lang/./src/index.js?");

/***/ }),

/***/ "./src/shared/constants.js":
/*!*********************************!*\
  !*** ./src/shared/constants.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__)\n/* harmony export */ });\nvar constants = {\n  ExitCodes: {\n    NORMAL: 0\n  },\n  Strings: {\n    Repl: {\n      WELCOME_MESSAGE: 'BASIC 0.0.10 (December 6, 2022)',\n      PROMPT: '>>> ',\n      EXIT_MESSAGE: 'Have a great day :)'\n    }\n  },\n  ErrorMessages: {\n    E2BIG: 'Usage: nBASIC [script]'\n  },\n  DEFAULT_CHAR_SET: 'utf-8'\n};\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (constants);\n\n//# sourceURL=webpack://node-basic-lang/./src/shared/constants.js?");

/***/ }),

/***/ "fs":
/*!*********************!*\
  !*** external "fs" ***!
  \*********************/
/***/ ((module) => {

module.exports = require("fs");

/***/ }),

/***/ "os":
/*!*********************!*\
  !*** external "os" ***!
  \*********************/
/***/ ((module) => {

module.exports = require("os");

/***/ }),

/***/ "path":
/*!***********************!*\
  !*** external "path" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("path");

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