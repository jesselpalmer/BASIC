import {expect, it} from 'bun:test';
import {validateCommitTitle} from './check-commit-title.ts';

it.each([
  'feat: add program saving',
  'fix(cli): release pending input on close',
  'refactor(core): separate execution ownership',
  'docs(api)!: clarify incompatible host changes',
  'feat!: replace legacy commands',
  'ci: validate pull request titles',
  'revert: undo terminal prompt change',
  'test(parser/ast): check immutable snapshots',
  'chore: ' + 'x'.repeat(93),
])('accepts a valid subject: %s', (title) => {
  expect(() => validateCommitTitle(title)).not.toThrow();
});

it.each([
  '',
  'Merge pull request #93 from branch',
  'update stuff',
  'Feat: add saving',
  'feature: add saving',
  'fix(): close input',
  'fix(cli tools): close input',
  'fix:close input',
  'fix: ',
  ' fix: close input',
  'fix: close input ',
  'fix: close input\n',
  'fix: close\ninput',
  'fix: close\tinput',
  'fix: close\0input',
  'chore: ' + 'x'.repeat(94),
])('rejects an invalid subject: %j', (title) => {
  expect(() => validateCommitTitle(title)).toThrow('Use a Conventional Commit title');
});
