"""Isolated probes for the Altair 8K BASIC rules used by the reviewed LIFE2."""

PROBES = {
    'compactSource': (
        [
            '1 DIMN1(2,2),K1(2)',
            '2 DATA 3,7',
            '3 FORM=1TO2:READK1(M):NEXTM',
            '4 LETK1=9:LETN1(0,2)=K1(2):PRINTK1;N1(0,2)',
            '5 IFK1=9THENIFK1(1)=3THENPRINT"YES";:PRINT"TAIL"',
            '6 IFK1=0THENPRINT"BAD":PRINT"BAD TAIL"',
            '7 PRINT"NEXT":END',
        ],
        {'run': []},
    ),
    'indexedInput': (
        [
            '10 DIMY(2),X(2)',
            '20 B=1:Y(B)=7:X(B)=8',
            '30 INPUTY(B),X(B)',
            '40 PRINTY(B);X(B);Y(0);X(0)',
            '50 END',
        ],
        {
            'fullRow': ['4,5'],
            'partialRow': ['4', '5'],
            'extraField': ['4,5,Z'],
            'emptyRow': [''],
            'emptyAfterPartial': ['4', ''],
            'emptyField': [',5'],
            'trailingComma': ['4,'],
            'spaceOnlyThenEmpty': ['   ', ''],
            'retryAfterPartial': ['4', 'ABC', '6,5'],
            'emptyAfterInvalidField': ['4,ABC', ''],
            'emptyAfterNumericPrefix': ['4,5X', ''],
            'decimalAndExponent': ['.5,2E0'],
        },
    ),
    'inputIndexOrder': (
        ['10 DIMX(2):I=1', '20 INPUTI,X(I)', '30 PRINTI;X(1);X(2)', '40 END'],
        {'run': ['2,7']},
    ),
    'inputPrintColumn': (
        ['10 PRINT"PREFIX";:INPUTT', '20 PRINTTAB(4);"AFTER"', '30 END'],
        {'run': ['2']},
    ),
    'fractionalSubscripts': (
        [
            '10 DIMA(1):A(0)=1:A(1)=2',
            '20 PRINTA(0.9);A(1.9);A(-0.1)',
            '30 END',
        ],
        {'run': []},
    ),
    'outOfBoundsSubscript': (
        ['10 DIMA(1)', '20 PRINTA(2)', '30 END'],
        {'run': []},
    ),
    'lateDimension': (
        ['10 PRINTA(1)', '20 DIMA(2)', '30 END'],
        {'run': []},
    ),
    'printControls': (
        [
            '10 PRINTTAB(4);"A";TAB(2);"B";TAB(8);"C"',
            '20 PRINT"A";TAB(1);"B"',
            '30 PRINT"A";:PRINTTAB(4);"B"',
            '40 PRINT"XX";CHR$(13);"YY";TAB(4);"C"',
            '50 PRINT"XX";CHR$(13);"YY";CHR$(13):PRINT"AFTER"',
            '60 PRINT"XX";CHR$(13);"YY";CHR$(13);:PRINT"AFTER"',
            '70 PRINT0;1;-2;0.5;-0.5;1.25',
            '80 PRINT',
            '90 PRINTTAB(1.9);"A";TAB(5.9);"B"',
            '100 PRINT"X";CHR$(13.9);"Y"',
            '110 END',
        ],
        {'run': []},
    ),
    'restartState': (
        [
            '10 DIMZ(1)',
            '20 READ A',
            '30 DATA17,19',
            '40 Z(1)=Z(1)+1:B=B+1',
            '50 PRINTA;B;Z(1)',
            '60 INPUTT',
            '70 IFT=0THEN90',
            '80 FORI=1TO2:GOSUB100:NEXTI',
            '90 END',
            '100 RUN:PRINT"BAD"',
        ],
        {'run': ['1', '0']},
    ),
    'restartDropsCall': (
        ['10 INPUTT', '20 IFT=0THEN50', '30 GOSUB70', '40 END', '50 RETURN', '70 RUN'],
        {'run': ['1', '0']},
    ),
    'restartDropsLoop': (
        [
            '10 INPUTT',
            '20 IFT=0THEN50',
            '30 FORI=1TO2:GOTO70',
            '40 NEXTI',
            '45 END',
            '50 NEXTI',
            '60 END',
            '70 RUN',
        ],
        {'run': ['1', '0']},
    ),
    'restartPrintColumn': (
        ['10 PRINTTAB(5);"START"', '20 INPUTT', '30 IFT=0THEN50', '40 PRINT"XY";:RUN', '50 END'],
        {'run': ['1', '0']},
    ),
}


def capture_dialogue(console, enter, answers):
    """Collect program output and prompts, excluding the terminal's input echo."""
    chunks = []
    enter(console, 'RUN')
    for response in [*answers, None]:
        event = console.expect_exact(['?? ', '? ', 'OK\r\n'])
        chunks.append((console.before + (console.after if event < 2 else '')).replace('\r\n', '\n'))
        if response is not None:
            assert event != 2, chunks
            enter(console, response)
    return event, chunks


def capture_coordinate_retries(console, enter, mask):
    # The reviewed program is still loaded after the full replay's interrupt.
    answers = ['1', '6', '1,1', '1,1']
    event, chunks = capture_dialogue(console, enter, answers)
    assert event == 1 and chunks[-1].endswith(mask), chunks
    assert sum(chunk.count('ILLEGAL COORDS. RETYPE\n') for chunk in chunks) == 2, chunks
    console.sendcontrol('c')
    console.expect_exact('BREAK IN 700')
    console.expect_exact('OK\r\n')
    return {'answers': answers, 'output': chunks}


def capture_rules(console, enter):
    results = {}
    for name, (lines, cases) in PROBES.items():
        enter(console, 'NEW')
        console.expect_exact('OK\r\n')
        for line in lines:
            enter(console, line)
        results[name] = {'source': lines, 'cases': {}}
        for case, answers in cases.items():
            event, chunks = capture_dialogue(console, enter, answers)
            assert event == 2, (name, case, chunks)
            results[name]['cases'][case] = {'answers': answers, 'output': chunks}
    return results
