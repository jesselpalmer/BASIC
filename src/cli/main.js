import {runCli} from './run_cli.js';

runCli(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
}, (error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
