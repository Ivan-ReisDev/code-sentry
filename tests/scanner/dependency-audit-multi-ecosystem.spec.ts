import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { runDependencyAudit } from '../../src/scanner/dependency-audit.js';

let directory: string;

beforeEach(async () => {
      directory = await mkdtemp(join(tmpdir(), 'codesentry-multi-ecosystem-'));
});

afterEach(async () => {
      await rm(directory, { recursive: true, force: true });
});

const noOsvFindings = async () => ({ ok: true, json: async () => ({ results: [] }) });

it('runs the injected npm audit runner when package-lock.json is present', async () => {
      await writeFile(
            join(directory, 'package-lock.json'),
            JSON.stringify({ lockfileVersion: 3, packages: { 'node_modules/chalk': { version: '5.3.0' } } }),
      );
      const npmAuditRunner = vi.fn(async () => ({ vulnerabilities: {} }));

      await runDependencyAudit(directory, { fetchImpl: noOsvFindings, npmAuditRunner, nvdEnabled: false });

      expect(npmAuditRunner).toHaveBeenCalledWith(directory);
});

it('runs the injected npm audit runner when only npm-shrinkwrap.json is present', async () => {
      await writeFile(join(directory, 'npm-shrinkwrap.json'), JSON.stringify({ lockfileVersion: 3, packages: {} }));
      const npmAuditRunner = vi.fn(async () => ({ vulnerabilities: {} }));

      await runDependencyAudit(directory, { fetchImpl: noOsvFindings, npmAuditRunner, nvdEnabled: false });

      expect(npmAuditRunner).toHaveBeenCalledWith(directory);
});

it('skips npm audit with a friendly warning when only a Python lockfile is present, and still returns OSV findings', async () => {
      await writeFile(
            join(directory, 'poetry.lock'),
            '[[package]]\nname = "requests"\nversion = "2.28.0"\nfiles = []\n',
      );
      const npmAuditRunner = vi.fn(async () => ({ vulnerabilities: {} }));
      const requestsVuln = {
            id: 'GHSA-requests-pypi',
            summary: 'Example PyPI advisory',
            affected: [{ package: { name: 'requests', ecosystem: 'PyPI' }, ranges: [] }],
      };
      const fetchImpl = async (url: string) => {
            if (url.includes('querybatch')) {
                  return { ok: true, json: async () => ({ results: [{ vulns: [{ id: requestsVuln.id }] }] }) };
            }
            return { ok: true, json: async () => requestsVuln };
      };

      const result = await runDependencyAudit(directory, { fetchImpl, npmAuditRunner, nvdEnabled: false });

      expect(npmAuditRunner).not.toHaveBeenCalled();
      expect(result.warnings?.join(' ')).toContain('npm audit');
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].dependency?.package.ecosystem).toBe('PyPI');
});

it('reports dependencyAudit as false with a warning naming the supported lockfiles when none are found', async () => {
      const npmAuditRunner = vi.fn(async () => ({ vulnerabilities: {} }));

      const result = await runDependencyAudit(directory, {
            fetchImpl: noOsvFindings,
            npmAuditRunner,
            nvdEnabled: false,
      });

      expect(npmAuditRunner).not.toHaveBeenCalled();
      expect(result.engines?.dependencyAudit).toBe(false);
      expect(result.warnings?.join(' ')).toContain('package-lock.json');
      expect(result.warnings?.join(' ')).toContain('poetry.lock');
});

it('merges packages from a polyglot project into a single audit', async () => {
      await writeFile(
            join(directory, 'package-lock.json'),
            JSON.stringify({ lockfileVersion: 3, packages: { 'node_modules/chalk': { version: '5.3.0' } } }),
      );
      await writeFile(
            join(directory, 'poetry.lock'),
            '[[package]]\nname = "requests"\nversion = "2.28.0"\nfiles = []\n',
      );
      const npmAuditRunner = vi.fn(async () => ({ vulnerabilities: {} }));

      const result = await runDependencyAudit(directory, {
            fetchImpl: noOsvFindings,
            npmAuditRunner,
            nvdEnabled: false,
      });

      expect(npmAuditRunner).toHaveBeenCalledWith(directory);
      expect(result.engines?.dependencyAudit).toBe(2);
      expect(result.osvCheckedPackages?.sort()).toEqual(['chalk@5.3.0', 'requests@2.28.0 (PyPI)']);
});
