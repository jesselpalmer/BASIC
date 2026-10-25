10 REM Authored INPUT probe; not a whole-game compatibility pass.
20 DIM P(1,2),TEXT$(0):READ D:T=1:GOSUB 290
30 INPUT "Cell";P(1,1),P(1,2),TEXT$(0)
40 PRINT "pair=";M;":";N
50 PRINT "cell=";P(1,1);":";P(1,2);":";TEXT$(0)
60 READ E:PRINT "data=";D;":";E:END
290  PRINT "TURN NO. ";T;" WHAT IS YOUR GUESS";
300  INPUT M,N
310 RETURN
400 DATA 7,8
