# 23 Matches: reviewed correction acceptance

Design before tests for #115/#129. Preserve `23mtch.bas` unchanged and add a
separately named fixture with exactly one inserted byte: the already reviewed
terminal semicolon at label 380. See `classic-source-review.md` for the book
edition, page, scan hash and visible continued-output evidence. Keep the pinned
transcription's quoted spacing and every other byte; this is not a complete
scan-normalized listing or a certified EduSystem profile.

Run the same bounded seven-moves-of-one loss/replay path for both fixtures.
Independently assert the complete output, all six computer choices and remaining
counts, replay initialization, invalid human move retries with unchanged state,
and the explicit RND(0) arity blocker at label 330. The only output difference
on the matching legal path is six suppressed newlines after `I TOOK`.
EOF bounds this indefinitely replaying program at its next input; do not add an
END or rewrite its random call. Verify reruns and cancellation preserve source.

Share these oracles across direct/installed ESM/CommonJS consumers, real CLI
file execution and browser import/input/export/reload/Stop. Retain the existing
raw-source regressions. No historical pass, whole-listing certification or
release readiness follows from this corrected native path.
