# Selected BASIC-PLUS numeric INPUT rows

The `basic-plus-v4a12-ma2` profile accepts numeric scalar lists such as
`INPUT X,Y`, including an optional literal prompt. Targets retain the shared
`InputTargetsStatement` AST and physical locations. Each name must be a short
numeric scalar (`A`, `A0`). Indexed targets, string lists, integer-suffixed
names and other scanner forms remain outside this selected slice.

The [archived probes](ma2-input-rows-reference.json) run on reconstructed
RSTS V4A-12 MA2 and archived V04B-17. Both systems agree on these observations:

- Commas separate numeric fields; surrounding spaces are ignored.
- Empty fields are zero. A blank line supplies one zero field.
- A short response commits supplied fields, then requests another line for the
  remaining targets. Continuation uses an empty literal prompt.
- Fields after the last requested target are discarded, including surplus text.
- An invalid numeric field restarts the complete target list and repeats the
  original literal prompt. Earlier assignments remain visible until overwritten.
- Stopping at a continued or retried prompt preserves earlier assignments. A new
  RUN allocates fresh selected state.

The monitors differ in retry wording. V4A-12 prints `ILLEGAL NUMBER at line N`;
V04B-17 prints `DATA FORMAT ERROR at line N`. The selected V4A profile uses the
former text, including its captured trailing space and newline. The reference
records V04B's differing output separately. Quoted numeric fields take this
retry path. Complete signed decimal/scientific fields use MA2 conversion;
conversion events and broader historical handlers remain unsupported outcomes.

The existing single-scalar contract is retained. In particular, this row scanner
does not silently add trimming, continuation, quoting or retries to scalar INPUT.
The response limit is 65,536 characters per physical row, and a selected numeric
field is limited to 255 characters. Printable ASCII is accepted; tabs, line
breaks and other controls remain gated. Source target count retains the shared
4,096-target limit.

A run owns each pending read. After every await, a generation/abort check precedes
any field assignment. Runtime-owned callbacks keep partial commits and retry
writes under the synchronous mutation guard. One whole INPUT costs one Step or
instruction-budget unit regardless of continuations and retries. Stop or a valid
replacement aborts an uncooperative provider; its late response cannot mutate a
fresh run. A rejected replacement retains the existing pending row and source.

```sh
python3 scripts/research/capture-ma2-input-rows.py \
  --simulator /path/to/simh/BIN/pdp11 --v4a-disk /path/to/raw-v4a.dsk \
  --v4b-disk /path/to/RSTS11v4B.DSK --output /tmp/ma2-input-rows-reference.json
```
