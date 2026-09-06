import { readdir } from 'node:fs/promises';
import { join, sep } from 'node:path';

const SCANNABLE_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx'];
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist']);

const isInsideIgnoredDir = (relativePath: string): boolean => {
  return relativePath.split(sep).some((segment) => IGNORED_DIRS.has(segment));
};

export const findFiles = async (targetDir: string): Promise<string[]> => {
  try {
    const entries = await readdir(targetDir, { recursive: true, withFileTypes: true });

    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name))
      .filter((filePath) => !isInsideIgnoredDir(filePath))
      .filter((filePath) => SCANNABLE_EXTENSIONS.some((ext) => filePath.endsWith(ext)));
  } catch (error) {
    throw new Error(`Não foi possível listar os arquivos em "${targetDir}".`, { cause: error });
  }
};
