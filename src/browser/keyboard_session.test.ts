import {expect, test} from 'bun:test';
import {BrowserSession, type BrowserView} from './session.ts';

function fixture() {
  const output: string[] = [];
  const view: BrowserView = {
    write: (text) => output.push(text),
    clear: () => {
      output.length = 0;
    },
    requestInput: () => {},
    stateChanged: () => {},
  };
  const session = new BrowserSession(view);
  return {view, output, session};
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected browser run rejection');
}

test('keyboard callbacks retain their receiver and the active run snapshots them', async () => {
  const ui = fixture();
  ui.view.keyDown = function (key) {
    expect(this).toBe(ui.view);
    return key === 'UP';
  };
  ui.view.readKey = function () {
    expect(this).toBe(ui.view);
    ui.view.keyDown = () => {
      throw new Error('Changed callback');
    };
    return 'ENTER';
  };
  expect((await ui.session.run('10 PRINT INKEY$();KEYDOWN("up")')).status).toBe('finished');
  expect(ui.output).toEqual(['ENTER1\n']);
  expect(await rejection(ui.session.run('10 PRINT KEYDOWN("UP")'))).toEqual(
    new Error('Changed callback'),
  );
  expect(ui.session.state.status).toBe('error');
});

test.each(['readKey', 'keyDown'] as const)(
  'a %s callback failure remains an application error and a later run recovers',
  async (name) => {
    const ui = fixture();
    const failure = new Error('Keyboard view failed');
    ui.view.readKey = () => '';
    ui.view.keyDown = () => false;
    ui.view[name] = () => {
      throw failure;
    };
    const source = name === 'readKey' ? '10 PRINT INKEY$()' : '10 PRINT KEYDOWN("A")';
    expect(await rejection(ui.session.run(source))).toBe(failure);
    expect(ui.session.state.status).toBe('error');
    expect((await ui.session.run('10 PRINT "recovered"')).status).toBe('finished');
    expect(ui.output).toEqual(['recovered\n']);
  },
);

test.each(['readKey', 'keyDown'] as const)(
  '%s callbacks cannot reenter lifecycle controls',
  async (name) => {
    const ui = fixture();
    const check = () => {
      for (const command of ['stop', 'pause', 'step', 'resume'] as const)
        expect(() => ui.session[command]()).toThrow('browser view callback');
    };
    ui.view.readKey = () => {
      check();
      return '';
    };
    ui.view.keyDown = () => {
      check();
      return false;
    };
    const source = name === 'readKey' ? '10 PRINT INKEY$()' : '10 PRINT KEYDOWN("A")';
    expect((await ui.session.run(source)).status).toBe('finished');
  },
);

test('views can omit either keyboard capability and retain useful BASIC diagnostics', async () => {
  const ui = fixture();
  expect((await ui.session.run('10 PRINT INKEY$()')).diagnostic?.code).toBe('KEYBOARD_UNAVAILABLE');
  ui.view.readKey = () => '';
  expect((await ui.session.run('10 PRINT INKEY$()')).status).toBe('finished');
  expect((await ui.session.run('10 PRINT KEYDOWN("A")')).diagnostic?.code).toBe(
    'KEYBOARD_UNAVAILABLE',
  );
});
