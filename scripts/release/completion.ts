/** An abandoned async check must not report a successful release validation. */
export async function completeRelease(check: () => Promise<void>): Promise<void> {
  const previous = process.exitCode ?? 0;
  const fail = () => {
    if (Number(process.exitCode ?? 0) === 0)
      process.exitCode = Number(previous) === 0 ? 1 : previous;
  };
  // An unresolved Promise need not keep a process alive. Do not report success
  // if shutdown occurs before validation and its cleanup have settled.
  process.once('exit', fail);
  try {
    await check();
  } catch (error) {
    fail();
    throw error;
  } finally {
    process.off('exit', fail);
  }
  if (Number(process.exitCode ?? 0) === 0 && Number(previous) !== 0) process.exitCode = previous;
}
