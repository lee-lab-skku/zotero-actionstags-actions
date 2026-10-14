"""Run the Linux Zotero PoC in a fresh profile under Xvfb."""
import argparse
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--zotero', required=True, type=Path)
    parser.add_argument('--actions-tags-xpi', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--expected-zotero', required=True)
    parser.add_argument('--expected-actions-tags', required=True)
    parser.add_argument('--timeout', type=int, default=120)
    args = parser.parse_args()
    if args.timeout <= 0:
        parser.error('Timeout must be positive.')
    if not shutil.which('xvfb-run'):
        parser.error('Install xvfb and xauth before running the Linux PoC.')
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=False)
    expected = {'zotero': args.expected_zotero, 'actionsTags': args.expected_actions_tags}
    (output / 'expected-versions.json').write_text(json.dumps(expected, indent=2) + '\n')
    with tempfile.TemporaryDirectory(prefix='zotero-action-links-') as directory:
        profile = Path(directory) / 'profile'
        subprocess.run([sys.executable, str(Path(__file__).with_name('prepare_profile.py')),
                        '--profile', str(profile), '--actions-tags-xpi', str(args.actions_tags_xpi.resolve())],
                       check=True)
        env = dict(os.environ)
        env.pop('WAYLAND_DISPLAY', None)
        env['GDK_BACKEND'] = 'x11'
        # A separate process group lets timeout cleanup stop Zotero, its children, and Xvfb.
        with (output / 'zotero.log').open('w') as log:
            process = subprocess.Popen(['xvfb-run', '-a', '-e', str(output / 'xvfb.log'), str(args.zotero.resolve()),
                                        '-no-remote', '-profile', str(profile)],
                                       stdout=log, stderr=subprocess.STDOUT, env=env, start_new_session=True)
            try:
                returncode = process.wait(timeout=args.timeout)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
                returncode = None
        report = profile / 'link-bridge-report.json'
        if report.exists():
            shutil.copyfile(report, output / 'report.json')
    # Only logs and the report survive; profile preferences contain the trial token.
    if returncode is None:
        raise SystemExit(f'Zotero timed out after {args.timeout}s; see {output}/zotero.log')
    if not (output / 'report.json').exists():
        raise SystemExit(f'Zotero exited with {returncode} without a fixture report; see {output}/zotero.log')
    result = json.loads((output / 'report.json').read_text())
    print(json.dumps(result, indent=2))
    if returncode != 0 or result.get('ok') is not True or not result.get('checks'):
        raise SystemExit(f'Zotero PoC failed (exit {returncode}); see {output}/report.json and zotero.log')
    if result.get('versions') != expected:
        raise SystemExit(f'Runtime versions differ from the requested pair: {result.get("versions")} != {expected}')
    print(f'Zotero PoC passed: {len(result["checks"])} checks, versions {expected}')


if __name__ == '__main__':
    main()
