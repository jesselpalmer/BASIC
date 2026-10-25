10 REM New call/return probe; not a complete classic-game compatibility pass.
20 DIM B(1):M=1:B(1)=4:TOTAL=0
30 FOR I=1 TO 2:GOSUB 600:TOTAL=TOTAL+P:NEXT I
40 PRINT "take=";TOTAL;":";B(1);":";I
50 N=0:GOSUB 100:PRINT "nested=";N:END
100 N=N+1:GOSUB 200:N=N+1:RETURN
200 N=N+2:RETURN
590 REM AWARI 600 assignment pair; explicit native LET whitespace.
600 LET P=B(M):LET B(M)=0
620 RETURN
