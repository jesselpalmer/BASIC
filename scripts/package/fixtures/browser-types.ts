import {
  BrowserSession,
  KeyboardInput,
  logicalKey,
  createSourceDocument,
  decodeSourceDocument,
  encodeSourceDocument,
  SOURCE_DOCUMENT_FORMAT,
  SOURCE_DOCUMENT_VERSION,
  type SourceDocument,
  type BrowserView,
  type BrowserState,
  type BrowserStatus,
  type BrowserSessionOptions,
  type BrowserRunOptions,
  type GraphicsCommand,
  type LogicalKey,
  type Dialect,
  type Diagnostic,
  type Location,
  type VariableSnapshot,
} from 'node-basic-lang/browser';

const keyboard = new KeyboardInput();
const view: BrowserView = {
  write(text) {
    const value: string = text;
    void value;
  },
  clear() {},
  draw(command) {
    const value: GraphicsCommand = command;
    void value;
  },
  present() {},
  readKey: () => keyboard.readKey(),
  keyDown: (key) => keyboard.keyDown(key),
  requestInput(prompt, submit) {
    const value: string = prompt;
    const accepted: boolean = submit('Ada');
    void value;
    void accepted;
  },
  stateChanged(state) {
    const value: BrowserState = state;
    const status: BrowserStatus = value.status;
    const context: Dialect = state.dialect;
    const diagnostic: Readonly<Diagnostic> | null = state.diagnostic;
    const location: Location | null = state.currentLocation;
    const variables: readonly VariableSnapshot[] = state.variables;
    void status;
    void context;
    void diagnostic;
    void location;
    void variables;
    // @ts-expect-error Run observations cannot be mutated.
    state.status = 'running';
  },
};
const options: BrowserSessionOptions = {
  random: () => 0.5,
  yieldEvery: 2,
  wait: (_milliseconds, timing) => {
    void timing?.signal;
    return Promise.resolve();
  },
};
const session = new BrowserSession(view, options);
const runOptions: BrowserRunOptions = {paused: true, dialect: 'native'};
const running: Promise<BrowserState> = session.run('10 END', runOptions);
void running;
session.pause();
session.resume();
session.step();
session.stop();
session.submitInput('x');
const key: LogicalKey | null = logicalKey('ArrowUp');
void key;
const document: SourceDocument = createSourceDocument('10 PRINT');
const restored: SourceDocument = decodeSourceDocument(
  encodeSourceDocument(document.source, {dialect: document.dialect}),
);
const format: 'basic-program' = SOURCE_DOCUMENT_FORMAT;
const version: 1 = SOURCE_DOCUMENT_VERSION;
void restored;
void format;
void version;
// @ts-expect-error Source envelopes are immutable.
document.source = '10 END';
// @ts-expect-error A portable envelope does not enable a historical profile.
createSourceDocument('10 END', {dialect: 'basic-plus-v4a12-ma2'});
// @ts-expect-error Session context accepts only supported dialects.
void session.run('10 END', {dialect: 'other'});
// @ts-expect-error Input submissions require text.
session.submitInput(1);
const badView: BrowserView = {
  ...view,
  // @ts-expect-error Browser callbacks receive drawing commands, not arbitrary objects.
  draw: (value: string) => {
    void value;
  },
};
void badView;
// @ts-expect-error Private document controllers are not part of the embedding API.
import {BrowserDocument} from 'node-basic-lang/browser';
void BrowserDocument;
// @ts-expect-error Package exports deny private deep imports.
import {BrowserSession as InternalSession} from 'node-basic-lang/src/browser/session.ts';
void InternalSession;
