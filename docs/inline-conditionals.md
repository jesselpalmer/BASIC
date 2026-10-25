# Native inline conditionals

**Status:** implemented next native #118 slice; design recorded before code.
Historical separators/modifiers/profiles and whole-game certification remain open.

## Source and native boundary

[BASIC-PLUS October 1972](https://bitsavers.trailing-edge.com/pdf/dec/pdp11/rsts-11/V004/DEC-11-ORBPA-A-D_BASIC-PLUS_LangMan_Oct72.pdf)
§3.5 documents inline THEN and IF ... GOTO. §8.5 documents statement/literal
branches, nested IF and the physical-last-clause continuation rule. The pinned
AWARI line 85 has an inline PRINT followed by a conditional same-line GOTO;
LIFE2 repeatedly nests THEN IF. Compact spelling is a separate profile dependency.

Native adopts that line scope with its existing comparisons, types, labels and
loop guards. ELSE binds the nearest unpaired IF. An ELSE clause must follow its
branch before an outer colon. Add no reserved ELSE name: existing scalar/array
names remain valid outside contextual markers; parenthesize ambiguous ELSE values
in PRINT/USING within branches. Quoted/comment text never creates markers.

## Syntax, source and bounds

Keep the existing IfStatement AST for IF comparison THEN literal-label with no
ELSE. Also accept IF comparison GOTO literal-label as that same jump form. New
InlineIfStatement carries condition, consequent and alternate (null if absent).
Each branch is a literal label or one ordinary inline statement, including IF.
Colon-separated statements remain outer sequence members; source is never rewritten.
Branch bodies exclude DIM, DATA, FOR and NEXT in this native slice. Their cross-
clause structural rules remain explicit follow-up, rather than guessing loop or
declaration semantics. These constructs still work in ordinary colon sequences.
No postfix modifiers, backslash separators, block IF/ENDIF or historical profile.

Cap conditional nesting at 128 and all executable condition/body nodes at 4096
per physical line. Validate source and constructed trees, including unreachable
branches, forbidden bodies, malformed labels and cyclic/overdeep structures,
before effects. Flatten iteratively and copy/freeze snapshots without recursion.
Retain physical spans; IF conditions and selected body statements are separate
Step/gate/budget units. Literal target branches are part of the IF unit, with no
synthetic GOTO statement. Immediate IF requires a complete program.

## Continuations and transfer ownership

A false condition without ELSE goes to the next numbered line. Only the
physically last THEN/ELSE clause can continue into the following colon statements;
every other completed clause continues at the next numbered line. Nesting keeps
that physical scope rather than importing block-language behavior. For example:

```bas
10 IF C=1 THEN PRINT "yes" ELSE PRINT "no":PRINT "tail"
20 PRINT "next"
```

True prints yes/next; false prints no/tail/next. In
`IF A=1 THEN IF B=1 THEN PRINT "yes":PRINT "tail"`, either false condition skips
the line; both true conditions print yes/tail. Explicit jumps, END and RETURN
retain their own transfer behavior.

Preparation records a normal successor and branch destinations for each real
instruction; labels enter the first instruction. The control-flow owner tracks
the actual current instruction, not next-position-minus-one. GOSUB saves the
prepared successor, including next-line continuation after a nonlast clause;
RETURN restores caller loops and follows existing guards. Completing a branch
that skips other instructions applies the same native loop-entry/discard checks.
Ordinary contiguous fallthrough adds no whole-loop-table scan. Async INPUT/WAIT
finishes its continuation only after generation/abort checks. No synthetic
instructions or extra budget costs are introduced for skipping an unchosen branch.

## Verification

Use independent traces for every true/false and nested/dangling-ELSE path,
statement/literal branches, same-line tails, GOTO alias, conditional GOSUB return
positions, caller/callee loops, loop-entry errors after skipped headers, END and
RETURN, missing targets/static errors in dead branches, contextual ELSE/USING
names, strings/comments, exact spans and immutable snapshots. Prove inclusive
depth/node bounds, cancellation/replacement, independent/rerun state, INPUT/WAIT,
gates/budgets and nonrecursive preparation. Compare unchanged old ASTs/examples.
An authored AWARI/LIFE2-derived feature probe must name added lexical whitespace
and remain distinct from unchanged-source or whole-game results. Exercise direct/
installed ESM/CommonJS, consumer types, file/editor CLI source round trips,
Chromium Step/highlights/input/Stop/import/export/reload and exact static archives.
Keep #118 and #109 NOT READY for the remaining historical/corpus gates.
