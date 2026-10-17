// Compile with -std=c++17 -I src; run to validate qualification independently of map state.
#include "common/character_appearance.hpp"
#include "common/mmo.hpp"
#include <cassert>
#include <climits>
#include <iostream>

int main() {
 struct Branch { int fourth, second, third, first_option, sex; };
 const Branch branches[] = {
  {JOB_DRAGON_KNIGHT, JOB_KNIGHT, JOB_RUNE_KNIGHT, 1, -1},
  {JOB_IMPERIAL_GUARD, JOB_CRUSADER, JOB_ROYAL_GUARD, 4, -1},
  {JOB_WINDHAWK, JOB_HUNTER, JOB_RANGER, 7, -1},
  {JOB_ARCH_MAGE, JOB_WIZARD, JOB_WARLOCK, 10, -1},
  {JOB_CARDINAL, JOB_PRIEST, JOB_ARCH_BISHOP, 13, -1},
  {JOB_SHADOW_CROSS, JOB_ASSASSIN, JOB_GUILLOTINE_CROSS, 16, -1},
  {JOB_MEISTER, JOB_BLACKSMITH, JOB_MECHANIC, 19, -1},
  {JOB_ELEMENTAL_MASTER, JOB_SAGE, JOB_SORCERER, 22, -1},
  {JOB_BIOLO, JOB_ALCHEMIST, JOB_GENETIC, 25, -1},
  {JOB_INQUISITOR, JOB_MONK, JOB_SURA, 28, -1},
  {JOB_ABYSS_CHASER, JOB_ROGUE, JOB_SHADOW_CHASER, 31, -1},
  {JOB_TROUBADOUR, JOB_BARD, JOB_MINSTREL, 34, 1},
  {JOB_TROUVERE, JOB_DANCER, JOB_WANDERER, 37, 0},
 };
 int checked = 0;
 for (const auto& branch : branches) {
  for (int sex = 0; sex <= 1; ++sex) {
   for (int id = 1; id <= 39; ++id) {
    const bool eligible = (branch.sex == -1 || branch.sex == sex) && id >= branch.first_option && id < branch.first_option + 3;
    assert(character_appearance_allowed(branch.fourth, id, sex) == eligible);
    assert(!character_appearance_allowed(branch.second, id, sex));
    assert(character_appearance_allowed(branch.third, id, sex) == (eligible && id < branch.first_option + 2));
    checked += 3;
   }
   assert(character_appearance_allowed(branch.fourth, 0, sex));
  }
 }
 // Explicit progression and alternate real-job IDs must have the same policy.
 assert(character_appearance_allowed(JOB_LORD_KNIGHT, 1, SEX_MALE));
 assert(!character_appearance_allowed(JOB_LORD_KNIGHT, 2, SEX_MALE));
 assert(character_appearance_allowed(JOB_RANGER_T, 8, SEX_FEMALE));
 assert(character_appearance_allowed(JOB_WINDHAWK2, 7, SEX_FEMALE));
 assert(!character_appearance_allowed(JOB_BABY_RUNE_KNIGHT, 1, SEX_MALE));
 assert(!character_appearance_allowed(JOB_DRAGON_KNIGHT, 1, SEX_SERVER));
 assert(character_appearance_allowed(JOB_NOVICE, 0, SEX_MALE));
 assert(!character_appearance_allowed(JOB_NOVICE, 1, SEX_MALE));
 for (const int64_t value : {-1LL, 40LL, 65535LL, 65536LL, 4294967297LL, LLONG_MAX}) {
  assert(!character_appearance_known(value));
  assert(!character_appearance_allowed(JOB_DRAGON_KNIGHT, value, SEX_MALE));
 }
 assert(character_appearance_known(0));
 for (int id = 1; id <= 39; ++id) assert(character_appearance_known(id));
 assert(character_appearance_mount(JOB_HUNTER) == nullptr);
 assert(character_appearance_mount(JOB_SNIPER) == nullptr);
 assert(character_appearance_mount(JOB_BLACKSMITH) == nullptr);
 assert(character_appearance_mount(JOB_WINDHAWK)->job == JOB_RANGER);
 assert(character_appearance_mount(JOB_MEISTER)->job == JOB_MECHANIC);
 assert(character_appearance_mount(JOB_DRAGON_KNIGHT)->job == JOB_RUNE_KNIGHT);
 assert(character_appearance_mount(JOB_KNIGHT)->job == JOB_KNIGHT);
 assert(character_appearance_mount(JOB_ARCH_MAGE) == nullptr);
 std::cout << "Appearance qualification: " << checked << " branch/job/sex checks plus boundary and mount cases passed\n";
}
