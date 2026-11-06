# Word-preserving MA2 cells in the shared array store

Design before implementation for #58/#116/#123. Add a closed internal MA2
conformance storage mode to the existing ArrayStore allocation, shape, rank,
integer-offset and snapshot owners. Native construction remains the default.
An internal factory selects numeric MA2 cells only, not a public dialect,
Evaluator option, historical Program or alternate array allocator.

Validate all explicit declarations/resource limits before allocation. The
conformance subset accepts only uppercase short numeric array identities and
initializes its cells with immutable canonical zero descriptors. This is explicit
conformance initialization, not historical DIM/default-variable semantics. Reuse
inclusive bounds, 1D/2D offset order and current bounded allocation/snapshots.
Conformance accesses accept already-computed integer indices only; do not apply
mathematical MA2 truncation as a historical subscript policy or choose errors 51/55.

MA2 writes snapshot/validate tagged words and exact host injection before index
reads or committing. Unsupported encodings/injection outcomes retain explicit
reasons and source locations; invalid references/indices leave cells unchanged.
Stored descriptors remain immutable across reads and later arithmetic. Snapshot
observations are detached frozen exact numbers, never internal arithmetic inputs.
Fresh stores own fresh cells. Reject crossing native/MA2 access or CHANGE modes;
keep all existing native array, CHANGE, host/evaluation-order behavior unchanged.

Verify word preservation, host/source differences, scalar/array-name independence,
zero and inclusive edges, 2D order, copy-on-write/hostile words, unsupported/failed
writes, declaration/rank/resource validation, bounded exact snapshots, fresh
stores and native regressions. Installed/browser/type consumers keep the factory
private and native array behavior intact. Bind array expressions, historical
conversion/default/error rules, control flow and complete game acceptance later.
