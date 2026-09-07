export const ALWAYS_IGNORED_DIR_NAMES = ['node_modules', '.git', 'dist', '.next'] as const;
export const TEST_DIR_NAMES = ['tests', 'test', '__tests__'] as const;
export const TEST_FILE_GLOBS = ['*.spec.*', '*.test.*'] as const;

const TEST_FILE_NAME_PATTERN = /\.(spec|test)\.[^./]+$/;

export const isIgnoredDirName = (name: string, includeTests = false): boolean =>
      (ALWAYS_IGNORED_DIR_NAMES as readonly string[]).includes(name) ||
      (!includeTests && (TEST_DIR_NAMES as readonly string[]).includes(name));

export const isTestFileName = (fileName: string): boolean => TEST_FILE_NAME_PATTERN.test(fileName);
