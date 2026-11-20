# Selected BASIC-PLUS literal subroutines

The selected `basic-plus-v4a12-ma2` profile accepts literal `GOSUB` and
`RETURN` through the library, CLI/editor and browser driver. A call saves the
real following instruction, including a same-line colon successor. Nested
calls share scalar values, array values and the run's lexical FOR state.
RETURN restores the saved position; it does not restore scalar values or
discard FOR headers executed by the callee. A GOTO from a callee can reach a
caller's initialized NEXT. CHECKR uses FOR headers immediately before RETURN
to change the caller's visible X/Y values and end its scanning loops.

The [archive reference](ma2-subroutines-reference.json) matches reconstructed
RSTS V4A-12 MA2 and archived V04B-17. Seven complete probes cover nested and
recursive calls, colon successors, early RETURN, caller-loop continuation,
callee headers surviving RETURN, reused loop variables, and CHECKR's X/Y
pattern. A separate archived probe records RETURN WITHOUT GOSUB. The selected
runtime reports that condition as a located `RETURN_WITHOUT_GOSUB` diagnostic.

Calls reuse shared ControlFlow and the same driver. Each GOSUB and RETURN
consumes one instruction-budget step, and Step/Stop work at those boundaries.
A fresh run clears call positions and lexical FOR state. At most 1024 calls
may be active, matching the existing bounded runtime contract rather than
claiming the archive's exact resource limit. Native and EDUSYSTEM-30 keep their
existing suspended caller/callee loop contexts.

## Unexecuted FOR header boundary

Additional probes observe the scalar after NEXT when its paired FOR header has
never executed. The earlier UNSEEN capture printed only a body marker before
END, so it did not establish that NEXT left the scalar unchanged. These new
captures show an implicit-step NEXT changes 0 to -1, 5 to 4 and -5 to -6 on its
first encounter. Explicit STEP leaves the scalar unchanged in the captured
cases. Later reentry has additional state: an unchanged scalar stays at 4,
while assigning -2 makes a later NEXT enter the body at -1 and 0.

This wider uninitialized-header behavior is not implemented. The selected
profile reports `UNSUPPORTED_MA2_LOOP_STATE` at such a NEXT before changing its
scalar or following its loop edge. Earlier statements retain their completed
effects. An executed header, including one whose initial bounds skip the body,
continues to use the documented persistent lexical state. The complete CHECKR
path uses executed headers and does not rely on this unsupported boundary.

Computed GOSUB targets, ON GOSUB and broader statement modifiers remain outside
this selected subset. Missing literal targets, including dead source, fail
whole-source validation before replacement or execution effects.

```sh
PYTHONDONTWRITEBYTECODE=1 python3 scripts/research/capture-ma2-subroutines.py \
  --simulator /path/to/simh/BIN/pdp11 \
  --v4a-disk /path/to/rebuilt/raw.dsk \
  --v4b-disk /path/to/RSTS11v4B.DSK \
  --output /tmp/ma2-subroutines-reference.json
```
