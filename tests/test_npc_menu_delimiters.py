"""Regression checks for syntax-significant punctuation in translated NPC menus.

Run from this repository: python3 -m unittest discover -s tests -p 'test_npc_*.py'
"""
import re
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# Reviewed NPC names, quest gates and menu changes from the October 24 audit.
BASE = '12515a7ef709e0487afb5174f4ad63a6d808eec0'
TOKENS = re.compile(r'//[^\n]*|/\*[\s\S]*?\*/|"(?:\\.|[^"\\])*"')
FULLWIDTH = re.compile('[：﹕∶︰]')
# These colons belong to option labels, not option separators. Keep the exact
# strings so an accidental replacement of a real separator still fails.
LABEL_COLONS = {
    'npc/re/quests/garden_of_time.txt': {
        '神兽斗篷：春', '神兽斗篷：夏', '神兽斗篷：秋', '神兽斗篷：冬',
    },
    'npc/re/quests/quests_malaya.txt': {
        '节庆控制：开始与结束:详细设置：调整数值:开始计时器:结束计时器',
    },
}


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

    def test_all_direct_menus_preserve_reviewed_separator_count(self):
        compared = 0
        for path in sorted((ROOT / 'npc').rglob('*.txt')):
            relative = path.relative_to(ROOT).as_posix()
            current = menu_strings(path.read_bytes().decode('utf-8', errors='surrogateescape'))
            for line, text in current:
                with self.subTest(file=relative, line=line):
                    if text not in LABEL_COLONS.get(relative, set()):
                        self.assertIsNone(FULLWIDTH.search(text), 'Review punctuation in menu text')
            upstream = subprocess.run(['git', '-C', str(ROOT), 'show', f'{BASE}:{relative}'],
                                      capture_output=True)
            if upstream.returncode:
                continue  # Scripts added after the reviewed baseline.
            original = menu_strings(upstream.stdout.decode('utf-8', errors='surrogateescape'))
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
