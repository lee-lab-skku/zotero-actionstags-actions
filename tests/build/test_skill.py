import importlib.util
from pathlib import Path
import shutil
import tempfile
import unittest
import zipfile


ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('build_skill', ROOT / 'build_skill.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class SkillPackageTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory(prefix='skill-package-')
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.skill = self.root / 'zot-jot'
        shutil.copytree(ROOT / 'skills/zot-jot', self.skill)
        self.output = self.root / 'dist/zot-jot.zip'

    def test_archive_extracts_as_a_complete_standalone_skill(self):
        builder.build_skill(self.skill, self.output)
        with zipfile.ZipFile(self.output) as archive:
            archive.extractall(self.root / 'installed')
            expected = {f'zot-jot/{p.relative_to(self.skill).as_posix()}'
                        for p in self.skill.rglob('*') if p.is_file()}
            self.assertEqual(set(archive.namelist()), expected)
        installed = self.root / 'installed/zot-jot'
        builder.validate_skill(installed)
        self.assertEqual((installed / 'references/api.md').read_bytes(),
                         (self.skill / 'references/api.md').read_bytes())
        original = self.output.read_bytes()
        builder.build_skill(self.skill, self.output)
        self.assertEqual(self.output.read_bytes(), original)

    def test_invalid_metadata_cannot_replace_an_existing_archive(self):
        builder.build_skill(self.skill, self.output)
        previous = self.output.read_bytes()
        entry = self.skill / 'SKILL.md'
        original = entry.read_text()
        for text in ['No frontmatter', '---\n[]\n---\n',
                     original.replace('name: zot-jot', 'name: wrong-name'),
                     '---\nname: zot-jot\ndescription: ""\n---\n']:
            with self.subTest(text=text[:50]):
                entry.write_text(text)
                with self.assertRaises(ValueError):
                    builder.build_skill(self.skill, self.output)
                self.assertEqual(self.output.read_bytes(), previous)

    def test_missing_reference_blocks_packaging(self):
        (self.skill / 'references/api.md').unlink()
        with self.assertRaisesRegex(ValueError, 'Missing or external package reference'):
            builder.build_skill(self.skill, self.output)
        self.assertFalse(self.output.exists())

    def test_links_must_resolve_inside_the_package(self):
        outside = self.root / 'private.md'
        outside.write_text('Not a skill resource')
        entry = self.skill / 'SKILL.md'
        original = entry.read_text()
        for target in ['../private.md', outside.as_uri(), '../%70rivate.md']:
            with self.subTest(target=target):
                entry.write_text(original + f'\n[Reference]({target})\n')
                with self.assertRaises(ValueError):
                    builder.build_skill(self.skill, self.output)
                self.assertFalse(self.output.exists())

    def test_symlinks_cannot_add_outside_content(self):
        outside = self.root / 'private.md'
        outside.write_text('Not a skill resource')
        (self.skill / 'references/linked.md').symlink_to(outside)
        with self.assertRaisesRegex(ValueError, 'Symbolic links cannot be packaged'):
            builder.build_skill(self.skill, self.output)
        self.assertFalse(self.output.exists())


if __name__ == '__main__':
    unittest.main()
