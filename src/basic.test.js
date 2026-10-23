import Basic from './basic';
import ExecProgram from './exec_program/exec_program';
import Repl from './repl/repl';
import constants from './shared/constants';

jest.mock('./exec_program/exec_program', () => jest.fn().mockImplementation(
    () => ({start: jest.fn()}),
));
jest.mock('./repl/repl', () => jest.fn().mockImplementation(
    () => ({start: jest.fn()}),
));

describe('Basic command-line routing', () => {
  const originalArgv = process.argv;

  beforeEach(() => {
    jest.clearAllMocks();
    process.argv = ['node', 'basic'];
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    process.argv = originalArgv;
    jest.restoreAllMocks();
  });

  it('starts a REPL when no file is supplied', () => {
    new Basic();
    expect(Repl).toHaveBeenCalledTimes(1);
    expect(Repl.mock.results[0].value.start).toHaveBeenCalledWith();
    expect(ExecProgram).not.toHaveBeenCalled();
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('runs the supplied filename without starting a prompt', () => {
    process.argv.push('my program.bas');
    new Basic();
    expect(ExecProgram).toHaveBeenCalledTimes(1);
    expect(ExecProgram.mock.results[0].value.start).toHaveBeenCalledWith(
        'my program.bas',
    );
    expect(Repl).not.toHaveBeenCalled();
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('reports extra arguments without launching either mode', () => {
    process.argv.push('first.bas', 'second.bas');
    new Basic();
    expect(console.log).toHaveBeenCalledWith(
        constants.ErrorMessages.TOO_MANY_ARGS,
    );
    expect(process.exit).toHaveBeenCalledWith(
        constants.ExitCodes.INVALID_ARGUMENT,
    );
    expect(ExecProgram).not.toHaveBeenCalled();
    expect(Repl).not.toHaveBeenCalled();
  });
});
