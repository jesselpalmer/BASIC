10 REM New instruction-position test, not a complete classic-game pass.
20 DIM B(1):M=1:B(1)=4
30 REM AWARI 600 assignment pair; explicit LET whitespace for native syntax.
600 LET P=B(M):LET B(M)=0
610 PRINT "take=";P;":";B(M)
620 N=0:FOR I=1 TO 2:FOR J=1 TO 2:N=N+I*J:NEXT J:NEXT I:PRINT "sum=";N
630 FOR K=2 TO 1:PRINT "skipped":NEXT K:PRINT "after empty"
640 N=N-1:IF N>7 THEN 640:PRINT "skipped false"
650 PRINT "counter=";N:GOTO 670:PRINT "unreachable"
660 PRINT "wrong target"
670 PRINT USING "#:#",1,2;:PRINT ":done":END:PRINT "never"
