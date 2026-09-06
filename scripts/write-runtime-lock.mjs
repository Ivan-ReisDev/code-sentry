import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const packageDirectory = process.argv[2];
if (!packageDirectory) {
      throw new Error('Uso: node scripts/write-runtime-lock.mjs <diretório-do-pacote>');
}

const runtimeDirectory = resolve(packageDirectory, 'runtime');
const files = [];
const collect = async (directory) => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
            const path = join(directory, entry.name);
            if (entry.isDirectory()) await collect(path);
            else if (entry.isFile()) files.push(path);
      }
};
await collect(runtimeDirectory);
files.sort();
const hash = createHash('sha256');
for (const file of files) {
      hash.update(relative(runtimeDirectory, file));
      hash.update(await readFile(file));
}
const lock = {
      semgrep: process.env.SEMGREP_VERSION,
      python: process.env.PYTHON_VERSION,
      runtimeSha256: hash.digest('hex'),
};
await writeFile(join(packageDirectory, 'runtime.lock.json'), `${JSON.stringify(lock, null, 2)}\n`);
console.log(`Runtime fixado: ${lock.runtimeSha256}`);
