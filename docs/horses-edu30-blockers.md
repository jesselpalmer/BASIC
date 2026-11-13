# OMSI HORSES compatibility evidence

The OMSI EDUSYSTEM-30 DECtape contains a HORSES listing that accepts separate
horse, position and wager inputs and returns to DEMON. The March 1975
[printed HORSES listing](https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=133)
accepts a four-field bet. The observations below apply to the OMSI tape
edition. Original interpreter attribution for the printed listing remains
open.

A stock tape run with `2`, `WIN`, `5`, and `NO` completed eight race positions,
printed the payout table, reported a $5 loss, and returned to DEMON. The
portable profile currently rejects the tape's numeric array element INPUT at
lines 300 and 430. A local adaptation that stages those inputs through
scalars reaches all eight race positions, then reports `LOOP_ENTRY` at line 1160. Its GOSUB targets line 1880, inside the lexical range of a different
FOR loop. The archive executes the horse-name subroutine and returns
before reaching that loop's NEXT.

The focused probes verify that stock EDU30.SV stores an input into a
calculated array element and permits a GOSUB into a lexical FOR body before,
during, and after the corresponding loop is active. The probes return before
NEXT inside the target region. They leave the behavior of NEXT in that
region open. Native and selected BASIC-PLUS transfer rules have separate
evidence.

```sh
python3 scripts/research/probe-edusystem30-horses.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56
```
