import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const buildRuntimeManifest = (existingManifest, semgrepRelativePath) => ({
      ...existingManifest,
      semgrep: semgrepRelativePath,
});

const isMainModule = () => process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule()) {
      const [packageDirectory, semgrepRelativePath] = process.argv.slice(2);
      if (!packageDirectory || !semgrepRelativePath) {
            throw new Error(
                  'Uso: node scripts/write-runtime-manifest.mjs <diretório-do-pacote> <caminho-relativo-do-semgrep>',
            );
      }

      const manifestPath = resolve(packageDirectory, 'runtime.json');
      const existingManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      const manifest = buildRuntimeManifest(existingManifest, semgrepRelativePath);
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      console.log(`Manifest atualizado: ${manifestPath} -> semgrep: ${semgrepRelativePath}`);
}
