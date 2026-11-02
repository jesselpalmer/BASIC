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
