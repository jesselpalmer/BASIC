# Constant MA2 expressions in the shared evaluator

Design before implementation for #116/#123. Bind the internal MA2 numeric parser
and immutable value operations through the existing iterative evaluator traversal.
Extract that traversal into one module-private driver with a closed native/MA2
conformance context, retaining native variables, arrays and host callback owners.
No registry, second evaluator, public context or historical Program is added.

The internal source-only entry parses one immutable numeric expression, then
rejects variables/arrays anywhere in that tree before calculation. The accepted
slice is constant literals, groups, signs, + - * / and unary INT/ABS. Parser-owned
kind/arity/unsupported checks remain authoritative. Caller-supplied trees still
enter only the existing native boundary, where foreign literals reject. Parsed
canonical word pairs become immutable descriptors on the same iterative stack;
never observe or reconstruct a host number between historical operations.

Normal results retain a MA2 descriptor. The first arithmetic numeric event stops
constant calculation and returns its original code/reason, frozen continuation
descriptor and copied physical operator location. It is not automatically resumed,
converted to a native fatal diagnostic or committed to a BASIC variable. General
BASIC event/handler semantics remain unresolved and execution-owned. Unsupported
primitive outcomes also retain their identity/location rather than falling back.

Native arity/error timing, left-to-right callback order, array lookup/index order,
finite number behavior and direct foreign rejection must remain unchanged. Test
all retained decimal spellings and source expressions constructed by joining
independent decimal/arithmetic captures, plus chains, signs/groups/INT/ABS,
source-located events, preflight-before-events, depth/flat work, immutability and
native effect traces. Keep coverage floors unchanged and installed/browser public
context/export rejection intact. Shared storage, comparisons, statements, loops,
I/O and full historical activation remain later gates; all corpus obligations stay.

## Implemented evidence

The 429 targeted tests include all 396 retained decimal captures and 28 source/
arithmetic joins constructed from independently retained input/result captures.
Five additional tests cover rounded chains, sign/group/INT/ABS behavior, located
numeric events and preflight rejection, 6,000-term flat work/nesting limits,
immutable results and native arity/callback order. A direct native callback resets
arrays between reference checking and access, proving the shared driver resolves
the live owner. The eleventh installed/browser consumer scenario repeats that
owner check and confirms the conformance entry is not exported. These are pipeline
checks against existing evidence, not new machine captures or game passes.
