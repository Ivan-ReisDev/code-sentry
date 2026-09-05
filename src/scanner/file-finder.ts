import { readdir } from 'node:fs/promises';
import { join, sep } from 'node:path';

const SCANNABLE_EXTENSIONS = ['.js', '.ts'];
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist']);

function isInsideIgnoredDir(relativePath: string): boolean {
  return relativePath.split(sep).some((segment) => IGNORED_DIRS.has(segment));
}

export async function findFiles(targetDir: string): Promise<string[]> {
  const entries = await readdir(targetDir, { recursive: true, withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((filePath) => !isInsideIgnoredDir(filePath))
    .filter((filePath) => SCANNABLE_EXTENSIONS.some((ext) => filePath.endsWith(ext)));
}
