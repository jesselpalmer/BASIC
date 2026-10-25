# Native INPUT probe

Lines 290 and 300 are unchanged from
[MUGWUMP](https://github.com/maurymarkowitz/101-BASIC-Computer-Games/blob/45f75052be3f436f2e575f58d4aa611484268227/mugwump.bas)
at corpus commit `45f75052be3f436f2e575f58d4aa611484268227`, blob
`86ccd332ff331b6b7f4aeedf61f85fd4e38cb2e2`. All other lines are new scaffolding.
This tests the original coordinate-pair INPUT after a PRINT prompt, same-line
GOSUB return, mixed/indexed target lists, quoted comma/quote data and a shared
DATA cursor across input suspension.

Valid responses are `2,3` and `4,5,"hi, ""Jesse"""`. The library output is the
original `TURN NO. 1 WHAT IS YOUR GUESS` without a newline, followed by
`pair=2:3`, `cell=4:5:hi, "Jesse"` and `data=7:8` on separate lines. Terminal
prompts and browser input echo belong to those hosts, not the interpreter.

This extracted feature probe is not an unchanged whole-game pass or a historical
PETS/E/BASIC-PLUS profile result. MUGWUMP still needs source review and other
features, including RANDOMIZE/SQR and historical RNG semantics. Native short and
surplus responses retry the whole row, unlike BASIC-PLUS continuation/excess
rules. See `docs/input-targets.md` and #115/#116/#121/#129.
