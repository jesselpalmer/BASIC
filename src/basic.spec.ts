import { strictEqual } from 'assert'
import Basic from './basics'

describe(`Basic class test suite`, () => {
  it(`should create an instance`, () => {
    strictEqual(typeof new Basic(), 'object')
  })
})
