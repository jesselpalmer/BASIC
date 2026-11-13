# CALNDR source review and EDUSYSTEM-30 adaptation

The [March 1975 book, pages 65–66](https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=65)
credits Geoffrey Chase, OSB. The program prints a year when the source
supplies January 1's weekday and the number of days in February. The
sample shows the first part of 1973. The book leaves the interpreter
unspecified.

The [reviewed transcription](../scripts/package/fixtures/classic/calndr-mar75-text.bas)
restores the month loop's `N`, corrects punctuation and preserves the open
quote at line 390. The [pinned copy](../scripts/package/fixtures/classic/calndr.bas)
has `FOR I=1 TO 12` at line 180 but `NEXT N` at 590. On archived EDU30.SV,
the printed listing gives `S1 220` for computed dispatch, `UQ 390` for the
missing quote, and `S1 510` for an inline PRINT.

The [adaptation](../scripts/package/fixtures/classic/calndr-edusystem30.bas)
declares the month array, uses numbered branches for the two unsupported
control forms, closes the printed quote and converts apostrophe comments
to REM. It follows the book's own PRINT substitutions for line feed.
Month names, date arithmetic and weekday columns follow the printed listing.

The [archive capture](calndr-edusystem30-reference.json) verifies all 12
months of 1973 and 1984. It checks each week's day positions against a
Sunday-first calendar and records the complete output digest for each run.
The 1984 run changes the initial offset to Sunday, the year length to 366
and February to 29 days, following the listing's leap-year notes.

Choose **CALNDR · EDUSYSTEM-30 adaptation** in the
[playground](https://basic-playground-rho.vercel.app/) and select **Run program**
to print 1973.

```sh
python3 scripts/research/capture-edusystem30-calndr.py \
  --simulator /path/to/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/calndr-edusystem30-reference.json
```
