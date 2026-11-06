# MA2 numeric relations in the shared comparison owner

Design before implementation for #116/#123. Bind the existing exact MA2 word
ordering to the six numeric comparison operators in core/comparison.ts. Extract
its existing primitive relation switch so native comparison and MA2 order facts
share that decision. Preserve native type diagnostics, lazy operator behavior,
string restrictions, non-finite direct-helper behavior and physical locations.
Do not observe MA2 values as host numbers to perform their ordering.

The internal MA2 relation entry accepts canonical tagged values and a closed
ComparisonOperator. Validate the operator before reading operands. Exact ordering
produces a frozen boolean result through the shared relation switch; unsupported
word outcomes retain operand identity/reason, and malformed/tag-invalid operands
retain strict primitive validation. No historical string relation, comparison
parser, IF execution, event/handler policy or public dialect/API is added.

Verify all 755 retained independent CMPF rows through all six relations using an
independent truth table, including equality, sign/zero, extrema and adjacent word
values. Check invalid operators before hostile operands, malformed/noncanonical/
four-word boundaries, detached immutable results, and native numeric/string/NaN
behavior and diagnostic locations. Existing installed/browser consumers must keep
the conformance function private. Shared historical comparison parsing and
statement integration remain activation obligations, with every corpus gate open.
