import type * as PublicApi from 'node-basic-lang';
import {runLibraryAcceptance} from '../../library-acceptance.ts';

export function runConsumer(api: typeof PublicApi): void {
  if ('compareMa2Relation' in api) throw new Error('MA2 relation conformance must remain private');
  if ('createBasicPlusMa2ArrayStore' in api)
    throw new Error('MA2 array conformance must remain private');
  new api.Basic();
  api.createHost();
  new api.Evaluator();
  if (process.argv[2] === 'quiet') return;

  // An unresolved Promise need not keep Bun alive. Only completed assertions
  // may switch the failing default status to success and print the sentinel.
  process.exitCode = 1;
  void runLibraryAcceptance(api, process.argv[2]).then(
    (completed) => {
      process.stdout.write(`LIBRARY_ACCEPTANCE_COMPLETE ${JSON.stringify(completed)}\n`);
      process.exitCode = 0;
    },
    (error: unknown) => {
      console.error(error);
    },
  );
}
