import { expect, it } from 'vitest';
import { parseSourceFile } from '../../src/parser/source-file.js';

it('parses JSX syntax in .tsx files', () => {
  const content =
    'export function App({ bio }: { bio: string }) { return <div dangerouslySetInnerHTML={{ __html: bio }} />; }';

  const sourceFile = parseSourceFile('App.tsx', content);

  expect(sourceFile.errors).toEqual([]);
});

it('parses JSX syntax in .jsx files', () => {
  const content = 'export function App({ bio }) { return <div>{bio}</div>; }';

  const sourceFile = parseSourceFile('App.jsx', content);

  expect(sourceFile.errors).toEqual([]);
});

it('still parses the legacy TypeScript angle-bracket cast syntax in plain .ts files', () => {
  const content = 'const value: unknown = 1;\nconst x = <string>value;';

  const sourceFile = parseSourceFile('file.ts', content);

  expect(sourceFile.errors).toEqual([]);
});
