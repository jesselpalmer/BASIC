# MA2 numeric expressions through the shared parser

Design before implementation for #116/#117/#123. Add an internal conformance
entry for one complete selected-MA2 numeric expression, using the existing
Parser and precedence/nesting owners. This returns an immutable Expression,
never a Program or a native-labelled historical execution snapshot. It is not
a public package export or historical dialect selection.

The internal entry chooses the existing historical scanner explicitly with
unnumbered input and copied physical line/offset options. RAW_NUMBER goes
straight to the merged literal preparer: preserve spelling, physical UTF-16
span, canonical words and separate unary signs, with no host-number decoding.
Reject integer suffixes, input limits, conversion status and numeric events with
located unsupported-literal diagnostics. No fallback or source rewriting.

Keep the accepted conformance grammar to first-game numeric forms: decimals,
short numeric variables/one- or two-index array references, grouping, signs,
ordered + - * /, and parenthesized unary INT/ABS. Validate arity and known
numeric argument kinds; reject strings/string names, power, other intrinsics,
unknown calls and trailing input instead of inheriting native-only behavior.
Array references are syntax only; declarations, index conversion and storage
remain preparation/runtime obligations. Do not claim historical effect order or
additional arithmetic precedence from native compatibility. Native parser and
public constructor/context behavior remain unchanged.

Verify all 396 captured ATOF spellings through this entry; test compact source,
single expression consumption, malformed/unimplemented forms, copied locations,
immutable/deep/flat trees and independent native AST/value/error behavior.
Installed ESM/CommonJS and real Chromium consumers must continue rejecting the
historical public option and foreign literals. The supported historical program
parser, remaining support matrix and all 108 corpus dispositions stay gated.
