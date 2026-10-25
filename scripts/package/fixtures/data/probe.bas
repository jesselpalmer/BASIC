10 REM Authored data probe; not a whole-game compatibility pass.
20 DIM Y(16),A$(3):READ A$(0),A$(1),A$(2),A$(3)
30 FOR I=1 TO 16:READ Y(I):NEXT I
40 PRINT "corners=";Y(1);":";Y(16);":";A$(0);":";A$(2)
50 RESTORE:GOSUB 100:READ N:PRINT "reset=";FIRST;":";N:END
100 READ A$(0),A$(1),A$(2),A$(3),FIRST:RETURN
1100 DATA "4","\QDOES IT SWIM\Y2\N3\","\AFISH","\ABIRD"
1500 DATA 1,49,52,4,13,61,64,16,22,39,23,38,26,42,27,43
