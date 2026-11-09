"""Shared printed board decoder for the LIFE2 archive probes."""

BORDER = ' 0  1  2  3  4  5  0 '
DRAW_ANSWERS = ['1,1', '3,1', '5,1', '1,5', '3,5', '5,5']


def boards(transcript):
    lines = transcript.split('\n')
    result = []
    for index in range(len(lines) - 6):
        if lines[index] != BORDER or not lines[index + 1].startswith(' 1 '):
            continue
        rows = lines[index + 1:index + 6]
        for row_number, row in enumerate(rows, 1):
            margin = f' {row_number} '
            assert len(row) == 21 and row.startswith(margin) and row.endswith(margin), row
        assert lines[index + 6].startswith(BORDER)
        result.append([''.join(row[4:18:3]).replace(' ', '.') for row in rows])
    return result
