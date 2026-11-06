# Word-preserving MA2 scalar conformance storage

Design before implementation for #116/#123. Extend the existing MA2 expression
context with execution-owned numeric scalar bindings, still using the same Parser,
closed syntax preflight and iterative expression driver as native evaluation.
Add an internal scalar-conformance session factory, not a second executor, public
Evaluator option, historical Program or BASIC statement implementation.

A session owns its Map of canonical immutable MA2 descriptors. Source assignment
validates a complete short numeric scalar target and numeric expression, then
commits only a normal result. Numeric events retain their existing identity,
continuation and source location without changing the target. Invalid source,
unsupported targets and unbound scalars likewise leave prior cells unchanged.
Unbound conformance scalars reject explicitly; this does not choose historical
default-variable semantics. Arrays, strings and integer kinds remain unsupported.

Host injection uses the merged exact binary64 injection primitive and commits
only a representable canonical value. Non-finite, range and precision outcomes
remain explicit with the target location; no decimal guessing or rounding.
Snapshot observations use the exact observation primitive and return detached
frozen number-valued entries. Evaluation/assignment consume stored descriptors,
never snapshots or observed/reconstructed host numbers. Reset and separate
sessions have independent cell ownership; native storage and lifecycle stay intact.

Verify captured source assignments, cross-assignment rounded chains, exact host
injection versus source conversion, source-located unbound/event/unsupported paths,
atomic failed writes, strict target grammar, independent sessions, fresh resets,
immutable detached snapshots and long expression work. Keep the constant-only
entry constant-only, preserve native host/error/array-owner traces, and maintain
installed/browser private-export and historical-context rejection. Historical
Program parsing, comparisons/statements, arrays/loops, event/handler policy and
I/O remain separate gates; all corpus and release obligations remain unchanged.
