# MUGWUMP on archived EDUSYSTEM-30

The [March 1975 listing on pages 156–157](https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=156)
credits students of Bud Valenti and Bob Albrecht of People's Computer
Company. The printed program is titled MUGWMPFIND, and line 3 credits
David Ahl's RSTS/E conversion. The reviewed source also runs on archived
EDUSYSTEM-30.

The [pinned transcription](../scripts/package/fixtures/classic/mugwump.bas)
has SHA-256 `55d681394e56370b0dc89dd00d806fad3dc6fd22247ac17b71ccdb891aac47d3`.
The [reviewed listing](../scripts/package/fixtures/classic/mugwump-mar75-text.bas)
has SHA-256 `d4eb08bee26393dc1db3988bf71520d6410efaaf3da1ce0a9575f58aeaa75c66`.
It restores the printed `<>` comparisons at 330–340, the distance
formula and PRINT separators at 380–390, and multiplication in
`INT(10*RND(0))` at 1020. It also restores the printed REM and message
spellings, including `MUGMUMPS` at line 610.

## Archived playthroughs

The [reference capture](mugwump-edusystem30-reference.json) uses clock word
0 with the reviewed listing. A miss, a repeated coordinate, and four
finds produce a six-turn win. The replay starts a fresh board within
the same run. One find and nine misses trigger the ten-try message and
disclose the three remaining coordinates. The program then returns to
the first-turn prompt. A separate fresh RUN with the same clock word
reproduces the six-turn win. The digest includes BASIC output and prompts
and excludes input echo, the OS/8 banner, simulator notices, and the
operator's final interrupt.

The reviewed listing uses the `edusystem-30` profile. Choose **MUGWUMP**
in the [playground](https://basic-playground-rho.vercel.app/) and enter
two coordinates separated by a comma, such as `5,5`. Find all four hidden
Mugwumps within ten tries. The program offers another board after each
round. Select **Stop** when finished.

```sh
python3 scripts/research/capture-edusystem30-mugwump.py \
  --simulator /path/to/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/mugwump-edusystem30-reference.json
```
