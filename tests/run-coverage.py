"""Collect local action-body and build coverage without installing Zotero."""
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def main():
    if not shutil.which('node'):
        raise SystemExit('Node.js 22 or later is required.')
    try:
        import coverage
    except ImportError:
        raise SystemExit('Install coverage.py with: python -m pip install "coverage>=7.10,<8"')
    if tuple(int(part) for part in coverage.__version__.split('.')[:2]) < (7, 10):
        raise SystemExit('coverage.py 7.10 or later is required for subprocess measurement.')
    output = ROOT / 'coverage'
    output.mkdir(exist_ok=True)
    config = str(ROOT / '.coveragerc')

    def run(*args):
        subprocess.run(args, cwd=ROOT, check=True)

    run('node', '--enable-source-maps', '--test', '--experimental-test-coverage',
        '--test-coverage-include=' + (ROOT / 'src/*.js').as_posix(),
        '--test-coverage-include=' + (ROOT / 'coverage/action-sources/src/*.js').as_posix(),
        '--test-reporter=spec', '--test-reporter=lcov',
        '--test-reporter-destination=stdout', '--test-reporter-destination=' + str(output / 'actions.lcov'),
        *(str(file) for file in sorted((ROOT / 'tests').glob('*.test.cjs'))))
    measured = {(ROOT / line[3:]).resolve() for line in (output / 'actions.lcov').read_text().splitlines()
                if line.startswith('SF:')}
    expected = {file.resolve() for file in (ROOT / 'src').glob('*.js')}
    if measured != expected:
        raise SystemExit('Action coverage must include every original src/*.js file, with no generated wrappers.')
    command = (sys.executable, '-m', 'coverage')
    run(*command, 'erase', '--rcfile=' + config)
    run(*command, 'run', '--rcfile=' + config, '-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*.py')
    run(*command, 'combine', '--rcfile=' + config)
    run(*command, 'report', '--rcfile=' + config)
    run(*command, 'html', '--rcfile=' + config)
    run(*command, 'json', '--rcfile=' + config, '-o', str(output / 'build.json'))
    print('Reports: coverage/actions.lcov, coverage/python/index.html, coverage/build.json')


if __name__ == '__main__':
    main()
