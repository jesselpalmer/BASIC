import os from 'os';
import fs from 'fs';
import path from 'path';

import constants from './shared/constants';
import Repl from './repl/repl';

export default class Basic {
  constructor() {
    this.main();
  }

  run(source) {
    const tokens = source.split(' ');

    tokens.forEach((token) => {
      console.log(token);
    });
  }

  runPrompt() {
    const repl = new Repl();
    repl.start();
  }

  runFile(filePathStr) {
    const filePath = path.basename(filePathStr);

    try {
      const data = fs.readFileSync(filePath, {flag: 'r'});
      this.run(data.toString(constants.DEFAULT_CHAR_SET));
    } catch (err) {
      console.error(err);
      process.exit(os.constants.errno.ENOENT);
    }
  }

  main() {
    const isTooManyArgs = process.argv.length > 3;
    const isFilenameInputted = process.argv.length === 3;
    const filenameIndex = 2;

    if (isTooManyArgs) {
      console.log(constants.ErrorMessages.E2BIG);
      process.exit(os.constants.errno.E2BIG);
    } else if (isFilenameInputted) {
      const filePath = process.argv[filenameIndex];
      this.runFile(filePath);
    } else {
      this.runPrompt();
    }
  }
}
