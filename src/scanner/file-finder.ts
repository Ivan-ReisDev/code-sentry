import { readdir } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { join } from 'node:path';
import { isIgnoredDirName, isTestFileName } from './ignore-patterns.js';

const SCANNABLE_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx'];

const isScannable = (fileName: string): boolean => SCANNABLE_EXTENSIONS.some((ext) => fileName.endsWith(ext));

// Percorre diretório por diretório, em vez de listar tudo de uma vez com
// { recursive: true }, para nunca entrar em pastas ignoradas — um caminho
// muito longo ou um link quebrado dentro de node_modules/.git não deve
// derrubar o scan inteiro só porque essas pastas seriam descartadas de
// qualquer forma.
const filesFromEntry = async (currentDir: string, entry: Dirent<string>, includeTests: boolean): Promise<string[]> => {
      if (entry.isDirectory()) {
            return isIgnoredDirName(entry.name, includeTests) ? [] : walk(join(currentDir, entry.name), includeTests);
      }
      return entry.isFile() && isScannable(entry.name) && (includeTests || !isTestFileName(entry.name))
            ? [join(currentDir, entry.name)]
            : [];
};

const walk = async (currentDir: string, includeTests: boolean): Promise<string[]> => {
      try {
            // codesentry-disable-next-line security/detect-non-literal-fs-filename -- currentDir is the requested directory or a child discovered by readdir.
            const entries = await readdir(currentDir, { withFileTypes: true });
            return (await Promise.all(entries.map((entry) => filesFromEntry(currentDir, entry, includeTests)))).flat();
      } catch (error) {
            throw new Error(`Não foi possível listar os arquivos em "${currentDir}".`, { cause: error });
      }
};

export const findFiles = async (targetDir: string, includeTests = false): Promise<string[]> => {
      try {
            return await walk(targetDir, includeTests);
      } catch (error) {
            throw new Error(`Não foi possível listar os arquivos em "${targetDir}".`, { cause: error });
      }
};
