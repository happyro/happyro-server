"""Check Eden's literal and dynamically assembled dialogue for untranslated prose."""
import re
import unittest
from pathlib import Path

EDEN = Path(__file__).resolve().parents[1] / 'npc/re/quests/eden'
TOKENS = re.compile(r'//[^\n]*|/\*[\s\S]*?\*/|"(?:\\.|[^"\\])*"')

# Engine identifiers, portrait assets, map names and internal debug field names.
# These are deliberately not translated, because scripts look them up by name.
CODE_LITERALS = set('''
F_HasEdenGroupMark F_InsertPlural F_IsEquipIDHack F_IsEquipCardHack
F_IsEquipRefineHack F_GM_NPC F_CanOpenStorage VIP_iRO_Acolyte refinemain
gelca01 gelca02 gelca03 gelca04 rote01 rote02 rote03 rote04
min01 min02 min03 igu01 igu02 igu03 igu04 igu05 ragi01 ragi02 ragi03
moc_para01 prontera moc_ruins geffen alberta aldebaran izlude_in prt_church
geffen_in moc_prydb1 alberta_in payon_in02 payon que_ng yuno rachel comodo
hugel veins einbroch lighthalzen amatsu ayothaya louyang gonryun moscovia
brasilis dewata morocc izlude umbala malaya verus04 niflheim thana_step
AL_HEAL ffff00 para_suv0 para_suv01:para_suv02 Prontera Juno
Rohtert#12 Suhnmi#eden
'''.split()) | {'Secretary Lime Evenor', 'Mighty Hammer#ed'}

# Keyboard shortcuts, stat abbreviations, Roman tiers, initials, and iRO brand.
DISPLAY_TERMS = set('''
Alt ALT Ctrl CTRL U F4 M ESC TAB HP SP STR AGI VIT INT DEX LUK
ATK MATK HIT CRI I II III IV BK VIP MVP KVM NPC WarpPortal Party Recruit
MO NE SK SE O X X3 A B C D E K z
'''.split())


class EdenLocalizationTests(unittest.TestCase):
    def test_all_literals_have_no_unreviewed_english(self):
        checked = 0
        for file in sorted(EDEN.glob('*.txt')):
            source = file.read_text()
            for token in TOKENS.finditer(source):
                if not token.group().startswith('"'):
                    continue
                value = token.group()[1:-1]
                if value in CODE_LITERALS:
                    continue
                plain = re.sub(r'\^[0-9a-fA-F]{6}', '', value)
                plain = re.sub(r'%[ds]', '', plain)
                words = set(re.findall(r'[A-Za-z]+[0-9]*', plain))
                line = source.count('\n', 0, token.start()) + 1
                with self.subTest(file=file.name, line=line, text=value):
                    self.assertFalse(words - DISPLAY_TERMS)
                checked += 1
        self.assertGreater(checked, 5000)

    def test_registration_echoes_the_entered_map(self):
        source = (EDEN / 'eden_common.txt').read_text()
        self.assertIn('mes "^3131FF任务地图："+.@input$+"^000000";', source)
        self.assertNotIn('.@inputstr$', source)

    def test_tutorial_accepts_the_localized_material_answer(self):
        source = (EDEN / 'eden_tutorial.txt').read_text()
        self.assertIn('.@inputstr$ == "10 杰勒比结晶"', source)

    def test_vip_destination_display_does_not_change_route_keys(self):
        source = (EDEN / 'eden_iro.txt').read_text()
        self.assertIn('.@destination$ = getarg(1) == "Juno" ? "朱诺" : "普隆德拉";', source)
        self.assertRegex(source, r'if \(getarg\(1\) == "Juno"\)\s+warp "yuno",158,125;')
