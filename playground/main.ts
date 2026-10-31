import {BrowserSession, type BrowserState} from '../src/browser/session.ts';
import {Transcript} from '../src/browser/transcript.ts';
import {GameKeyboard} from '../src/browser/game_keyboard.ts';
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
const examples: Readonly<Record<string, string>> = {
  greeting,
  'times-table': timesTable,
  guess,
  picture,
  bounce,
  move,
  pong,
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
let runRequest = 0;
let inspectionState: BrowserState | null = null;

function renderDocumentStatus(): void {
  example.value = Object.keys(examples).find((key) => examples[key] === documentModel.source) ?? '';
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
  output.textContent = transcript.text;
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
  diagnostic.textContent = detail
    ? `Source line ${detail.line}, column ${detail.column}${detail.label === null ? '' : ` (BASIC line ${detail.label})`}: ${detail.message}`
    : '';
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
    inputPrompt.textContent = prompt || 'Program input';
    inputValue.value = '';
    inputForm.hidden = false;
    inputValue.focus();
  },
});

function runProgram(paused = false): void {
  const request = ++runRequest;
  const context = documentModel.context;
  void session.run(context.source, {paused, dialect: context.dialect}).catch((error: unknown) => {
    if (request !== runRequest) return;
    keyboard.dispose();
    diagnostic.textContent = `Playground error: ${error instanceof Error ? error.message : String(error)}`;
    diagnostic.hidden = false;
  });
}

async function loadExample(): Promise<void> {
  const candidate = examples[example.value];
  if (candidate === undefined) return;
  finishReplacement(
    await documentModel.replaceWithExample(candidate, confirmReplacement),
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
  if (submit?.(inputValue.value)) {
    write(`${inputValue.value}\n`);
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
