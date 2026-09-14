"""Regression checks for syntax-significant punctuation in translated NPC menus.

Run from this repository: python3 -m unittest discover -s tests -p 'test_npc_*.py'
"""
import re
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = '2fe6ab3dc4d830b11d93fb44c3b48436571890bd'
TOKENS = re.compile(r'//[^\n]*|/\*[\s\S]*?\*/|"(?:\\.|[^"\\])*"')
FULLWIDTH = re.compile('[：﹕∶︰]')


def menu_strings(text):
    """Ignore comments; include multiline and conditional menu expressions."""
    tokens = list(TOKENS.finditer(text))
    masked = TOKENS.sub(lambda match: ' ' * len(match.group()), text)
    ranges = []
    for match in re.finditer(r'\b(select|prompt)\s*\(|(?<![.@\w$])menu\b(?!\$)', masked):
        start = match.end()
        if match.group(1):
            depth, end = 1, start
            while end < len(masked) and depth:
                if masked[end] == '(':
                    depth += 1
                elif masked[end] == ')':
                    depth -= 1
                end += 1
        else:
            end = masked.find(';', start)
        ranges.append((start, end))
    return [(text.count('\n', 0, token.start()) + 1, token.group()[1:-1])
            for token in tokens if token.group().startswith('"')
            and any(start <= token.start() < end for start, end in ranges)]


class NpcMenuDelimiterTests(unittest.TestCase):
    def test_parser_separates_menu_syntax_from_dialogue_and_comments(self):
        source = '''mes "费用：500"; // select("备注：不是菜单")
        switch(select(flag ? "甲::" : ":乙:丙", "丁")) {}
        menu "是:否",L_End; prompt("继续:取消");'''
        self.assertEqual([s for _, s in menu_strings(source)],
                         ['甲::', ':乙:丙', '丁', '是:否', '继续:取消'])

    def test_all_direct_menus_preserve_upstream_separator_count(self):
        # These two upstream comparisons have legitimate different string
        # counts. Their translated menus are still checked for fullwidth chars.
        different_counts = {'npc/re/instances/ThorGunsuBase.txt',
                            'npc/re/quests/juno_monster_society.txt'}
        compared = 0
        for path in sorted((ROOT / 'npc').rglob('*.txt')):
            relative = path.relative_to(ROOT).as_posix()
            current = menu_strings(path.read_bytes().decode('utf-8', errors='surrogateescape'))
            for line, text in current:
                with self.subTest(file=relative, line=line):
                    self.assertIsNone(FULLWIDTH.search(text), 'Review punctuation in menu text')
            upstream = subprocess.run(['git', '-C', str(ROOT), 'show', f'{BASE}:{relative}'],
                                      capture_output=True)
            if upstream.returncode:
                continue  # HappyRO-only scripts have no upstream equivalent.
            original = menu_strings(upstream.stdout.decode('utf-8', errors='surrogateescape'))
            if relative in different_counts:
                continue
            self.assertEqual(len(current), len(original), f'Review changed menu structure: {relative}')
            for (line, translated), (_, source) in zip(current, original):
                with self.subTest(file=relative, line=line):
                    self.assertEqual(source.count(':'), translated.count(':'))
                compared += 1
        self.assertGreater(compared, 1000)

    def test_dynamic_menus_keep_separators_and_empty_option_slots(self):
        race = (ROOT / 'npc/other/monster_race.txt').read_text()
        self.assertIn('.@pm[.@i] + " 枚奖牌:"', race)
        stylist = (ROOT / 'npc/custom/stylist.txt').read_text()
        expression = next(line for line in stylist.splitlines() if 'set .@menu$,' in line)
        self.assertIsNone(FULLWIDTH.search(expression))
        hunting = (ROOT / 'npc/custom/quests/hunting_missions.txt').read_text()
        self.assertIn('"～新任务::"', hunting)
        self.assertEqual(('～新任务::' + ':说明:商店:排名:取消').split(':'),
                         ['～新任务', '', '', '说明', '商店', '排名', '取消'])

    def test_eden_registration_has_five_choices(self):
        source = (ROOT / 'npc/re/quests/eden/eden_common.txt').read_text()
        text = next(text for _, text in menu_strings(source) if '伊甸园集团是什么' in text)
        self.assertEqual(text.split(':'), ['伊甸园集团是什么？', '加入伊甸园集团',
                                          '登记新任务', '搜索任务', '取消。'])
