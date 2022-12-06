import {strictEqual} from 'assert';
import Basic from './basic';

describe(`Basic class test suite`, () => {
  it(`should create an instance`, () => {
    strictEqual(typeof new Basic, 'object');
  });
});
