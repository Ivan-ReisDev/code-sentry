import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const SCANNABLE_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx'];
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', '.next']);

const isScannable = (fileName: string): boolean => SCANNABLE_EXTENSIONS.some((ext) => fileName.endsWith(ext));

// Percorre diretório por diretório, em vez de listar tudo de uma vez com
// { recursive: true }, para nunca entrar em pastas ignoradas — um caminho
// muito longo ou um link quebrado dentro de node_modules/.git não deve
// derrubar o scan inteiro só porque essas pastas seriam descartadas de
// qualquer forma.
const walk = async (currentDir: string): Promise<string[]> => {
      const entries = await readdir(currentDir, { withFileTypes: true });
      const files: string[] = [];

      for (const entry of entries) {
            if (entry.isDirectory()) {
                  if (IGNORED_DIRS.has(entry.name)) continue;
                  files.push(...(await walk(join(currentDir, entry.name))));
            } else if (entry.isFile() && isScannable(entry.name)) {
                  files.push(join(currentDir, entry.name));
            }
      }

      return files;
};

export const findFiles = async (targetDir: string): Promise<string[]> => {
      try {
            return await walk(targetDir);
      } catch (error) {
            throw new Error(`Não foi possível listar os arquivos em "${targetDir}".`, { cause: error });
      }
};
