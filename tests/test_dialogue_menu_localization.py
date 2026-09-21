"""Sample localized menu forms without replaying every NPC quest branch."""
import re
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = 'e950e202c41ef9acf5f0439023301e089c1fc996'
LITERAL = re.compile(rb'"(?:\\.|[^"\\])*"')
SAMPLES = (
    'npc/re/quests/HelpMeShorty.txt',
    'npc/re/jobs/novice/academy.txt',
    'npc/re/instances/SkyFortress.txt',
    'npc/re/quests/quests_17_2.txt',
    'npc/re/merchants/coin_exchange.txt',
)


class DialogueMenuLocalizationTests(unittest.TestCase):
    def test_sampled_scripts_preserve_logic_and_menu_slots(self):
        for name in SAMPLES:
            before = subprocess.check_output(['git', 'show', f'{BASE}:{name}'], cwd=ROOT)
            after = (ROOT / name).read_bytes()
            with self.subTest(script=name):
                self.assertEqual(LITERAL.sub(b'""', before), LITERAL.sub(b'""', after))
                old_strings, new_strings = LITERAL.findall(before), LITERAL.findall(after)
                self.assertEqual(len(old_strings), len(new_strings))
                for old, new in zip(old_strings, new_strings):
                    if old == new:
                        continue
                    # A colon or an empty slot changes select() branch numbering.
                    self.assertEqual(old.count(b':'), new.count(b':'))
                    self.assertEqual(old == b'""', new == b'""')
                    self.assertEqual([not s for s in old[1:-1].split(b':')],
                                     [not s for s in new[1:-1].split(b':')])
                    for pattern in (rb'<INFO>.*?</INFO>', rb'\^[0-9a-fA-F]{6}', rb'%[ds]'):
                        self.assertEqual(re.findall(pattern, old), re.findall(pattern, new))

    def test_shorty_has_no_unreviewed_english_dialogue(self):
        source = (ROOT / SAMPLES[0]).read_text()
        allowed = {'ALT', 'Alt', 'Ctrl', 'Tab', 'F12', 'NPC', 'Str', 'Agi', 'Dex', 'place', 'tip',
                   'A', 'C', 'E', 'L', 'M', 'Q', 'S', 'U', 'Y', 'Z', 'h'}
        for number, line in enumerate(source.splitlines(), 1):
            if not re.search(r'\b(?:mes|select)\b|menu\$', line):
                continue
            for literal in LITERAL.findall(line.encode()):
                plain = re.sub(r'<INFO>.*?</INFO>|</?(?:NAVI|URL)>|\^[0-9a-fA-F]{6}', '', literal.decode())
                with self.subTest(line=number):
                    self.assertFalse(set(re.findall(r'[A-Za-z]+[0-9]*', plain)) - allowed)


if __name__ == '__main__':
    unittest.main()
