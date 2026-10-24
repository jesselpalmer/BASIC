import {BrowserSession, type BrowserState} from '../src/browser/session.ts';
import {Transcript} from '../src/browser/transcript.ts';
import {
  BrowserDocument,
  type DocumentReplacement,
  type DocumentReplacementResult,
} from '../src/browser/document.ts';
import greeting from '../examples/greeting.bas' with {type: 'text'};
import timesTable from '../examples/times-table.bas' with {type: 'text'};
import guess from '../examples/guess.bas' with {type: 'text'};

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing playground element: ${id}`);
  return found as T;
}

const source = element<HTMLTextAreaElement>('source');
const example = element<HTMLSelectElement>('example');
const run = element<HTMLButtonElement>('run');
const stop = element<HTMLButtonElement>('stop');
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
const storageStatus = element('storage-status');
const fileStatus = element('file-status');
const examples: Readonly<Record<string, string>> = {greeting, 'times-table': timesTable, guess};
const storageKey = 'basic.playground.source.v1';
const documentModel = new BrowserDocument(greeting, {
  // Access storage inside the capability: even reading window.localStorage can fail.
  read: () => window.localStorage.getItem(storageKey),
  write: (text) => window.localStorage.setItem(storageKey, text),
});
const transcript = new Transcript();
let pendingFrame: number | null = null;
let submitInput: ((text: string) => boolean) | null = null;
let runRequest = 0;

function renderDocumentStatus(): void {
  example.value = Object.keys(examples).find((key) => examples[key] === documentModel.source) ?? '';
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
  truncated.hidden = !transcript.truncated;
  empty.hidden = transcript.text.length > 0 || transcript.truncated;
  if (followsOutput) scroll.scrollTop = scroll.scrollHeight;
}

function write(text: string): void {
  transcript.append(text);
  // At most one pending callback and one bounded buffer, even when a program PRINTs rapidly.
  pendingFrame ??= requestAnimationFrame(renderTranscript);
}

function clear(): void {
  if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
  transcript.clear();
  renderTranscript();
}

const statusLabels: Record<BrowserState['status'], string> = {
  idle: 'Ready',
  running: 'Running',
  waiting: 'Waiting for input',
  stopped: 'Stopped',
  finished: 'Finished',
  error: 'Error',
};

function stateChanged(state: BrowserState): void {
  status.textContent = statusLabels[state.status];
  status.dataset.status = state.status;
  stop.disabled = state.status !== 'running' && state.status !== 'waiting';
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
  }
}

const session = new BrowserSession({
  write,
  clear,
  stateChanged,
  requestInput(prompt, submit) {
    submitInput = submit;
    inputPrompt.textContent = prompt || 'Program input';
    inputValue.value = '';
    inputForm.hidden = false;
    inputValue.focus();
  },
});

function runProgram(): void {
  const request = ++runRequest;
  void session.run(documentModel.source).catch((error: unknown) => {
    if (request !== runRequest) return;
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
  void documentModel
    .importSource(() => file.text(), confirmReplacement)
    .then((result) => {
      finishReplacement(result, 'File imported.');
    });
});
exportButton.addEventListener('click', () => {
  let url: string | undefined;
  try {
    url = URL.createObjectURL(new Blob([documentModel.exportSource()], {type: 'text/plain'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'program.bas';
    document.body.append(link);
    link.click();
    link.remove();
    showFileStatus('Export requested: program.bas');
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
});
run.addEventListener('click', runProgram);
stop.addEventListener('click', () => session.stop());
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
