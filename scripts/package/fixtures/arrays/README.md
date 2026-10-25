# Authored array feature fixture

`board.bas` is a native feature test written for this repository. It exercises the
reviewed 1CHECK board geometry and diagonal midpoint operations, using independent
test expectations (48 initial pieces; 1-to-2 rejected; 1-to-19 leaves 47 pieces).
It is not the raw or corrected 1CHECK listing, a certified dialect fixture or a
full historical-game pass. It deliberately uses native PRINT and scalar INPUT;
it does not exercise PRINT USING, historical spacing or replay dialogue. The
test harness supplies only the stated valid square coordinates. `M=0` precedes
the first board observation because native scalars do not initialize implicitly.
