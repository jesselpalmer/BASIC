# CHEMST on EDUSYSTEM-30

The [March 1975 printing, page 76](https://www.bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=76)
credits Wayne Teeter. Its 25-line listing agrees with the pinned
[CHEMST fixture](../scripts/package/fixtures/classic/chemst.bas), including
`ACIE` on line 20. The printed run spells that word `ACID`. The fixture
preserves the listing and its SHA-256 is
`94f3d0dc79464473276d21de6e338488c7e84b6feac17364dd71ce93637634c5`.
The page does not identify the original interpreter.

## Archived execution

Two fresh runs on the archived EDU30.SV produce the same transcript. The
default random stream starts with 11 liters, compared with 19 liters in the
printed run. The [archived transcript digest](chemst-edusystem30-reference.json)
covers invalid-input retry, a successful answer within the five-percent
tolerance, a miss just outside it, an exact answer, and the ninth miss that
ends the game. It preserves prompt and numeric spacing and excludes host
input echo, the OS/8 run banner and the terminal's return to `READY`.

Choose **CHEMST · EDUSYSTEM-30 selected profile** in the
[playground](https://basic-playground-rho.vercel.app/) and enter `26` for the
first dilution. The library, installed CLI/editor and Chromium check the
archived transcript through the ending and a fresh run.

```sh
python3 scripts/research/capture-edusystem30-chemst.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/chemst-edusystem30-reference.json
diff -u <(python3 -m json.tool docs/chemst-edusystem30-reference.json) \
  <(python3 -m json.tool /tmp/chemst-edusystem30-reference.json)
```
