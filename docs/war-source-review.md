# WAR source review

The March 1975 description and listing, pages [230–231][book], identify an
unknown author and a program found on a DIGITAL in-house DECsystem-10. This
is WAR, separately preserved from WAR-2. The printed machine identification
does not establish a specific DECsystem-10 BASIC version.

The [raw fixture](../scripts/package/fixtures/classic/war.bas) preserves the
pinned corpus bytes. The [reviewed text](../scripts/package/fixtures/classic/war-mar75-text.bas)
restores the printed card example `S-7` at 110, three bell characters at 470,
the newline after the tie message at 530, and `L(P+1)=0` at 540. The raw
`<>0` comparison prematurely declares the shuffled pack exhausted after its
first deal. The description explicitly explains that the printed `^G`
notation at 470 and 650 denotes the teletype bell; the reviewed fixture encodes
those as byte 7, rather than the literal caret and letter G.

## Archived execution and public blockers

The [RSTS reference](war-rsts-reference.json) executes the complete reviewed
listing on reconstructed RSTS V4A-12 MA2 and archived V04B-17. This is candidate
execution evidence, not a certification of the original DECsystem-10 dialect.
The capture omits `270 RANDOM` only to retain the stock initial random stream.
Both builds match 26 card pairs, YES/NO retries, a tie, the final score and
deck exhaustion. Cards are READ from the string DATA and shuffled by the
original FOR-loop algorithm; terminal bells remain in the transcript.

A public MA2 adaptation is still blocked. The exact reviewed source rejects
`RANDOM` at 270 before effects; `RANDOMIZE` is the existing selected spelling.
With only that spelling adapted, the first execution failure is at 110,
`UNSUPPORTED_MA2_VALUE: MA2 unsupported: line-width`, after the introductory
PRINT at 100 leaves the cursor near the terminal's right edge. Stock RSTS
continues the long adjacent text across a terminal line. The public renderer's
72-column bound currently rejects it. Subsequent card/result output also
relies on retained columns. A source-backed wrapping policy and complete
library/CLI/browser acceptance are required before adding a public game.
`RND(X)` already belongs to the selected subset and needs no new function.

No new runnable listing or original-dialect whole-game certification follows
from this review. WAR remains open in the 108-file release gate.

```sh
python3 scripts/research/capture-war-rsts.py \
  --simulator /path/to/simh/BIN/pdp11 --v4a-disk /path/to/raw-v4a.dsk \
  --v4b-disk /path/to/RSTS11v4B.DSK --output /tmp/war-rsts-reference.json
```

[book]: https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=230
