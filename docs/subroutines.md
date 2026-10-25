# Literal subroutines

**Status:** implemented first native #57 slice; design recorded before code.
The later [native ON dispatch slice](computed-dispatch.md) shares this call owner.
Historical profiles and full-corpus gameplay certification remain open.

## Evidence and grammar

[BASIC-PLUS October 1972](https://bitsavers.trailing-edge.com/pdf/dec/pdp11/rsts-11/V004/DEC-11-ORBPA-A-D_BASIC-PLUS_LangMan_Oct72.pdf)
sections 3.8.1–3.8.3 document GOSUB followed by a literal line number, RETURN to
the next sequential statement, nested/self calls, and multiple entry/return
points. The pinned AWARI source uses literal GOSUB and RETURN with colon
sequences. Section 3.8.3 makes nesting capacity depend on available storage;
native's fixed bound below is an explicit resource policy, not historical emulation.

Native accepts contextual `GOSUB label` and bare `RETURN`, including as members
of a colon sequence. Labels use the existing unsigned decimal-integer range
1..65535; complete validation checks all literal call targets, even after END,
before effects. The later [native ON slice](computed-dispatch.md) adds bounded
selector lists through the same call owner. Computed literal GOSUB expressions,
`GO SUB`, compact keyword spelling and RETURN arguments remain unsupported. No new reserved words: GOSUB/RETURN
remain ordinary scalar/array names in assignments, DIM and expressions. Recognize
the new forms only at statement position after the existing assignment cases.
Existing valid native source keeps the same AST and meaning.

## Calls and loop ownership

The prepared instruction table supplies a real return position: the instruction
immediately following the call, including another member on the same physical
line, or program end. A call saves that position and its current loop-frame map,
then enters the target line's first instruction with a fresh callee loop map.
Saved maps are retained by reference under exclusive context ownership, not
copied at each recursive call. Scalar and array values remain shared; RETURN
never restores old variable values or loop counters.

Use the native lexical loop-entry guards for GOTO, false IF, call targets and
returns. A new call may enter a FOR header but cannot enter an uninitialized
lexical loop body. Suspended caller frames do not authorize a callee to enter
that body or execute the caller's NEXT. Callee GOTO/loop transitions discard only
the callee's departed frames; caller frames survive until RETURN. RETURN drops
all remaining callee loops and restores the caller map before moving to its
saved position. This allows early return from a callee's own loop without leaking
that loop into its caller.

Preserve native's active-loop-variable rule across suspended contexts as well:
a callee FOR cannot reuse an active caller loop variable. An ownership set tracks
all live loop variable names; finishing/discarding a loop releases its name.
An ordinary assignment to a caller counter is still a shared variable write.
This is an explicit native policy; historical loop-transfer/reuse behavior stays
under #126 and cannot silently replace native guards. Unique ownership also
avoids multiplying copies of the same caller loop frames by recursive depth.

## Limits, errors and lifecycle

Allow at most 1024 active GOSUB calls per run. Reject the next call with a
source-located CALL_STACK_LIMIT before saving another frame or transferring.
Resolve and validate the call destination before saving frames. RETURN without
an active call reports RETURN_WITHOUT_GOSUB at that statement. Missing targets,
malformed syntax and inactive-loop entry remain existing located diagnostics.
No JavaScript recursion, source rewriting or alternate execution driver is used.

GOSUB and RETURN each cost one executed instruction/gate. Step exposes the next
real statement after a call/return; async INPUT/WAIT and cancellation retain the
same run-generation and host ownership rules inside subroutines. END, natural
program exhaustion, error, cancellation and replacement release all call and loop
frames. Falling off the program halts normally and never implies RETURN. Fresh
runs and independent instances begin with empty stacks and fresh variables/arrays.
Immediate readLine/readLineAsync reject GOSUB/RETURN as PROGRAM_REQUIRED before
any call effect, using the same shared parser/runtime.

## Verification and remaining scope

Verify same-line and next-line returns, nested/self calls, exact depth boundaries,
multiple entry/return points, shared values, independent runtimes, missing targets
in dead code, fall-through RETURN errors, caller/callee nested and empty loops,
early returns, illegal transfers and active-variable reuse. Exercise sync/async
Step, gates/budgets, INPUT/WAIT, cancellation/replacement, failed-load recovery,
source spans, immutable AST snapshots, native names and source round trips.

Use independent expected traces and clearly label any spacing-normalized AWARI
call probe; that is neither an unchanged listing nor a full-game compatibility
pass. Verify direct and installed ESM/CommonJS/types/CLI/editor, actual Chromium
and the exact extracted static archive, then Linux/macOS CI. #57 stays open for
GOTO expression OF dispatch, remaining historical semantics and actual whole-game results.
#109 remains NOT READY; no publication is part of this slice.
