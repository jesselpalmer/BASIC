import metadata from '../../package.json' with {type: 'json'};

const constants = {
  ExitCodes: {
    NORMAL: 0,
    INVALID_ARGUMENT: 9,
  },
  Strings: {
    Repl: {
      WELCOME_MESSAGE: `BASIC ${metadata.version}`,
      PROMPT: '>>> ',
      EXIT_MESSAGE: 'Have a great day :)',
    },
  },
  ErrorMessages: {
    TOO_MANY_ARGS: 'Usage: basic [script]',
  },
};

export default constants;
