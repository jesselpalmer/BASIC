# Native computed-dispatch probe

This authored probe retains the ON selector and target order from the second
statement of BANNER line 305, at corpus commit
`45f75052be3f436f2e575f58d4aa611484268227`, blob
`0497d5eec6ddb942415ad9439010ee47c66d4be8`:

`ONA(F)-47GOTO500,440,620,625,635,550,615,605,595,585`

The source is [banner.bas](https://github.com/maurymarkowitz/101-BASIC-Computer-Games/blob/45f75052be3f436f2e575f58d4aa611484268227/banner.bas),
whose header credits Daniel R. Vernon, February 1, 1973. Only spaces after ON and
GOTO are added to the retained statement. The preceding IF, backslash separator
and every other original statement are omitted. Every other line in this fixture
is new scaffolding: explicit array initialization, a ten-value loop, destination
stubs, fractional selection and inline conditional call-return checks.

Expected native output is the ten selected labels in original target order,
then one, after, two, one, tail on separate lines. The selector values 48 through
57 map independently to indices 1 through 10. The 1.9 call selects item 1 by
truncation; the nonlast THEN call returns to the next numbered line; the last
ELSE call returns to its same-line tail.

The source review's attribution/fixture policy applies. Upstream's EduSystem 50
hint is unverified; this probe does not certify that dialect, native output
spacing as historical output, the original BANNER rendering, unchanged source
or any complete game. See docs/computed-dispatch.md and #57/#115/#116/#129.
Release gate #109 remains NOT READY.
