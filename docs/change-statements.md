# Native CHANGE statements

Design before code for #59/#58. This delivers a runnable native prerequisite;
it does not activate a historical profile or certify a game.

## Evidence and deliberate native boundary

The October1972 BASIC-PLUS manual §5.2, printed5-5/5-7 (PDF71/73), was rendered
and reviewed from SHA-256
`684b54d7218a2fb581bf324b175c1e37dc609e718218a81a51b22c31a1e936bd`.
Its CAT example writes `[3,67,65,84]`; its reverse example converts
`[5,65,66,67,68,69]` into ABCDE. Table5-2 (printed5-6/PDF72) permits string
bytes0..255, including high-bit characters. This is character-code conversion,
not VAL/decimal formatting or the packed CVT binary-string representation.

Accept `CHANGE S$ TO A` and `CHANGE A TO S$`, with two bare native names, exactly
one string scalar and one explicitly DIM-declared one-dimensional numeric array.
No string expressions, indexed operands, implicit dimensions, integer arrays or
compact spelling are added. CHANGE stays contextual: existing CHANGE scalar and
array assignments/references keep their grammar and AST. TO is already reserved.
Expose a new ChangeStatement in the provisional closed Statement union, with
source/target Variable nodes and their physical locations.

String-to-array writes length in element0 and byte codes in elements1..length;
unused cells keep their values. Array-to-string reads element0 and that prefix,
ignoring unused cells. Empty strings/zero length are supported. Native counts
must be safe nonnegative integers, within the array bound and at most32767;
character codes must be integers0..255. Every input string code unit must fit
that byte domain. These caps/strict fractional rules are deliberate native
contracts, not claims about all historical conversions.

The manual explicitly describes a partial write on string-to-array overflow:
it diagnoses SUBSCRIPT OUT OF RANGE and sets element0 to the number converted.
Native instead validates capacity, length and the entire consumed payload before
any write and fails atomically. Do not reuse this native policy as historical
continued-error behavior. Source/target state remains unchanged on failure.

## Ownership and validation

Use the shared parser/validator/evaluator and execution-owned ArrayStore. A small
statement-shape validator serves parsed and supplied trees. Whole-program
validation resolves rank/declarations even in dead clauses before effects;
single-line editing may retain a forward DIM dependency. The evaluator reads
the string scalar once before attempting its array write; reverse conversion
reads the array directly, never the same-named numeric scalar. Bulk conversion
stays with array storage, without synthetic index expressions or a second store.
Expose Evaluator.change for direct configured evaluator use; it shares exactly
the runtime's conversion owner. The numeric array's own scalar is untouched.

Each CHANGE costs one statement/gate/budget unit, works in sequences, inline
branches and subroutines, and performs no host callbacks or async waits. All
work is bounded by32767 characters/cells. Immediate Basic entry requires a whole
program, before operand access. Reset/Stop/replacement/reruns retain their
existing owners; fresh runs recreate arrays and variables.

Verify manual examples, every byte, exact caps, capacity/rank/type failures,
atomic late-character failures, scalar/array coexistence, immutable supplied
snapshots, dead-code preflight, native CHANGE names, source locations, stepping,
limits, cancellation and reruns. Add shared direct/installed ESM/CommonJS and
consumer-type acceptance, real CLI/editor persistence and actual browser/exact
archive flows. Native numeric spelling remains unchanged; full historical
CHANGE overflow/continued errors and game acceptance stay open.
