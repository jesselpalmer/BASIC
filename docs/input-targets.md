# Native INPUT target lists

**Status:** implemented first native #121 slice; design recorded before code.
Historical input/line/file profiles and whole-game certification remain pending.

## Evidence and native boundary

[BASIC-PLUS October 1972](https://bitsavers.trailing-edge.com/pdf/dec/pdp11/rsts-11/V004/DEC-11-ORBPA-A-D_BASIC-PLUS_LangMan_Oct72.pdf)
§3.3.3 documents comma-separated input lists and inline prompts; §5.3 and §10.3
distinguish fields from whole-line text. Its continuation after short responses,
ignored surplus fields, quoting and line terminators require historical policy.
The pinned MUGWUMP line 300 uses `INPUT M,N`; that source form is evidence for
coordinate input, not certification of the game's PETS/E mapping or semantics.

Native retains its existing single-scalar INPUT contract exactly: numeric retry
uses complete finite signed decimals, while a single string target receives the
entire untrimmed response, including commas and quote characters. Extend the
same single-target behavior to explicit DIM array elements. Multiple targets use
the strict row contract below. These are explicit native policies, not claims of
BASIC-PLUS continuation, surplus-field handling, coercion or INPUT LINE emulation.
LINPUT, INPUT LINE, channel input, prompt expressions/interleaved prompts, compact
keywords and historical modifiers remain #115/#116/#121/#128 work.

## Source and immutable syntax

Accept `INPUT ["prompt";] target [, target ...]`, with the same optional literal
prompt and semicolon as before. Each target is a scalar or one/two-dimensional
array reference. Existing single-scalar source retains the exact InputStatement
AST (`target` remains Variable). New list/indexed source has InputTargetsStatement
with the same prompt field and a readonly targets list; no reserved names change.
Retain physical spans, raw text and source round trips. Limit a statement to
4096 targets, including constructed trees. Validate new list shapes and all
array declarations/ranks/static index types before any host effect, even after
END. Immediate scalar lists work through readLineAsync; indexed immediate INPUT
requires a complete program before requesting input, like DIM.

## Response and commit rules

A multi-target statement requests exactly one physical response at a time,
using the existing `prompt + "? "` host boundary. Require exactly as many
comma-separated fields as targets. Trim spaces/tabs outside double-quoted fields;
preserve quoted contents and unquoted interior spaces. Doubled quotes inside a
quoted field decode to one quote. Backslashes and apostrophes are ordinary text.
Reject unmatched/embedded unquoted quotes, text after a closing quote, and CR/LF.
Empty fields are valid for string targets, including a final empty field. Numeric
fields, quoted or unquoted, trim surrounding spaces/tabs then require a complete
finite signed native decimal/scientific spelling. Never use permissive prefix
numeric conversion. Cap multi-target responses at 65536 UTF-16 units; exceeding
that limit is a located INPUT_LIMIT error rather than an unbounded retry.

Validate/decode/convert the whole row before any target assignment. Wrong field
count, malformed quoting or an invalid numeric field emits
`Invalid input; enter N comma-separated values.` and retries the whole row with
the same prompt. No partial fields survive a retry, and extra fields are never
silently ignored. EOF/failure/cancel before a valid response assigns nothing.
Single-target numeric retry text and raw string behavior remain unchanged.

After a valid response, assign targets left to right through the evaluator.
Earlier successful assignments affect later array-index expressions. Evaluate
indices only at this commit boundary, once per target, under the synchronous
host-callback mutation guard. An index/bounds/host error stops the run, preserving
earlier successful assignments; it does not retry input or roll back the row.

## Async and validation

Use the existing abort race and run generation. Check generation/abort after the
await and before committing any value. Replacement/Stop releases even an
uncooperative provider; late replies/rejections cannot touch fresh state. A whole
INPUT list costs one Step/gate/budget unit regardless of retries. Synchronous
methods report ASYNC_INPUT_REQUIRED before asking. Preserve caller loops, call
return addresses, DATA cursors, independent instances and fresh reruns.

Test exact old AST/whole-line behavior, malformed source/rows, quoted commas and
escapes, empty/mixed fields, numeric overflow/prefix rejection, inclusive target
and response limits, partial retry/EOF, bounds/index order/reentrancy, cancellation
and replacement (including a replacement started by the provider), gates/budgets
and immutable snapshots. Exercise an authored probe retaining unchanged MUGWUMP
290/300 through direct/installed ESM/CommonJS, types, CLI/editor save/load/LIST/RUN,
Chromium input/retry/Step/Stop/import/export/reload and exact extracted archives.
No probe is an unchanged whole-game pass; #109 remains NOT READY.
