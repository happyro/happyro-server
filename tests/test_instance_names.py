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


def call_targets(source):
    """Resolve current scripts' literals, local aliases and selection arrays.

    Unsupported expressions fail explicitly so new dynamic forms need review.
    This collects possible values per file, not execution paths or quest gates.
    """
    source = TOKENS.sub(lambda m: m[0] if m[0].startswith('"') else ' ' * len(m[0]), source)

    def resolve(expression, seen=frozenset()):
        expression = expression.strip()
        if re.fullmatch(r'"[^"\n]+"', expression):
            return {expression[1:-1]}
        variable = re.fullmatch(r'(\.@\w+\$)(?:\[[^]]+\])?', expression)
        if not variable or variable[1] in seen:
            raise ValueError(f'Unresolved instance expression: {expression}')
        name = variable[1]
        assignments = re.findall(re.escape(name) + r'\s*=(?!=)\s*([^;]+);', source)
        assignments += re.findall(r'\bset\s+' + re.escape(name) + r'\s*,\s*([^;]+);', source)
        arrays = re.findall(r'setarray\s+' + re.escape(name) + r'\[0\]\s*,\s*([^;]+);', source)
        values = set()
        for rhs in assignments:
            values.update(resolve(rhs, seen | {name}))
        for rhs in arrays:
            for entry in rhs.split(','):
                values.update(resolve(entry, seen | {name}))
        if not values:
            raise ValueError(f'No definition for instance expression: {expression}')
        return values

    for match in re.finditer(r'\binstance_(?:create|enter)\s*\(\s*([^,)]+)', source):
        yield source.count('\n', 0, match.start()) + 1, resolve(match[1])


class InstanceNameTests(unittest.TestCase):
    def test_every_create_and_enter_call_resolves_to_registered_names(self):
        names = set(re.findall(r'^    Name: (.+)$', (ROOT / 'db/re/instance_db.yml').read_text(), re.M))
        checked = 0
        for path in sorted((ROOT / 'npc').rglob('*.txt')):
            with self.subTest(file=str(path.relative_to(ROOT))):
                for line, targets in call_targets(path.read_bytes().decode('utf-8', errors='surrogateescape')):
                    self.assertFalse(targets - names, f'{path}:{line}: {targets - names}')
                    checked += 1
        self.assertGreater(checked, 100)

    def test_alias_array_and_unsupported_expression_handling(self):
        source = '''.@normal$ = "one"; .@hard$ = "two";
        .@target$ = .@normal$; .@target$ = .@hard$;
        instance_enter(.@target$);
        setarray .@choices$[0], "one", "two";
        instance_create(.@choices$[.@selection]);'''
        self.assertEqual([targets for _, targets in call_targets(source)], [{'one', 'two'}, {'one', 'two'}])
        with self.assertRaisesRegex(ValueError, 'Unresolved'):
            list(call_targets('instance_create(getarg(0));'))

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
