import { Command } from 'commander';
import { afterEach, expect, it, vi } from 'vitest';
import {
      buildVersionReport,
      formatEngineVersions,
      registerVersionCommand,
} from '../../src/commands/version/version.command.js';

const report = buildVersionReport('0.1.12', {
      semgrep: {
            packageName: 'codesentry-semgrep-linux-x64',
            semgrepVersion: '1.145.0',
            pythonVersion: '3.12',
            runtimeSha256: '715a248ce89d6a2ff53cf39c136ed25b01f623b4cf99748a9d9e6fcb7aad8582',
      },
      owaspRuleset: {
            packageVersion: '0.1.12',
            ruleset: 'p/owasp-top-ten',
            source: 'https://semgrep.dev/c/p/owasp-top-ten',
            sha256: '0d7257a1e5af0bfccae7fbbf4d446565126fd226567a0e2c7e00efdf1cae6351',
            capturedAt: '2026-09-13T12:00:00.000Z',
            upstreamRevision: 'registry-revision-42',
      },
});

afterEach(() => {
      vi.restoreAllMocks();
});

it('formats every auditable engine version and provenance field', () => {
      const output = formatEngineVersions(report);

      expect(output).toContain('CodeSentry: 0.1.12');
      expect(output).toContain('Versão: 1.145.0');
      expect(output).toContain('p/owasp-top-ten');
      expect(output).toContain('registry-revision-42');
      expect(output).toContain('0d7257a1e5af0bfccae7fbbf4d446565126fd226567a0e2c7e00efdf1cae6351');
});

it('keeps the structured report serializable for --json', () => {
      expect(JSON.parse(JSON.stringify(report))).toEqual(report);
});

it('registers version --engines --json without reading or executing an installed engine', async () => {
      const program = new Command();
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      registerVersionCommand(
            program,
            () => '0.1.12',
            () => report.engines,
      );

      await program.parseAsync(['node', 'codesentry', 'version', '--engines', '--json']);

      expect(JSON.parse(logSpy.mock.calls[0][0] as string)).toEqual(report);
});
