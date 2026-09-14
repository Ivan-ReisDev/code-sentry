import { parse } from 'yaml';
import type { LockedPackage } from './locked-package.js';

const LOCKFILE_NAME = 'yarn.lock';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isBerryLockfile = (raw: string): boolean => {
      if (/^__metadata:/m.test(raw)) return true;
      if (/^# yarn lockfile v1/m.test(raw)) return false;
      return /^\s*resolution:/m.test(raw);
};

// --- Classic (v1): a custom, YAML-inspired format, not valid YAML. ---

interface ClassicBlock {
      name?: string;
      version?: string;
      resolved?: string;
}

const firstSpecName = (headerLine: string): string | undefined => {
      const firstSpec = headerLine.split(',')[0]?.trim().replace(/^"|"$/g, '');
      if (!firstSpec) return undefined;
      const lastAt = firstSpec.lastIndexOf('@');
      return lastAt > 0 ? firstSpec.slice(0, lastAt) : undefined;
};

const isResolvableSource = (resolved: string | undefined): boolean =>
      resolved !== undefined && !resolved.startsWith('file:') && !resolved.startsWith('git');

const classicEntry = (block: ClassicBlock | undefined): LockedPackage | undefined => {
      if (!block?.name || !block.version || !isResolvableSource(block.resolved)) return undefined;
      return { name: block.name, version: block.version, ecosystem: 'npm', lockfile: LOCKFILE_NAME };
};

const isBlankOrComment = (line: string): boolean => !line.trim() || line.startsWith('#');
const isBlockHeader = (line: string): boolean => /^\S/.test(line);

const FIELD_PATTERNS: Array<{ pattern: RegExp; assign: (block: ClassicBlock, value: string) => void }> = [
      {
            pattern: /^\s+version\s+"([^"]+)"/,
            assign: (block, value) => {
                  block.version = value;
            },
      },
      {
            pattern: /^\s+resolved\s+"([^"]+)"/,
            assign: (block, value) => {
                  block.resolved = value;
            },
      },
];

const applyFieldLine = (block: ClassicBlock, line: string): void => {
      for (const { pattern, assign } of FIELD_PATTERNS) {
            const match = pattern.exec(line);
            if (match) assign(block, match[1]);
      }
};

const parseClassic = (raw: string): LockedPackage[] => {
      const deduped = new Map<string, LockedPackage>();
      let current: ClassicBlock | undefined;

      const flush = (): void => {
            const entry = classicEntry(current);
            if (entry) deduped.set(`${entry.name}@${entry.version}`, entry);
            current = undefined;
      };

      for (const line of raw.split('\n')) {
            if (isBlankOrComment(line)) continue;
            if (isBlockHeader(line)) {
                  flush();
                  current = { name: firstSpecName(line.replace(/:$/, '')) };
                  continue;
            }
            current && applyFieldLine(current, line);
      }
      flush();
      return [...deduped.values()];
};

// --- Berry (v2+): valid YAML, resolution string carries the protocol. ---

const isUsableBerryEntry = (value: unknown): value is { resolution: string; version: string } =>
      isRecord(value) &&
      typeof value.resolution === 'string' &&
      typeof value.version === 'string' &&
      value.version !== '0.0.0-use.local';

const berryEntry = (value: unknown): LockedPackage | undefined => {
      if (!isUsableBerryEntry(value)) return undefined;
      const npmIndex = value.resolution.indexOf('@npm:');
      if (npmIndex <= 0) return undefined;
      return {
            name: value.resolution.slice(0, npmIndex),
            version: value.version,
            ecosystem: 'npm',
            lockfile: LOCKFILE_NAME,
      };
};

const parseBerry = (raw: string): LockedPackage[] => {
      const parsed = parse(raw) as Record<string, unknown>;
      const deduped = new Map<string, LockedPackage>();
      for (const [key, value] of Object.entries(parsed ?? {})) {
            if (key === '__metadata') continue;
            const entry = berryEntry(value);
            if (entry) deduped.set(`${entry.name}@${entry.version}`, entry);
      }
      return [...deduped.values()];
};

export const parseYarnLock = (raw: string): LockedPackage[] =>
      isBerryLockfile(raw) ? parseBerry(raw) : parseClassic(raw);
