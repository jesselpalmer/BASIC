const format =
  /^(?:feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(?:\([a-z0-9][a-z0-9._/-]*\))?!?: \S(?:[^\r\n]*\S)?$/;

/** Repository policy for PR titles and the resulting squash commit subject. */
export function validateCommitTitle(title: string): void {
  if (
    title.length > 100 ||
    title !== title.trim() ||
    Array.from(title).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    }) ||
    !format.test(title)
  ) {
    throw new Error(
      'Use a Conventional Commit title of at most 100 characters, such as ' +
        'feat(repl): add program saving or fix(cli): release input listeners.',
    );
  }
}

if (import.meta.main) {
  const title = process.env.PR_TITLE;
  if (title === undefined) throw new Error('PR_TITLE is required');
  validateCommitTitle(title);
  console.log(`Valid Conventional Commit title: ${title}`);
}
