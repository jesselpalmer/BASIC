"""Recover OMSI program sources and verify CHAIN on archived EDU30.SV."""

import argparse
from contextlib import contextmanager
import json
from pathlib import Path
import re
import runpy
import shutil
import tempfile

import pexpect


ARCHIVE_NAMES = ('DEMON', 'BASBAL', 'BASBL1')
MENU = "WHAT DEMONSTRATION WOULD YOU LIKE TO SEE\r\n(OR TYPE 'LIST' FOR A LISTING) ?"
TEAM_PROMPT = '(YOUR NAME PLEASE) THE '
PLAY_PROMPT = 'YOUR PLAY? '
TEAM = 'RSTS/E ROCKETS'


@contextmanager
def console_on_copies(simulator, tape, shared):
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory)
        for name in ('system.tu56', 'library.tu56'):
            shutil.copyfile(tape, path / name)
        (path / 'boot.ini').write_text(
            'set cpu 32k\nset tti 7b\nset tto 7b\n'
            'attach dt1 library.tu56\nattach dt0 system.tu56\nboot dt0\n',
            encoding='ascii',
        )
        with pexpect.spawn(
            str(simulator), ['boot.ini'], cwd=path, encoding='ascii', timeout=15,
        ) as console:
            console.expect_exact('\r\n.')
            assert shared['SIMULATOR'][:8] in console.before
            shared['send_line'](console, 'R EDU30')
            console.expect_exact('READY')
            yield console


def command(console, shared, text, prompt='READY'):
    shared['send_line'](console, text)
    console.expect_exact(prompt)
    return shared['normalize'](console.before)


def read_library(console, shared, fixture_directory):
    catalog = command(console, shared, 'CATALOG')
    names = re.findall(r'^([A-Z0-9]+) +[0-9]{2}$', catalog, flags=re.MULTILINE)
    assert len(names) == 16 and set(ARCHIVE_NAMES) <= set(names), repr(catalog)
    listings = {}
    for name in ARCHIVE_NAMES:
        command(console, shared, 'OLD', 'OLD FILE NAME')
        command(console, shared, name)
        listing = command(console, shared, 'LIST')
        heading, source = listing.split('EDUSYSTEM-30\n\n', 1)
        assert heading.endswith(' ' * (8 - len(name))) and name in heading, repr(heading)
        source = source.rstrip('\n') + '\n'
        assert all(re.match(r'^\d+ ', line) for line in source.splitlines()), repr(source)
        fixture = fixture_directory / f'{name.lower()}-edu30-tape.bas'
        normalized_source = '\n'.join(line.rstrip(' ') for line in source.splitlines()) + '\n'
        assert fixture.read_bytes() == normalized_source.encode('ascii'), fixture
        listings[name] = {
            'lines': len(source.splitlines()),
            'listBodySha256': shared['digest'](source.encode('ascii')),
            'fixtureSha256': shared['digest'](fixture.read_bytes()),
        }
    return names, listings


def play_baseball(console, shared):
    command(console, shared, 'OLD', 'OLD FILE NAME')
    command(console, shared, 'DEMON')
    command(console, shared, 'NOLINE')
    chunks = [command(console, shared, 'RUN', MENU) + shared['normalize'](MENU)]
    chunks.append(command(console, shared, 'BASEBALL', TEAM_PROMPT) + TEAM_PROMPT)
    chunks.append(command(console, shared, TEAM, PLAY_PROMPT) + PLAY_PROMPT)
    assert TEAM + ' ADVANCES TO THE PLATE.' in chunks[-1]
    plays = []
    play = 'BUNT'
    for _ in range(100):
        plays.append(play)
        shared['send_line'](console, play)
        index = console.expect_exact([PLAY_PROMPT, MENU])
        body = shared['normalize'](console.before)
        chunks.append(body + shared['normalize'](console.after))
        if index == 1:
            assert 'AFTER 4 INNINGS' in body and 'FINAL SCORE: ME 3 YOU 0 ' in body
            assert 'I WON!' in body, repr(body)
            break
        if "I'M UP NOW." in body:
            play = 'FASTBALL'
        if "YOU'RE UP NOW." in body:
            play = 'BUNT'
    else:
        raise AssertionError('Baseball did not return to the menu')
    assert len(plays) == 71
    # Confirm the returned menu is active, including its loaded DATA catalog.
    chunks.append(command(console, shared, 'LIST', 'WHAT DEMONSTRATION WOULD YOU LIKE TO SEE? ')
                  + 'WHAT DEMONSTRATION WOULD YOU LIKE TO SEE? ')
    assert 'DEMONSTRATIONS AVAILABLE ARE:' in chunks[-1]
    assert 'BASEBALL           SIMULATED BASEBALL GAME' in chunks[-1]
    return {
        'answers': ['BASEBALL', TEAM, *plays, 'LIST'],
        'output': ''.join(chunks),
    }


