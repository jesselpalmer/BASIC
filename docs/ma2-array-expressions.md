# Shared MA2 array-expression conformance

Design before implementation for #58/#116/#123. Add a separate internal array
session factory to the existing scalar session and iterative expression driver.
It owns an explicitly declared MA2 ArrayStore and scalar Map together. The
constant-only and scalar-only factories keep rejecting array expressions.
No additional parser, executor, historical Program or public dialect is created.

Every expression/comparison and assignment target is parsed completely and
preflighted, including all nested references/ranks, before numeric work. Array
reads evaluate indices left to right on the existing traversal and retain MA2
words in the result. Element assignment evaluates its complete RHS first, then
its target indices left to right, committing only a normal value. Injection
checks exact representability before evaluating indices. Operand/index numeric
events stop later work, retain their physical location/continuation, and leave
all cells unchanged. These pure conformance ordering rules do not certify
historical effectful operand order or statement/error handling.

This stage accepts **exact integer observations only** for subscripts. Fractional
or unsafe integer observations reject explicitly with UNSUPPORTED_MA2_INDEX;
they are not truncated or reinterpreted as BASIC errors 51/55. Existing bounded
shape/rank/offset checks and explicit zero descriptors remain implementation
conformance rules, not historical DIM/default/index semantics. The mathematical
word converter and retained 32 subscript observations remain separate facts.

Snapshots are detached bounded number-valued observations; evaluation never
reconstructs descriptors from snapshots. Reset allocates new arrays before
clearing scalars, preserving old state if declaration validation fails. Distinct
sessions own independent stores. Native callback replacement continues through
the dynamic array-owner accessor.

Verify rounded chains across scalar/array reads and writes, exact injection,
all retained decimal conversions through cells, nested/2D references, both
comparison operands, RHS/index events and ordering, whole-tree preflight,
physical spans, failure atomicity, independent/fresh/reset owners, immutable
observations and long flat expressions. Require full local and installed/type
checks plus Linux/macOS actual Chromium and exact archive gates. Historical
activation, complete index/error/default rules, loops/I/O and every corpus
acceptance obligation remain open; #109 stays NOT READY.

## Implemented evidence

Four hundred tests include all 396 retained source-conversion spellings through
array assignment, cross-cell/scalar rounded chains, nested indices/comparisons,
exact injections, RHS/index numeric events, preflight and atomic reset failures.
The fourteenth installed/browser embedding scenario preserves private exports,
native scalar/array namespaces, nested indices and fresh run ownership. These
checks reuse existing captures and do not add historical game evidence.
