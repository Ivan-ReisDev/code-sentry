import { expect, it } from 'vitest';
import { parseRequirementsTxt } from '../../../src/scanner/lockfiles/requirements-txt-parser.js';

const pypiEntry = (name: string, version: string) => ({
      name,
      version,
      ecosystem: 'PyPI',
      lockfile: 'requirements.txt',
});

it('parses a plain exact pin', () => {
      expect(parseRequirementsTxt('requests==2.28.0\n')).toEqual([pypiEntry('requests', '2.28.0')]);
});

it('normalizes the package name per PEP 503 (case, dots, underscores)', () => {
      expect(parseRequirementsTxt('Flask==2.3.0\nzope.interface==5.5.2\nzope_component==4.6\n')).toEqual([
            pypiEntry('flask', '2.3.0'),
            pypiEntry('zope-interface', '5.5.2'),
            pypiEntry('zope-component', '4.6'),
      ]);
});

it('strips extras before pinning', () => {
      expect(parseRequirementsTxt('requests[security]==2.28.0\n')).toEqual([pypiEntry('requests', '2.28.0')]);
});

it('strips an environment marker after the pin', () => {
      expect(parseRequirementsTxt('requests==2.28.0; python_version < "3.8"\n')).toEqual([
            pypiEntry('requests', '2.28.0'),
      ]);
});

it('strips inline --hash options after the pin', () => {
      expect(parseRequirementsTxt('requests==2.28.0 --hash=sha256:abc123\n')).toEqual([
            pypiEntry('requests', '2.28.0'),
      ]);
});

it('ignores comments and blank lines', () => {
      expect(parseRequirementsTxt('# a comment\n\nrequests==2.28.0\n   \n# another\n')).toEqual([
            pypiEntry('requests', '2.28.0'),
      ]);
});

it('ignores -r/-e includes, index options and other flag lines', () => {
      const raw = [
            '-r other.txt',
            '-e .',
            '--index-url https://example.com',
            '--no-binary :all:',
            'requests==2.28.0',
      ].join('\n');

      expect(parseRequirementsTxt(raw)).toEqual([pypiEntry('requests', '2.28.0')]);
});

it('ignores VCS/URL requirements', () => {
      const raw = [
            'git+https://github.com/psf/requests.git@main#egg=requests',
            'https://example.com/foo-1.0.0.tar.gz',
            'requests==2.28.0',
      ].join('\n');

      expect(parseRequirementsTxt(raw)).toEqual([pypiEntry('requests', '2.28.0')]);
});

it('ignores unpinned or range-pinned requirements', () => {
      const raw = ['requests', 'requests>=2.0', 'requests~=2.28', 'requests<3', 'requests==2.*', 'flask==2.3.0'].join(
            '\n',
      );

      expect(parseRequirementsTxt(raw)).toEqual([pypiEntry('flask', '2.3.0')]);
});

it('ignores an arbitrary-equality pin (===), since it is not a normal version pin', () => {
      expect(parseRequirementsTxt('requests===2.28.0\n')).toEqual([]);
});

it('returns an empty array for a file with no exact pins', () => {
      expect(parseRequirementsTxt('requests>=2.0\nflask~=2.3\n')).toEqual([]);
});

it('deduplicates identical name+version pins', () => {
      expect(parseRequirementsTxt('requests==2.28.0\nrequests==2.28.0\n')).toEqual([pypiEntry('requests', '2.28.0')]);
});
