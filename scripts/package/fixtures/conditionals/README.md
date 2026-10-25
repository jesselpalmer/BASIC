# Native conditional probe

This authored probe uses two whitespace-normalized excerpts from corpus commit
`45f75052be3f436f2e575f58d4aa611484268227`:

- [AWARI](https://github.com/maurymarkowitz/101-BASIC-Computer-Games/blob/45f75052be3f436f2e575f58d4aa611484268227/awari.bas)
  line 85, blob `8383e000bc6e9d8a18e2b9c4070dac541eb1df30`: insert the space
  between LET and D. The negative result prints and repeats; nonnegative skips
  the rest of the physical line, including GOTO 20.
- [LIFE2](https://github.com/maurymarkowitz/101-BASIC-Computer-Games/blob/45f75052be3f436f2e575f58d4aa611484268227/life2.bas)
  line 101, blob `167aa165fe0e44e46829779d3a79c0a561b66c5c`: insert keyword/name
  spacing around both IF/THEN forms. Both comparisons must pass to enter 105.

Every other line is new scaffolding, including explicit board values, bounded
control flow, the ELSE/call-return trace and output oracles. Expected native
output is I WIN BY4POINTS, after=1, nonnegative, edge, interior, sub, done on
separate lines. No historic numeric spacing is inferred.

This is not an unchanged-source or whole-game compatibility pass. It supplies no
AWARI missing DATA, corrects no game defect and certifies no historical profile.
See `docs/inline-conditionals.md`, #115/#116/#118/#129 and release gate #109.
