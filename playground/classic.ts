import {createInternalSelectedBasic} from '../src/core/runtime.ts';
import {Transcript} from '../src/browser/transcript.ts';
import reviewedSource from '../scripts/package/fixtures/classic/1check-mar75-text.bas' with {type: 'text'};

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing classic playtest element: ${id}`);
  return found as T;
}

/** Fixed reviewed-source experiment; no editor source or public dialect enters this path. */
export function attachClassicPlaytest(): void {
  const run = element<HTMLButtonElement>('classic-run');
  const stop = element<HTMLButtonElement>('classic-stop');
  const status = element('classic-status');
  const scroll = element('classic-scroll');
  const output = element('classic-output');
  const truncated = element('classic-truncated');
  const diagnostic = element('classic-diagnostic');
  const form = element<HTMLFormElement>('classic-input-form');
  const prompt = element('classic-input-prompt');
  const input = element<HTMLInputElement>('classic-input');
  element('classic-source').textContent = reviewedSource;
  let generation = 0;
  let active: ReturnType<typeof createInternalSelectedBasic> | null = null;
  let pending: ((answer: string | null) => void) | null = null;
  const transcript = new Transcript();

  function appendOutput(text: string): void {
    const followsOutput = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 40;
    transcript.append(text);
    output.textContent = transcript.text;
    truncated.hidden = !transcript.truncated;
    if (followsOutput) scroll.scrollTop = scroll.scrollHeight;
  }

  function endPending(): void {
    pending?.(null);
    pending = null;
    form.hidden = true;
  }

  function cancel(): void {
    generation++;
    active?.cancel();
    active = null;
    endPending();
    stop.disabled = true;
    status.textContent = 'Stopped';
  }

  run.addEventListener('click', () => {
    if (active) cancel();
    const current = ++generation;
    transcript.clear();
    output.textContent = '';
    scroll.scrollTop = 0;
    truncated.hidden = true;
    diagnostic.textContent = '';
    diagnostic.hidden = true;
    status.textContent = 'Running';
    stop.disabled = false;
    try {
      const basic = createInternalSelectedBasic(reviewedSource, {
        write(text) {
          if (current === generation) appendOutput(text);
        },
        readLine(text = '', {signal} = {}) {
          if (current !== generation || signal?.aborted) return Promise.resolve(null);
          return new Promise<string | null>((resolve) => {
            prompt.textContent = text || 'Game input';
            input.value = '';
            form.hidden = false;
            status.textContent = 'Waiting for input';
            input.focus();
            const finish = (answer: string | null) => {
              signal?.removeEventListener('abort', aborted);
              if (pending === finish) pending = null;
              resolve(answer);
            };
            const aborted = () => finish(null);
            pending = finish;
            signal?.addEventListener('abort', aborted, {once: true});
          });
        },
      });
      active = basic;
      void basic.runAsync(undefined, {yieldEvery: 256}).then(
        (result) => {
          if (current !== generation) return;
          endPending();
          active = null;
          stop.disabled = true;
          status.textContent = result.status === 'halted' ? 'Finished' : 'Error';
        },
        (error: unknown) => {
          if (current !== generation) return;
          endPending();
          active = null;
          stop.disabled = true;
          status.textContent = 'Error';
          diagnostic.textContent = error instanceof Error ? error.message : String(error);
          diagnostic.hidden = false;
        },
      );
    } catch (error) {
      stop.disabled = true;
      status.textContent = 'Error';
      diagnostic.textContent = error instanceof Error ? error.message : String(error);
      diagnostic.hidden = false;
    }
  });
  stop.addEventListener('click', cancel);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const submit = pending;
    if (!submit) return;
    const answer = input.value;
    form.hidden = true;
    status.textContent = 'Running';
    appendOutput(`${answer}\n`);
    submit(answer);
  });
}
