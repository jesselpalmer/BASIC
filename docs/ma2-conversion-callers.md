# Selected-MA2 conversion caller observations

Design/evidence contract for #123/#116/#128. Distinguish the already captured
ATOF routine and bounded unsigned source converter from the language callers
VAL, floating READ and integer READ. Record executed behavior, not a permissive
shared parser or an inferred public error policy.

Use the same pinned V4A-12 software MA2 build and a separately booted reference
copy. Preserve the manual clock adjustment, missing INIT and save/filesystem
limitations. The probes measure internal numeric conversion, assignment and
error/cursor state; their output transports observations and is not a general
terminal/file/default/RNG oracle.

Capture VAL sign/space/prefix/exponent/invalid cases with an explicitly initialized
assignment target. Include status failures and intermediate arithmetic events;
record ERR/ERL plus the target's post-handler CVTF$ bytes when RESUME skips the
failed statement. Do not infer an untrapped continuation from that transfer.

Capture floating/integer READ separately. RESTORE and skip earlier fields with
string READ before each attempted numeric field so a prior failure cannot move
the next test's starting position. Probe the next string field after each numeric
READ to observe cursor movement. Do not assume that integer READ uses assignment
truncation or that VAL and READ share complete/prefix input rules.

For every retained probe, compare LIST with the exact authored source, RUN twice
and retain source/output hashes, normalization, all case identities, observed
values/events/cursor state and installation qualifications. Keep original game
attribution and public historical activation unresolved. These authored probes
are not new corpus listings or complete game passes. CI consumes captured text
and JSON offline without downloading or executing historical binaries.

## Retained reference observations

Use the [selected build](rsts-v4a-build.md) and its pinned loader SHA-256
`e1add1ea800307764a97a0eb8964fb3dca88403825c3e9a500d68eac786cd596`,
with SIMH commit `698dc8a1b2135ab03f1da0be9ee44b5f1beeadc6`.
The [observation record](ma2-conversion-caller-observations.json) pins all source
and output hashes, exact LIST agreement, two completed final RUNs per probe,
raw LF-body hashes and all case identities. A private disk copy/controller was
used for the retained captures. The manually entered clock, missing INIT and
prior filesystem/save limitations remain as documented in the selected build.

| Probe                                                                                 |           Retained cases | Captured outcome                                                                                     |
| ------------------------------------------------------------------------------------- | -----------------------: | ---------------------------------------------------------------------------------------------------- |
| [VAL caller](ma2-val-caller-probe.bas), [output](ma2-val-caller-output.txt)           |                       32 | 14 values; 18 error 52 transfers at 7020.                                                            |
| [READ callers](ma2-read-caller-probe.bas), [output](ma2-read-caller-output.txt)       | 24 floating + 24 integer | Floating: 14 values / 10 error 52 transfers at 90. Integer: 6 values / 18 error 52 transfers at 390. |
| [VAL intermediate event](ma2-val-event-probe.bas), [output](ma2-val-event-output.txt) |                        1 | Forty-digit nines raise error 48 at 30; after RESUME 40 the target remains 7.                        |

VAL accepts the empty string as zero, unary signs, leading/trailing ASCII spaces,
and an embedded space: `"1 2"` becomes 12 (words `[0x4240,0]`). It rejects the
retained trailing comma/text, repeated sign/point/exponent, incomplete exponent
and percent cases with 52, rather than accepting a successful numeric prefix.
`"1E39"`, `"0E32768"` and `"9.999999E-37"` also produce 52 in these caller
positions. `"0E999"` becomes zero; both retained decimal-cutoff neighbors become
exactly 1. These are selected complete strings, not a specification for all bytes
or a reason to loosen the bounded source converter's grammar.

Numeric READ rejects all seven retained quoted fields, including `"1"`,
`"1.5"`, `" 1 "` and the empty quoted string. Floating READ accepts the tested
unquoted decimal/fraction and `1E2`, while integer READ accepts only the six
simple in-range integer spellings. Its fractional, exponent and out-of-range
fields produce 52; they do not reuse floating assignment truncation or subscript
error 51. String READ, used for positioning and observation, strips enclosing
quotes and preserves the retained quoted contents, including embedded spaces
and the comma in `"1,2"`.

After every retained failed numeric READ, RESUME past the statement shows the
target still 7 and the next string READ returns the **same field**. After every
successful numeric READ it returns the following field. Each trial RESTOREs and
skips earlier fields using string READ, so this is measured cursor state rather
than a cursor inferred from the following trial. Reproduction must keep that
reset/skip structure and handler transfer intact.

All VAL failures likewise show the initialized target 7 after skipping the
failed assignment. The isolated long-mantissa probe distinguishes a completed
error 48 transfer from status-to-error 52 cases. It does not establish untrapped
range replacement, event timing within arbitrary expressions, repeated RESUME,
retry or general stack unwinding. An earlier exploratory VAL batch did not
complete; standalone point, control/high-byte strings and broader prefix/byte
families remain unresolved, with no accepted result inferred from that attempt.

## Reproduction and integration boundary

Enter each authored source in the qualified reference, LIST and compare every
numbered line exactly, then RUN twice to FINISHED. Exclude dynamic RUN headers
and Ready prompts, normalize CRLF to LF and remove trailing ASCII spaces per
line, retaining one final LF. The JSON records hashes before per-line trimming
as well as normalized output identities. CVTF$ bytes `a,b,c,d` reconstruct memory
words `[c*256+d,a*256+b]`; the integer phase observes its signed word directly.
Do not treat normalized spacing or these probe programs as historical output
acceptance, new corpus listings or full-game passes.

Implementing callers still requires historical DATA/AST/value binding,
source-located diagnostics, event/handler ownership, INPUT policy, byte rules and
preflight for every accepted form. The current source converter remains scoped
to complete unsigned source spellings; this evidence does not make VAL/READ
publicly executable with historical semantics. READ/DATA can remain excluded
from the first-game slice because that candidate does not require them.
All 108 corpus dispositions, original game attribution and zero certified
historical passes remain unchanged; native is the only executable profile.
