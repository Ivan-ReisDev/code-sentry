import type { LockedPackage } from './locked-package.js';
import { normalizePyPiName } from './pypi-name.js';

const LOCKFILE_NAME = 'requirements.txt';

/** Matches "name[extras]==version", capturing the raw name and the raw tail after "==". */
// codesentry-disable-next-line security/detect-unsafe-regex -- flat quantifiers only (no nested/overlapping repetition), so it cannot backtrack catastrophically; confirmed against strings up to 100k chars of repeated "a" with no pin.
const PIN_PATTERN = /^([A-Za-z0-9][\w.-]*)(?:\[[^\]]*\])?\s*==\s*(.+)$/;

const stripInlineComment = (line: string): string => {
      const commentIndex = line.search(/\s#/);
      return commentIndex === -1 ? line : line.slice(0, commentIndex);
};

const parsePinnedVersion = (rawTail: string): string | undefined => {
      const withoutHash = rawTail.split(/\s--/)[0] ?? rawTail;
      const version = (withoutHash.split(';')[0] ?? withoutHash).trim();
      if (!version || version.startsWith('=') || version.includes('*')) {
            return undefined;
      }
      return version;
};

const isIgnorableLine = (line: string): boolean =>
      !line || line.startsWith('#') || line.startsWith('-') || line.includes('://');

const parsePin = (line: string): { name: string; version: string } | undefined => {
      const match = PIN_PATTERN.exec(line);
      if (!match) return undefined;
      const version = parsePinnedVersion(match[2]);
      return version ? { name: normalizePyPiName(match[1]), version } : undefined;
};

const parseLine = (rawLine: string): LockedPackage | undefined => {
      const line = stripInlineComment(rawLine).trim();
      if (isIgnorableLine(line)) return undefined;
      const pin = parsePin(line);
      return pin ? { ...pin, ecosystem: 'PyPI', lockfile: LOCKFILE_NAME } : undefined;
};

export const parseRequirementsTxt = (raw: string): LockedPackage[] => {
      const deduped = new Map<string, LockedPackage>();
      for (const rawLine of raw.split('\n')) {
            const locked = parseLine(rawLine);
            if (locked) {
                  deduped.set(`${locked.name}@${locked.version}`, locked);
            }
      }
      return [...deduped.values()];
};
