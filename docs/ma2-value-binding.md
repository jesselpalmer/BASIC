# MA2 value and operation binding

Design before implementation for #116/#123. Bind the merged word primitives to
the closed immutable `{kind: 'ma2', words: readonly [number, number]}` value from
the shared-value contract. This owns numeric identity and operation results;
it is not an evaluator, storage owner, public BasicValue or executable profile.

An explicit word factory snapshots each supplied word once, validates the
canonical two-word domain and freezes independent value/word objects. Keep
four-word precision, signed zero and zero-exponent fractions unsupported.
Malformed containers/counts/words throw without coercion or iterator access.
Source-literal binding uses the merged raw/word validator; host-number binding
uses the merged exact injection primitive. Neither guesses decimal spellings.

Bind ordered add/subtract/multiply/divide and canonical unary INT/ABS/negation
without observing a binary64 number between operations. Normal results carry a
MA2 descriptor. Numeric events remain events with their original code/reason
and a separately tagged frozen continuation descriptor, never a normal value.
BASIC event handling and committing continuation state remain execution-owned.
Numeric comparison and exact public observation delegate to the existing word
owners. No expression traversal, mutable state, native fallback or host effects.

Test binding against the retained independent machine arithmetic/range/unary/
comparison captures, not just round trips. Include multi-operation intermediates
whose words differ from a host arithmetic reconstruction, ordered multiplication,
normal/exceptional paths, source/injection differences, hostile read-once words,
immutable detached results and unchanged native rejection. Keep all coverage
floors unchanged. Shared scalar/array/loop storage, parser integration, event
observations, first-game I/O and public historical activation remain later gates.
