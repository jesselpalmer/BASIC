# ZOOP on EDUSYSTEM-30

The [March 1975 listing, page 243](https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=243)
credits Tom Kloos of the Oregon Museum of Science and Industry and identifies
DIGITAL EduSystems 15/30/35. It calls the two-character command decoder the
original version. The scan's SHA-256 is
`311c1be8d3c9361ee9badb59b5a43c43a5b0bf4803298943be1cb617b8f33ad7`.

The [pinned corpus transcription](../scripts/package/fixtures/classic/zoop.bas)
has an extra quote before the final PRINT on line 100, one space missing
after `WHY?` on line 200, and three question marks on line 290. The scan and
[recovered tape listing](../scripts/package/fixtures/classic/zoop-edu30-tape.bas)
agree on those corrections. The transcript reference records the exact
hashes of the corpus, recovered listing, and portable example. The
[portable listing](../examples/omsi/ZOOP.bas) adjusts whitespace outside
quoted strings to separate compact keywords and numeric tokens.

## Play the command decoder

Choose **ZOOP · EDUSYSTEM-30 MARK adaptation** and select **Run program**.
Submit one character at a time. Enter `C` then `A` for the catalog joke,
or `S` then `C` for the scratch joke. Enter `S` then `A` for the bank
joke. Enter `T` then `X` to reach the original listing's save joke and
reload ZOOP. Submit `}` to return to the OMSI menu, or select **Stop
program** to leave the session.

The source decodes the sum of ten times the first marked character and the
second marked character. The marked value of `}` is 253. For an unrecognized
pair, submit an empty response to represent Return. DEMON's menu takes an
entire line, so select ZOOP there by entering `ZOOP` in one submission.

The host resolves `ZOOP  ` and `DEMON ` from the OMSI library. For the CLI,
export the ZOOP example as a portable document and pass the packaged example
directory with `--chain-dir`.

```sh
bun ./bin/basic --chain-dir examples/omsi /path/to/zoop.basic.json
```

## Archive replay

On the pinned EDU30.SV tape, a two-drive run reaches ZOOP both directly and
through DEMON. The archived sessions cover `CA`, `SC`, `SA`, an
unrecognized pair followed by Return, `TX` self-CHAIN, and the `}` exit
to DEMON. The [capture](zoop-edusystem30-reference.json) preserves complete
program output with operator echo and the OS/8 RUN banner removed. Portable
tests compare that output and account for the echoed Return on the initial
DEMON selection. The browser test checks the typed characters in its
transcript as well.

```sh
python3 scripts/research/capture-edusystem30-zoop.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/zoop-edusystem30-reference.json
```
