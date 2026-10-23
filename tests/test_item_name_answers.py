"""Quest item-name answers follow the item DB rather than stale translations."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class ItemNameAnswerTests(unittest.TestCase):
    def test_answer_comparisons_resolve_current_item_names(self):
        cases = {
            'npc/quests/thana_quest.txt': {7421: 1, 7422: 1},
            'npc/quests/quests_lighthalzen.txt': {2657: 1},
            'npc/quests/the_sign_quest.txt': {7178: 2},
            'npc/quests/kiel_hyre_quest.txt': {7487: 1, 7492: 1, 7495: 1, 7496: 1, 7509: 1, 7506: 3},
        }
        for filename, entries in cases.items():
            source = (ROOT / filename).read_text()
            for item_id, count in entries.items():
                with self.subTest(file=filename, item_id=item_id):
                    expressions = re.findall(r'\.@\w+\$\s*(?:==|!=)\s*getitemname\(' + str(item_id) + r'\)', source)
                    self.assertEqual(len(expressions), count)
                    # IDs must refer to defined items, not NPC or quest identifiers.
                    definitions = sum(len(re.findall(r'^  - Id: ' + str(item_id) + r'$', path.read_text(), re.M))
                                      for path in (ROOT / 'db/re').glob('item_db_*.yml'))
                    self.assertEqual(definitions, 1)

    def test_rejects_stale_literal_answers(self):
        stale = ['红钥匙', '黄钥匙', '实验室通行证', '哭泣星光', '料理酒', '黄色钥匙卡', '蓝色钥匙卡', '红色钥匙卡', '华丽钥匙卡', '黑色钥匙卡']
        for filename in ['thana_quest.txt', 'quests_lighthalzen.txt', 'the_sign_quest.txt', 'kiel_hyre_quest.txt']:
            source = (ROOT / 'npc/quests' / filename).read_text()
            for name in stale:
                self.assertNotRegex(source, r'(?:==|!=)\s*"' + name + r'"')
