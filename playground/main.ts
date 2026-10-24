import {BrowserSession, type BrowserState} from '../src/browser/session.ts';
import {Transcript} from '../src/browser/transcript.ts';
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
const examples: Readonly<Record<string, string>> = {greeting, 'times-table': timesTable, guess};
const transcript = new Transcript();
let pendingFrame: number | null = null;
let submitInput: ((text: string) => boolean) | null = null;
let loadedSource = greeting;
let loadedExample = 'greeting';
let runRequest = 0;

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
  void session.run(source.value).catch((error: unknown) => {
    if (request !== runRequest) return;
    diagnostic.textContent = `Playground error: ${error instanceof Error ? error.message : String(error)}`;
    diagnostic.hidden = false;
  });
}

function loadExample(): void {
  const candidate = examples[example.value];
  if (candidate === undefined) return;
  if (source.value !== loadedSource && !confirm('Replace your edited program with this example?')) {
    example.value = source.value === loadedSource ? loadedExample : '';
    return;
  }
  loadedExample = example.value;
  loadedSource = candidate;
  source.value = candidate;
  source.focus();
}

source.value = greeting;
example.value = 'greeting';
stateChanged(session.state);
source.addEventListener('input', () => {
  example.value = source.value === loadedSource ? loadedExample : '';
});
example.addEventListener('change', loadExample);
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
