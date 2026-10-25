10 REM Formula excerpts, not complete classic-game compatibility tests.
20 REM rocket.bas 15 and rockt2.bas 70: scientific constants.
30 G=1E-3
70 LET A1=8.84361E-04
80 PRINT "constants=";G;":";A1
90 REM bounce.bas 220: original height expression, with a new assignment wrapper.
100 V=32
220 H=INT(-16*(V/32)^2+V^2/32+.5)
230 PRINT "height=";H
240 X=0
250 Y=0
260 Z=0
270 X1=3
280 Y1=4
290 Z1=12
300 REM target.bas 510: original distance statement.
510 D=((X1-X)^2+(Y1-Y)^2+(Z1-Z)^2)^(1/2)
520 PRINT "distance=";D
530 PRINT "powers=";-2^2;":";2^3^2;":";2^-2^2
540 END
