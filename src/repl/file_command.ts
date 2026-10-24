export type FileCommand = {kind: 'LOAD'; path: string} | {kind: 'SAVE'; path?: string};

/** Filenames use BASIC string quoting, without interpreting backslashes. */
export function parseFileCommand(source: string): FileCommand | null {
  const command = /^[ \t]*(LOAD|SAVE)\b([\s\S]*)$/i.exec(source);
  if (!command) return null;
  const kind = command[1].toUpperCase() as 'LOAD' | 'SAVE';
  const argument = command[2];
  if (kind === 'SAVE' && /^[ \t]*$/.test(argument)) return {kind};
  const quoted = /^[ \t]+"((?:[^"\r\n\0]|"")*)"[ \t]*$/.exec(argument);
  if (!quoted || quoted[1] === '') {
    throw new Error(`${kind} requires a nonempty quoted filename, with no trailing arguments`);
  }
  return {kind, path: quoted[1].replaceAll('""', '"')};
}
