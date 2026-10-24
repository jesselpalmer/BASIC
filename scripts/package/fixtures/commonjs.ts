// eslint-disable-next-line @typescript-eslint/no-require-imports -- Test actual CommonJS loading.
import api = require('node-basic-lang');
import {runConsumer} from './run-consumer.ts';

runConsumer(api);
