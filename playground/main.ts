import {isEduSystem30Dialect} from '../src/core/dialect.ts';
import {BrowserSession, type BrowserState} from '../src/browser/session.ts';
import {BasicRuntimeError, BasicSyntaxError} from '../src/core/diagnostic.ts';
import {Transcript} from '../src/browser/transcript.ts';
import {GameKeyboard} from '../src/browser/game_keyboard.ts';
import {attachClassicPlaytest} from './classic.ts';
import {createCanvasRenderer, GRAPHICS_WIDTH, GRAPHICS_HEIGHT} from '../src/browser/graphics.ts';
import {
  BrowserDocument,
  type DocumentReplacement,
  type DocumentReplacementResult,
} from '../src/browser/document.ts';
import greeting from '../examples/greeting.bas' with {type: 'text'};
import timesTable from '../examples/times-table.bas' with {type: 'text'};
import guess from '../examples/guess.bas' with {type: 'text'};
import picture from '../examples/picture.bas' with {type: 'text'};
import bounce from '../examples/bounce.bas' with {type: 'text'};
import move from '../examples/move.bas' with {type: 'text'};
import pong from '../examples/pong.bas' with {type: 'text'};
import life2 from '../scripts/package/fixtures/classic/life2-mar75-reviewed.bas' with {type: 'text'};
import matches from '../scripts/package/fixtures/classic/23mtch-mar75-text.bas' with {type: 'text'};
import letter from '../scripts/package/fixtures/classic/letter-mar75-text.bas' with {type: 'text'};
import trap from '../scripts/package/fixtures/classic/trap-mar75-text.bas' with {type: 'text'};
import litqz from '../scripts/package/fixtures/classic/litqz-mar75-text.bas' with {type: 'text'};
import mathd from '../scripts/package/fixtures/classic/mathd-mar75-text.bas' with {type: 'text'};
import numberGame from '../scripts/package/fixtures/classic/number-mar75-text.bas' with {type: 'text'};
import stars from '../scripts/package/fixtures/classic/stars-mar75-text.bas' with {type: 'text'};
import hurkle from '../scripts/package/fixtures/classic/hurkle-mar75-text.bas' with {type: 'text'};
import changeEdu30 from '../scripts/package/fixtures/classic/change-mar75-text.bas' with {type: 'text'};
import chemst from '../scripts/package/fixtures/classic/chemst.bas' with {type: 'text'};
import diamnd from '../scripts/package/fixtures/classic/diamnd-mar75-text.bas' with {type: 'text'};
import batnum from '../scripts/package/fixtures/classic/batnum-mar75-text.bas' with {type: 'text'};
import even from '../scripts/package/fixtures/classic/even-mar75-text.bas' with {type: 'text'};
import rocket from '../scripts/package/fixtures/classic/rocket-mar75-text.bas' with {type: 'text'};
import kinema from '../scripts/package/fixtures/classic/kinema-edu30-adapted.bas' with {type: 'text'};
import bounceEdu30 from '../scripts/package/fixtures/classic/bounce-mar75-text.bas' with {type: 'text'};
import blkjak from '../scripts/package/fixtures/classic/blkjak-mar75-text.bas' with {type: 'text'};
import golf from '../scripts/package/fixtures/classic/golf-mar75-text.bas' with {type: 'text'};
import chomp from '../scripts/package/fixtures/classic/chomp-mar75-text.bas' with {type: 'text'};
import buzzwd from '../scripts/package/fixtures/classic/buzzwd-edusystem30.bas' with {type: 'text'};
import tower from '../scripts/package/fixtures/classic/tower-mark-adapted.bas' with {type: 'text'};
import slots from '../scripts/package/fixtures/classic/slots-edusystem30.bas' with {type: 'text'};
import reverse from '../scripts/package/fixtures/classic/reverse-mark-adapted.bas' with {type: 'text'};
import even1 from '../scripts/package/fixtures/classic/even1-mark-adapted.bas' with {type: 'text'};
import classicGuess from '../scripts/package/fixtures/classic/guess-edusystem30.bas' with {type: 'text'};
import plot from '../scripts/package/fixtures/classic/3dplot.bas' with {type: 'text'};
import mugwump from '../scripts/package/fixtures/classic/mugwump-mar75-text.bas' with {type: 'text'};
import gomoko from '../scripts/package/fixtures/classic/gomoko-edusystem30-adapted.bas' with {type: 'text'};
import amazin from '../scripts/package/fixtures/classic/amazin-edu30-adapted.bas' with {type: 'text'};
import checker from '../scripts/package/fixtures/classic/1check-mar75-text.bas' with {type: 'text'};
import type {Diagnostic, Dialect} from '../src/core/types.ts';

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing playground element: ${id}`);
  return found as T;
}

const source = element<HTMLTextAreaElement>('source');
const example = element<HTMLSelectElement>('example');
const run = element<HTMLButtonElement>('run');
const stop = element<HTMLButtonElement>('stop');
const pause = element<HTMLButtonElement>('pause');
const resume = element<HTMLButtonElement>('continue');
const step = element<HTMLButtonElement>('step');
const inspection = element<HTMLDetailsElement>('inspection');
const nextLine = element('next-line');
const executionSource = element('execution-source');
const variables = element<HTMLTableElement>('variables');
const variableRows = element('variable-rows');
const variablesEmpty = element('variables-empty');
const variablesLimit = element('variables-limit');
const status = element('status');
const output = element('console-output');
const scroll = element('console-scroll');
const empty = element('console-empty');
const truncated = element('console-truncated');
const diagnostic = element('diagnostic');
const inputForm = element<HTMLFormElement>('input-form');
const inputPrompt = element('input-prompt');
const inputValue = element<HTMLInputElement>('input-value');
const importButton = element<HTMLButtonElement>('import-file');
const fileInput = element<HTMLInputElement>('file-input');
const exportButton = element<HTMLButtonElement>('export-file');
const exportDocumentButton = element<HTMLButtonElement>('export-document');
const documentDialect = element('document-dialect');
const storageStatus = element('storage-status');
const fileStatus = element('file-status');
attachClassicPlaytest();
const examples: Readonly<Record<string, {source: string; dialect: Dialect}>> = {
  greeting: {source: greeting, dialect: 'native'},
  'times-table': {source: timesTable, dialect: 'native'},
  guess: {source: guess, dialect: 'native'},
  picture: {source: picture, dialect: 'native'},
  bounce: {source: bounce, dialect: 'native'},
  move: {source: move, dialect: 'native'},
  pong: {source: pong, dialect: 'native'},
  checker: {source: checker, dialect: 'basic-plus-v4a12-ma2'},
  matches: {source: matches, dialect: 'edusystem-30'},
  letter: {source: letter, dialect: 'edusystem-30'},
  trap: {source: trap, dialect: 'edusystem-30'},
  litqz: {source: litqz, dialect: 'edusystem-30'},
  mathd: {source: mathd, dialect: 'edusystem-30'},
  number: {source: numberGame, dialect: 'edusystem-30'},
  stars: {source: stars, dialect: 'edusystem-30'},
  hurkle: {source: hurkle, dialect: 'edusystem-30'},
  'change-edu30': {source: changeEdu30, dialect: 'edusystem-30'},
  chemst: {source: chemst, dialect: 'edusystem-30'},
  diamnd: {source: diamnd, dialect: 'edusystem-30'},
  batnum: {source: batnum, dialect: 'edusystem-30'},
  even: {source: even, dialect: 'edusystem-30'},
  rocket: {source: rocket, dialect: 'edusystem-30'},
  kinema: {source: kinema, dialect: 'edusystem-30'},
  'bounce-edu30': {source: bounceEdu30, dialect: 'edusystem-30'},
  blkjak: {source: blkjak, dialect: 'edusystem-30-mark'},
  golf: {source: golf, dialect: 'edusystem-30-mark'},
  chomp: {source: chomp, dialect: 'edusystem-30'},
  buzzwd: {source: buzzwd, dialect: 'edusystem-30'},
  tower: {source: tower, dialect: 'edusystem-30-mark'},
  slots: {source: slots, dialect: 'edusystem-30-mark'},
  reverse: {source: reverse, dialect: 'edusystem-30-mark'},
  even1: {source: even1, dialect: 'edusystem-30-mark'},
  'guess-classic': {source: classicGuess, dialect: 'edusystem-30'},
  '3dplot': {source: plot, dialect: 'edusystem-30'},
  mugwump: {source: mugwump, dialect: 'edusystem-30'},
  gomoko: {source: gomoko, dialect: 'edusystem-30'},
  amazin: {source: amazin, dialect: 'edusystem-30'},
  life2: {source: life2, dialect: 'altair-8k-4.0'},
};
const canvas = element<HTMLCanvasElement>('graphics');
canvas.width = GRAPHICS_WIDTH;
canvas.height = GRAPHICS_HEIGHT;
const keyboard = new GameKeyboard({
  surface: canvas,
  window,
  document,
  hasFocus: () => document.hasFocus() && document.activeElement === canvas,
  isHidden: () => document.hidden,
});
const context = canvas.getContext('2d');
const graphics = context ? createCanvasRenderer(context) : null;
element('graphics-unavailable').hidden = graphics !== null;
graphics?.flush();
const storageKey = 'basic.playground.document.v1';
const legacyStorageKey = 'basic.playground.source.v1';
const documentModel = new BrowserDocument(greeting, {
  // Access storage inside the capability: even reading window.localStorage can fail.
  read: () => window.localStorage.getItem(storageKey),
  readLegacy: () => window.localStorage.getItem(legacyStorageKey),
  write: (text) => window.localStorage.setItem(storageKey, text),
});
const transcript = new Transcript();
let pendingFrame: number | null = null;
let submitInput: ((text: string) => boolean) | null = null;
let inputEchoSuffix = '\n';
let runRequest = 0;
let inspectionState: BrowserState | null = null;

function renderDocumentStatus(): void {
  example.value =
    Object.keys(examples).find(
      (key) =>
        examples[key].source === documentModel.source &&
        examples[key].dialect === documentModel.dialect,
    ) ?? '';
  documentDialect.textContent = `Dialect: ${documentModel.dialect}`;
  const state = documentModel.storageStatus;
  storageStatus.dataset.error = String(state.kind === 'error' || state.kind === 'unavailable');
  switch (state.kind) {
    case 'empty':
      storageStatus.textContent = 'Edits autosave in this browser.';
      break;
    case 'restored':
      storageStatus.textContent = 'Draft restored from this browser.';
      break;
    case 'saved':
      storageStatus.textContent = 'Saved in this browser.';
      break;
    case 'unavailable':
      storageStatus.textContent = 'Local autosave unavailable. Export to keep a copy.';
      break;
    case 'error':
      storageStatus.textContent = `Could not ${state.operation === 'restore' ? 'restore' : 'autosave'} the local draft: ${state.message}. Export to keep a copy.`;
      break;
  }
}

function showFileStatus(text: string, failed = false): void {
  fileStatus.textContent = text;
  fileStatus.hidden = text.length === 0;
  fileStatus.dataset.error = String(failed);
}

function confirmReplacement(replacement: DocumentReplacement): boolean {
  return window.confirm(
    `Replace your current program with ${replacement.reason === 'example' ? 'this example' : 'the imported file'}? Export first if you want to keep a copy.`,
  );
}

function finishReplacement(result: DocumentReplacementResult, success: string): void {
  if (result.kind === 'stale') return;
  if (result.kind === 'replaced') {
    source.value = documentModel.source;
    source.focus();
    showFileStatus(success);
  } else if (result.kind === 'cancelled') {
    showFileStatus('Replacement cancelled. Your program is unchanged.');
  } else {
    showFileStatus(
      `${result.kind === 'invalid' ? 'Invalid BASIC program' : result.kind === 'read-failed' ? 'Could not read file' : 'Could not confirm replacement'}: ${result.message}`,
      true,
    );
  }
  renderDocumentStatus();
}

function renderTranscript(): void {
  pendingFrame = null;
  const followsOutput = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 40;
  output.textContent = isEduSystem30Dialect(inspectionState?.dialect)
    ? transcript.paperText
    : transcript.text;
  graphics?.flush();
  truncated.hidden = !transcript.truncated;
  empty.hidden = transcript.text.length > 0 || transcript.truncated;
  if (inspection.open && inspectionState) renderInspection(inspectionState);
  if (followsOutput) scroll.scrollTop = scroll.scrollHeight;
}

function present(): void {
  // Cancel the queued upload: this complete frame must precede the WAIT task,
  // including WAIT 0, rather than race the next frame's CLS and drawing.
  if (pendingFrame !== null) {
    cancelAnimationFrame(pendingFrame);
    renderTranscript();
  }
}

function write(text: string): void {
  transcript.append(text);
  // At most one pending callback and one bounded buffer, even when a program PRINTs rapidly.
  pendingFrame ??= requestAnimationFrame(renderTranscript);
}

function clear(): void {
  if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
  transcript.clear();
  graphics?.clear();
  pendingFrame = requestAnimationFrame(renderTranscript);
}

const statusLabels: Record<BrowserState['status'], string> = {
  idle: 'Ready',
  running: 'Running',
  waiting: 'Waiting for input',
  paused: 'Paused',
  stopped: 'Stopped',
  finished: 'Finished',
  error: 'Error',
};

function renderInspection(state: BrowserState): void {
  const location =
    state.nextLocation ??
    (state.status === 'waiting' || state.status === 'running' || state.status === 'paused'
      ? state.currentLocation
      : null);
  nextLine.textContent = location
    ? `${state.nextLocation ? 'Next:' : 'Waiting at'} BASIC line ${location.label} (source line ${location.start.line}, column ${location.start.column})`
    : state.status === 'idle'
      ? 'Run or Step a program to inspect it.'
      : 'No next statement.';
  executionSource.replaceChildren();
  if (location) {
    const start = state.source.lastIndexOf('\n', location.start.offset - 1) + 1;
    const newline = state.source.indexOf('\n', location.start.offset);
    const end = newline === -1 ? state.source.length : newline;
    const mark = document.createElement('mark');
    mark.textContent = state.source.slice(start, end);
    executionSource.append(state.source.slice(0, start), mark, state.source.slice(end));
  } else executionSource.textContent = state.source;
  variableRows.replaceChildren();
  for (const variable of state.variables.slice(0, 200)) {
    const row = document.createElement('tr');
    const name = document.createElement('td');
    name.textContent = variable.name;
    const value = document.createElement('td');
    value.textContent =
      typeof variable.value === 'string' ? JSON.stringify(variable.value) : String(variable.value);
    row.append(name, value);
    variableRows.append(row);
  }
  variables.hidden = state.variables.length === 0;
  variablesEmpty.hidden = state.variables.length !== 0;
  variablesLimit.hidden = state.variables.length <= 200;
  variablesLimit.textContent = `Showing the first 200 of ${state.variables.length} variables.`;
}

function stateChanged(state: BrowserState): void {
  keyboard.update(state);
  inspectionState = state;
  output.classList.toggle('terminal-columns', isEduSystem30Dialect(state.dialect));
  if (status.textContent !== statusLabels[state.status])
    status.textContent = statusLabels[state.status];
  status.dataset.status = state.status;
  const active =
    state.status === 'running' || state.status === 'waiting' || state.status === 'paused';
  stop.disabled = !active;
  pause.disabled = !active || state.isPaused;
  resume.disabled = !state.isPaused;
  step.disabled = active && state.status !== 'paused';
  if (state.status !== 'waiting') {
    submitInput = null;
    const wasFocused = inputForm.contains(document.activeElement);
    inputForm.hidden = true;
    if (wasFocused) run.focus();
  }
  const detail = state.diagnostic;
  diagnostic.hidden = detail === null;
  diagnostic.textContent = detail ? formatDiagnostic(detail) : '';
  if (state.status !== 'running' && pendingFrame !== null) {
    cancelAnimationFrame(pendingFrame);
    renderTranscript();
  } else if (inspection.open) {
    if (state.status === 'running') pendingFrame ??= requestAnimationFrame(renderTranscript);
    else renderInspection(state);
  }
}

const session = new BrowserSession({
  write,
  clear,
  present,
  readKey: () => keyboard.readKey(),
  keyDown: (key) => keyboard.keyDown(key),
  draw: graphics
    ? (command) => {
        graphics.draw(command);
        pendingFrame ??= requestAnimationFrame(renderTranscript);
      }
    : undefined,
  stateChanged,
  requestInput(prompt, submit) {
    submitInput = submit;
    inputEchoSuffix = '\n';
    if (isEduSystem30Dialect(session.state.dialect)) {
      write(prompt);
      inputPrompt.textContent = prompt
        ? 'Enter a number or comma-separated values'
        : 'Program input';
      if (!prompt) inputEchoSuffix = '';
    } else if (session.state.dialect === 'altair-8k-4.0') {
      write(prompt);
      inputPrompt.textContent =
        prompt === '?? ' ? 'Enter the remaining coordinates' : 'Program input';
    } else inputPrompt.textContent = prompt || 'Program input';
    inputValue.value = '';
    inputForm.hidden = false;
    inputValue.focus();
  },
});

function formatDiagnostic(detail: Readonly<Diagnostic>): string {
  const label = detail.label === null ? '' : ` (BASIC line ${detail.label})`;
  return `Source line ${detail.line}, column ${detail.column}${label}: ${detail.message}`;
}

function runProgram(paused = false): void {
  const request = ++runRequest;
  const context = documentModel.context;
  void session.run(context.source, {paused, dialect: context.dialect}).catch((error: unknown) => {
    if (request !== runRequest) return;
    if (error instanceof BasicSyntaxError || error instanceof BasicRuntimeError) {
      diagnostic.textContent = formatDiagnostic(error.diagnostic);
    } else {
      keyboard.dispose();
      diagnostic.textContent = `Playground error: ${error instanceof Error ? error.message : String(error)}`;
    }
    diagnostic.hidden = false;
  });
}

async function loadExample(): Promise<void> {
  const candidate = examples[example.value];
  if (candidate === undefined) return;
  finishReplacement(
    await documentModel.replaceWithExample(candidate.source, confirmReplacement, {
      dialect: candidate.dialect,
    }),
    'Example loaded.',
  );
}

source.value = documentModel.source;
renderDocumentStatus();
stateChanged(session.state);
source.addEventListener('input', () => {
  documentModel.edit(source.value);
  renderDocumentStatus();
  showFileStatus('');
});
example.addEventListener('change', () => {
  void loadExample();
});
importButton.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  // Clear immediately so picking the same file after a failure triggers another change.
  fileInput.value = '';
  if (!file) return;
  showFileStatus('Reading file…');
  const portable = file.name.toLowerCase().endsWith('.basic.json');
  void documentModel[portable ? 'importDocument' : 'importSource'](
    () => file.text(),
    confirmReplacement,
  ).then((result) => {
    finishReplacement(result, portable ? 'Portable document imported.' : 'File imported.');
  });
});

function download(contents: string, filename: string, type: string): void {
  let url: string | undefined;
  try {
    url = URL.createObjectURL(new Blob([contents], {type}));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    showFileStatus(`Export requested: ${filename}`);
  } catch (error) {
    showFileStatus(
      `Could not export file: ${error instanceof Error ? error.message : String(error)}`,
      true,
    );
  } finally {
    // Let the browser begin the download before releasing its backing Blob URL.
    if (url !== undefined) {
      const downloadUrl = url;
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    }
  }
}

exportButton.addEventListener('click', () => {
  download(documentModel.exportSource(), 'program.bas', 'text/plain');
});
exportDocumentButton.addEventListener('click', () => {
  download(documentModel.exportDocument(), 'program.basic.json', 'application/json');
});
run.addEventListener('click', () => runProgram());
stop.addEventListener('click', () => session.stop());
pause.addEventListener('click', () => {
  inspection.open = true;
  session.pause();
});
resume.addEventListener('click', () => session.resume());
step.addEventListener('click', () => {
  inspection.open = true;
  if (session.state.status !== 'paused') runProgram(true);
  if (session.state.status === 'paused') session.step();
});
inspection.addEventListener('toggle', () => {
  if (inspection.open) renderInspection(session.state);
});
inputForm.addEventListener('submit', (event) => {
  event.preventDefault();
  // Capture this request's closure; a late submission can never answer a replacement run.
  const submit = submitInput;
  const suffix = inputEchoSuffix;
  if (submit?.(inputValue.value)) {
    write(inputValue.value + suffix);
    inputValue.value = '';
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    runProgram();
  } else if (event.key === 'Escape' && !stop.disabled) {
    event.preventDefault();
    session.stop();
  }
});
