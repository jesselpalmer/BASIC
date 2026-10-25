# Statement-position acceptance probe

This is a newly authored test, not an unchanged classic game or a source
correction. The assignment pair at line 600 comes from `awari.bas` line 600 at
pinned corpus commit `45f75052be3f436f2e575f58d4aa611484268227`:
`LETP=B(M):LETB(M)=0`. Spaces after LET are added explicitly for native parsing;
compact historical lexing is still unresolved. Its expected effect is to take
four pieces from B(1), leaving P=4 and B(1)=0.

The remaining setup, loops, jumps and output are independent acceptance scaffolding.
They verify instruction positions, an empty loop's same-line continuation,
false-IF line scope, line-entry jumps, formatting boundaries and END. Expected
nested-loop sum is 9; the countdown ends at 7. AWARI's missing DATA, dialect,
inline conditions and full gameplay requirements remain open in the corpus ledger.
