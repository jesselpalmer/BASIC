# Literal subroutine acceptance probe

This newly authored program uses the short AWARI assignment pair from pinned
corpus commit `45f75052be3f436f2e575f58d4aa611484268227`, line 600:
`LETP=B(M):LETB(M)=0`, followed by its bare RETURN from line 620.
Explicit spaces after LET are added for native parsing. Setup, call sites,
loops, the nested subroutines at 100/200, labels and output are new scaffolding.

First call takes four pieces from B(1); the second takes zero. Shared TOTAL is
four, B(1) is zero, and the native caller loop ends with I=3. The nested calls
produce N=4. These are independent expected state/value oracles. The fixture is
not an unchanged-source or whole-game pass, and does not resolve AWARI's missing
DATA, compact lexing, inline conditions or historical loop/profile requirements.