def capture_chain_state(console, shared):
    # The archive uses a site password. Enable SAVE on the disposable media by
    # setting its in-memory enable flag, then invoke the normal SAVE command.
    # Gameplay and listing recovery use a separate, unmodified console.
    console.sendcontrol('e')
    console.expect_exact('sim> ')
    console.sendline('deposit 07477 0001')
    console.expect_exact('sim> ')
    console.sendline('continue')
    console.expect_exact('continue\r\n')

    def save(name, source):
        command(console, shared, 'SCRATCH')
        command(console, shared, 'NAME', 'NEW FILE NAME')
        command(console, shared, name)
        for line in source:
            shared['send_line'](console, line)
        command(console, shared, 'SAVE')

    def run(source):
        command(console, shared, 'SCRATCH')
        for line in source:
            shared['send_line'](console, line)
        command(console, shared, 'RUN', 'EDUSYSTEM-30\r\n\r\n')
        console.expect_exact('READY')
        return shared['normalize'](console.before)

    targets = {
        'PROBE1': ['10 DIM A(20)', '20 PRINT "CALLEE";A;A(17);RND(0)', '30 END'],
        'PROBE2': ['10 READ U,V', '20 PRINT "DATA";U;V', '30 END'],
        'PROBE3': ['10 PRINT "IMPLICIT";A(17)', '20 END'],
        'PROBE4': ['10 DATA 81', '20 READ U,V', '30 PRINT U;V', '40 END'],
        'PROBE5': ['10 PRINT TAB(2);"B"', '20 END'],
        'PROBE6': ['10 PRINT "INSIDE"', '20 END'],
        'PROBE7': ['10 READ A', '20 PRINT "FIRST";A', '30 CHAIN "PROBE2"', '40 END'],
        'PROBE8': ['10 DATA 71,72', '20 READ A', '30 PRINT "OWN";A', '40 CHAIN "PROBE2"', '50 END'],
    }
    for name, source in targets.items():
        save(name, source)

    probes = {
        'freshVariablesAndRng': (
            ['10 DIM A(20)', '20 A=42', '30 A(17)=67', '40 PRINT "CALLER";A;A(17);RND(0)',
             '50 CHAIN "PROBE1"', '60 PRINT "UNREACHABLE"', '70 END'],
            'CALLER 42  67  .22299 \nCALLEE 0  0  .22299 \n\n',
        ),
        'dataCursorRestarts': (
            ['10 DATA 41,42', '20 READ A', '30 CHAIN "PROBE2"', '40 END'],
            'DATA 41  42 \n\n',
        ),
        'ownDataReplacesCaller': (
            ['10 DATA 41,42', '20 READ A', '30 CHAIN "PROBE4"', '40 END'],
            '\nERROR DA AT LINE 0020\n\n',
        ),
        'dataPoolSurvivesSuccessiveChains': (
            ['10 DATA 41,42', '20 READ B', '30 CHAIN "PROBE7"', '40 END'],
            'FIRST 41 \nDATA 41  42 \n\n',
        ),
        'targetDataReplacesTheInheritedPool': (
            ['10 DATA 41,42', '20 CHAIN "PROBE8"', '30 END'],
            'OWN 71 \nDATA 71  72 \n\n',
        ),
        'terminalColumnResets': (
            ['10 PRINT "LONG";', '20 CHAIN "PROBE5"', '30 END'],
            'LONG  B\n\n',
        ),
        'subroutineDoesNotResume': (
            ['10 GOSUB 30', '20 PRINT "OUTSIDE"', '25 GOTO 60', '30 CHAIN "PROBE6"',
             '40 RETURN', '60 END'],
            'INSIDE\n\n',
        ),
        'writtenDataPersists': (
            ['10 DATA 41,42', '20 WRITE 75,76', '30 RESTORE', '40 CHAIN "PROBE2"', '50 END'],
            'DATA 75  76 \n\n',
        ),
        'dimensionDoesNotCarry': (
            ['10 DIM A(20)', '20 A(17)=67', '30 CHAIN "PROBE3"', '40 END'],
            'IMPLICIT\nERROR SS AT LINE 0010\n\n',
        ),
        'missingTarget': (
            ['10 CHAIN "NOFILE"', '20 END'],
            '\nERROR CH AT LINE 0010\n\n',
        ),
    }
    evidence = {}
    for key, (source, expected) in probes.items():
        output = run(source)
        assert output == expected, (key, repr(output))
        evidence[key] = {'source': source, 'output': output}
    return {'savedTargets': targets, 'observations': evidence}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--simulator', type=Path, required=True)
    parser.add_argument('--tape', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    directory = Path(__file__).resolve().parent
    shared = runpy.run_path(str(directory / 'capture-edusystem30.py'))
    simulator, tape = args.simulator.resolve(), args.tape.resolve()
    assert shared['digest'](tape.read_bytes()) == shared['TAPE_SHA256']

    with console_on_copies(simulator, tape, shared) as console:
        catalog, listings = read_library(console, shared, directory.parent / 'package/fixtures/classic')
        baseball = play_baseball(console, shared)
    with console_on_copies(simulator, tape, shared) as console:
        probes = capture_chain_state(console, shared)

    args.output.write_text(json.dumps({
        'simulatorCommit': shared['SIMULATOR'],
        'tapeSha256': shared['TAPE_SHA256'],
        'catalog': catalog,
        'listings': listings,
        'baseball': baseball,
        'chainProbes': probes,
    }, indent=2) + '\n', encoding='ascii')


if __name__ == '__main__':
    main()
