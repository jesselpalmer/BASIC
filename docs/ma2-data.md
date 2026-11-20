# Selected BASIC-PLUS DATA, READ and RESTORE

The public `basic-plus-v4a12-ma2` selection accepts the existing bounded
historical DATA scanner's numeric and quoted-string fields. Numeric READ targets
are short floating scalars or numeric array elements; string READ targets are
short string scalars or string array elements. Integer-percent targets remain
outside this selected subset. See the [archived caller conversion facts](ma2-caller-conversion.md)
for the distinction between floating and integer READ.

DATA fields belong to the immutable, numerically sorted prepared source. Fields
on skipped lines or after END still belong to the pool. Every fresh RUN owns one
shared `DataReader`, including its existing item/list limits. Branches and calls
do not allocate new cursors. RESTORE rewinds only that run's cursor; executing a
DATA statement has no effect on it.

Numeric READ uses the scanned field text and its explicit quoted flag with the
existing MA2 READ converter. Canonical returned words enter scalar/array storage
directly, without a host-number round trip. Unquoted ASCII blanks were already
removed by the historical scanner. Quoted numeric-looking fields produce a
located `MA2_READ_ERROR` for V4A-12 MA2 conversion error 52. The same
quoted-field probe reports error 50 on V04B-17, while both builds preserve
the target and cursor; this profile retains the selected V4A result. Unobserved conversion
numeric-event continuations remain `UNSUPPORTED_MA2_DATA` failures. This activates
neither historical ON ERROR/RESUME nor an untrapped continuation policy.

String READ strips the source delimiters, preserving quoted spaces and commas,
and copies the field into the same bounded string state used by assignment.
An unquoted numeric field read as a string retains its scanned sign and spelling.
Each successful target commits before the next target's array indices are
evaluated. After successful conversion the cursor advances before dynamic target indices
and assignment. Bounds failure therefore retains earlier writes but consumes
the failed field. Conversion failure preserves both target and current field. This cursor behavior
is independently observable in the archived handler probes; public run failures
still terminate the selected run. Exhaustion reports `OUT_OF_DATA` at the first
unsatisfied target.

Whole-source preparation checks DATA limits, bounded strings, target names and
array rank/type syntax before any output or variable write, including dead source.
Dynamic bounds and numeric conversion failures occur at the READ target. Exact
source bytes and physical spans remain part of selected Program validation.

The [capture](ma2-data-reference.json) compares both archived RSTS builds for
mixed fields, left-to-right array writes, restore/order, decimal conversion,
string arrays, failed assignment cursors and numeric quoted-field rejection.

```sh
python3 scripts/research/capture-ma2-data.py \
  --simulator /path/to/simh/BIN/pdp11 --v4a-disk /path/to/raw-v4a.dsk \
  --v4b-disk /path/to/RSTS11v4B.DSK --output /tmp/ma2-data-reference.json
```
