"""Validate literal instance references against the Renewal instance registry."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOKENS = re.compile(r'//[^\n]*|/\*[\s\S]*?\*/|"(?:\\.|[^"\\])*"')
REFERENCE = re.compile(
    r'instance_(?:create|enter)\s*\(\s*"([^"\n]+)"'
    r'|instance_live_info\(\s*ILI_NAME\s*\)\s*[!=]=\s*"([^"\n]+)"'
    r'|(?:\.?@?md_name(?:_normal|_hard)?|\.?@?instance_name)\$\s*(?:=|,)\s*"([^"\n]+)"'
    r'|setarray\s+\.@instance_name\$\[0\],\s*([^;]+)'
)


def references(source):
    source = TOKENS.sub(lambda m: m[0] if m[0].startswith('"') else ' ' * len(m[0]), source)
    for match in REFERENCE.finditer(source):
        line = source.count('\n', 0, match.start()) + 1
        for value in match.groups()[:3]:
            if value:
                yield line, value
        if match[4]:
            for value in re.findall(r'"([^"]+)"', match[4]):
                yield line, value


class InstanceNameTests(unittest.TestCase):
    def test_registered_names_cover_script_references(self):
        names = set(re.findall(r'^    Name: (.+)$', (ROOT / 'db/re/instance_db.yml').read_text(), re.M))
        checked = 0
        for path in sorted((ROOT / 'npc').rglob('*.txt')):
            for line, name in references(path.read_bytes().decode('utf-8', errors='surrogateescape')):
                with self.subTest(file=str(path.relative_to(ROOT)), line=line):
                    self.assertIn(name, names)
                checked += 1
        self.assertGreater(checked, 100)

    def test_twilight_daily_branch_matches_registered_daily_name(self):
        registry = (ROOT / 'db/re/instance_db.yml').read_text()
        daily = re.search(r'- Id: 54\n    Name: (.+)', registry)[1]
        source = (ROOT / 'npc/re/instances/TwilightGarden.txt').read_text()
        self.assertIn(f'instance_live_info(ILI_NAME) == "{daily}"', source)

    def test_reference_parser_covers_shared_maps_and_array_choices(self):
        source = '''// instance_create("ignored")
        instance_create("one"); instance_enter("two");
        set .@md_name$, "three";
        .@md_name_hard$ = "four";
        if (instance_live_info(ILI_NAME) == "five") end;
        setarray .@instance_name$[0], "six", "seven";'''
        self.assertEqual([name for _, name in references(source)],
                         ['one', 'two', 'three', 'four', 'five', 'six', 'seven'])
