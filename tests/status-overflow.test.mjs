import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const plain = args.includes('--no-color');
const options = args.filter(arg => arg !== '--no-color');
const output = options[0];
if (!output || output === '--help') {
  const color = (code, text) => plain ? text : `\x1b[${code}m${text}\x1b[0m`;
  console.log(`\n${color('1;36', 'HappyRO high status regression test')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/status-overflow.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/status-overflow.test.mjs /tmp/happyro-status-test')}\n`);
} else {
  if (options.length !== 1 || output.startsWith('-')) throw new Error('Expected one artifact path');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const status = readFileSync(resolve(root, 'src/map/status.cpp'), 'utf8');
  const battle = readFileSync(resolve(root, 'src/map/battle.cpp'), 'utf8');
  const pc = readFileSync(resolve(root, 'src/map/pc.cpp'), 'utf8');
  const skillSource = readFileSync(resolve(root, 'src/map/skill.cpp'), 'utf8');
  const match = (source, pattern) => {
    const result = source.match(pattern);
    if (!result) throw new Error(`Cannot locate production code: ${pattern}`);
    return result[0];
  };
  const between = (source, first, last) => {
    const start = source.indexOf(first);
    const end = source.indexOf(last, start);
    if (start < 0 || end < 0) throw new Error(`Cannot locate ${first}`);
    return source.slice(start, end);
  };
  const matk = between(status, 'uint16 status_base_matk_min( const block_list*', '\n#endif');
  const modifiers = between(status, '// Equipment modifiers for misc settings', '// ----- HIT CALCULATION -----');
  const fields = ['hit', 'flee', 'def2', 'mdef2', 'cri', 'flee2', 'patk', 'smatk', 'res', 'mres', 'hplus', 'crate'];
  const rateFields = ['matk', 'hit', 'flee', 'def2', 'mdef2', 'critical', 'flee2', 'patk', 'smatk', 'res', 'mres', 'hplus', 'crate'];
  const passes = fields.map(field => `assert(base_status->${field} == SHRT_MAX);`).join('\n');
  const passive = between(status, '// ----- HIT CALCULATION -----', '// ----- EQUIPMENT-DEF CALCULATION -----');
  const additions = [...passive.matchAll(/base_status->(hit|flee|cri|patk|smatk|res) (?:\+=|=)[^;]+;/g)];
  if (additions.length < 20) throw new Error('Missing passive skill modifiers');
  const passiveCases = additions.map(([line, field]) => `base_status->${field} = SHRT_MAX; ${line} assert(base_status->${field} == SHRT_MAX);`).join('\n');
  const hpReturn = match(status, /return [^\n]*dmax[^\n]*;/);
  const weapon = between(battle, '\t\tfloat variance = 5.0f', '\n\t\tif ((sc && sc->getSCE(SC_MAXIMIZEPOWER))');
  const baseStat = match(battle, /int(?:16|32) base_stat;/);
  const aspd = match(status, /temp_aspd = [^;]+\/ 5.0f[^;]+;/);
  const defense = match(battle, /int(?:16|32) tmdef = tstatus->mdef \+ tstatus->mdef2;/);
  const totaldef = match(battle, /int(?:16|32) totaldef;/) + match(battle, /totaldef = tstatus->def2[^;]+;/);
  const regen = match(status, /val \+= skill\*5[^;]+;/);
  const smatk = match(status, /status->smatk = [^\n]*status->spl - b_status->spl[^\n]*;/);
  const constants = readFileSync(resolve(root, 'src/config/const.hpp'), 'utf8');
  const levelModifier = between(constants, '#define RE_LVL_DMOD(val)', '\n\t#define RE_LVL_MDMOD');
  const skillFunctions = ['acolyte/asurastrike', 'acolyte/tigercannon', 'acolyte/thirdflamebomb', 'swordman/dragonicbreath'].map(path => {
    const source = readFileSync(resolve(root, `src/map/skills/${path}.cpp`), 'utf8');
    const signature = match(source, /void \w+::calculateSkillRatio\([^\n]+/);
    const begin = source.indexOf(signature);
    let end = source.indexOf('{', begin) + 1;
    let depth = 1;
    for (; depth && end < source.length; end++) {
      if (source[end] === '{') depth++;
      if (source[end] === '}') depth--;
    }
    if (depth) throw new Error(`Cannot locate skill function: ${path}`);
    return source.slice(begin, end).replace(/\w+::calculateSkillRatio/, path.split('/')[1]).replace(/\) const \{/, ') {');
  }).join('\n');
  const healingCases = [
    ['acolyte/competentia', 'hp_amount', 1000000000],
    ['other/netrepair', 'heal_amount', 100000000],
    ['other/netsupport', 'heal_amount', 30000000],
    ['other/ilookuptoyou', 'gain_sp', 500000000],
    ['other/iwillprotectyou', 'gain_hp', 500000000],
  ].map(([path, variable, expected]) => {
    const source = readFileSync(resolve(root, `src/map/skills/${path}.cpp`), 'utf8');
    const statement = match(source, new RegExp(`int32 ${variable} = [^;]+;`));
    return `{ ${statement} assert(${variable} == ${expected}); }`;
  }).join('\n');
  const potionFunctions = ['aidpotion', 'aidberserkpotion'].map(name => {
    const source = readFileSync(resolve(root, `src/map/skills/merchant/${name}.cpp`), 'utf8');
    const declaration = match(source, /int(?:32|64) (?:j,)?hp = 0,\s*sp = 0;/);
    const percent = match(source, /hp = [^;\n]*tstatus->max_hp[^;\n]+;/);
    const vitality = match(source, /hp = hp \* \(100 \+ \(tstatus->vit \* 2\)\) \/ 100;/);
    const hplus = match(source, /hp \+= hp \* sstatus->hplus \/ 100;/);
    const clamp = match(source, /hp = cap_value\(hp, 0, INT_MAX\);/);
    return `int64 ${name}(status_data* tstatus, status_data* sstatus, int potion_per_hp) { ${declaration} ${percent} ${vitality} ${hplus} ${clamp} return hp; }`;
  }).join('\n');
  const itemHeal = between(pc, 'int32 pc_itemheal(', '\n/*');
  const itemTypes = between(itemHeal, '\n\tint32', '\n\tif (hp)');
  const itemBonus = between(itemHeal, '\t\ttmp = hp * bonus / 100;', '\n\t}\n\tif (sp)');
  const healSource = between(skillSource, 'int32 skill_calc_heal(', '\n/**');
  const healTypes = between(healSource, '\n\tint32', '\n#ifdef RENEWAL');
  const healReturn = match(healSource, /return cap_value\(hp, heal \? 1 : INT_MIN, INT_MAX\);/);
  const healHplus = match(healSource, /hp \+= hp \* status_get_hplus\(src\) \/ 100;/);
  const code = `
#include <cassert>
#include <climits>
#include <cmath>
#include <iostream>
#include <limits>
#include "common/utils.hpp"
#define RENEWAL
using std::min;
struct Weapon { uint16 atk = 0, matk = 0, wlv = 4; };
struct status_data {
  uint16 int_ = 0, dex = 0, luk = 0, spl = 0, con = 0, agi = 0, vit = 0;
  uint16 matk_min = 0, matk_max = 0;
  uint32 max_hp = 0, max_sp = 0, sp = 0;
  uint16 pow = 0;
  int16 ${fields.map(field => `${field} = 0`).join(', ')}, mdef = 0, def = 0;
  Weapon rhw;
};
constexpr int BL_PC = 1, BL_PET = 2, BL_MOB = 3, BL_MER = 4, BL_ELEM = 5, BL_HOM = 6;
constexpr int SU_POWEROFLIFE = 1, JOBL_2 = 1, MAPID_FIRSTMASK = 2, MAPID_THIEF = 2;
struct block_list { int type = BL_PC, level = 200; status_data data; };
struct Damage { int miscflag = 0; };
constexpr int SC_GT_REVITALIZE = 1, SC_DRAGONIC_AURA = 2;
struct status_change {
  bool active = false;
  bool hasSCE(int) const { return active; }
  const status_change* getSCE(int) const { return active ? this : nullptr; }
} changes;
const status_data* status_get_status_data(const block_list& bl) { return &bl.data; }
const status_change* status_get_sc(const block_list*) { return &changes; }
int status_get_lv(const block_list* bl) { return bl->level; }
${levelModifier}
${skillFunctions}
${potionFunctions}
int32 item_heal(int32 hp, int64 rate) { ${itemTypes} bonus = rate; ${itemBonus} return hp; }
int status_get_hplus(const block_list* src) { return src->data.hplus; }
int32 heal_amount(const block_list* src, int initial, bool heal) {
  ${healTypes} hp = initial; ${healHplus} ${healReturn}
}
int status_get_homint(const block_list*) { return 100; }
int status_get_homdex(const block_list*) { return 100; }
int status_get_homluk(const block_list*) { return 100; }
struct Player { int class_ = 0; int ${rateFields.map(field => `${field}_rate = 100`).join(', ')}; };
int pc_checkskill(Player*, int) { return 0; }
int status_get_def(status_data* status) { return status->def; }
int status_calc_smatk(void*, void*, int value) { return value; }
${matk}
void equipment(status_data* base_status, Player* sd) { ${modifiers} }
uint32 hp(double dmax) { ${hpReturn} }
void weapon_range(int stat, uint16 atk, int expected_min, int expected_max) {
  Weapon data{atk}; auto* wa = &data;
  ${baseStat} base_stat = stat;
  uint16 atkmin = atk, atkmax = atk;
  ${weapon}
  assert(atkmin == expected_min && atkmax == expected_max);
}
int main() {
  block_list bl;
  status_data data; auto* status = &data; auto* base_status = &data;
  Player player; auto* sd = &player;
  status->int_ = status->dex = status->luk = 100;
  assert(status_base_matk_min(&bl, status, 200) == 253);
  assert(status_base_matk_max(&bl, status, 200) == 253);
  int previous = 0;
  for (int value = 0; value <= USHRT_MAX; ++value) {
    status->int_ = status->dex = status->luk = status->spl = value;
    int minimum = status_base_matk_min(&bl, status, 275);
    int maximum = status_base_matk_max(&bl, status, 275);
    assert(minimum >= previous && minimum == maximum);
    previous = minimum;
  }
  assert(previous == USHRT_MAX);
  for (int rate : {100, 200, INT_MAX}) {
    ${fields.map(field => `base_status->${field} = SHRT_MAX;`).join('\n')}
    base_status->matk_min = base_status->matk_max = USHRT_MAX;
    ${rateFields.map(field => `sd->${field}_rate = rate;`).join('\n')}
    equipment(base_status, sd);
    ${passes}
    assert(base_status->matk_min == USHRT_MAX && base_status->matk_max == USHRT_MAX);
  }
  ${fields.map(field => `base_status->${field} = 100;`).join('\n')}
  base_status->matk_min = base_status->matk_max = 100;
  ${rateFields.map(field => `sd->${field}_rate = 150;`).join('\n')}
  equipment(base_status, sd);
  ${fields.map(field => `assert(base_status->${field} == 150);`).join('\n')}
  assert(base_status->matk_min == 150 && base_status->matk_max == 150);
  int skill = 10;
  ${passiveCases}
  assert(hp(12345.9) == 12345);
  assert(hp(-100) == 1);
  assert(hp(1e12) == UINT_MAX);
  weapon_range(100, 100, 130, 170);
  weapon_range(32676, 500, USHRT_MAX, USHRT_MAX);
  weapon_range(USHRT_MAX, USHRT_MAX, USHRT_MAX, USHRT_MAX);
  float temp_aspd;
  status->agi = status->dex = USHRT_MAX;
  ${aspd}
  assert(std::isfinite(std::sqrt(temp_aspd)) && temp_aspd > 2e9);
  auto* tstatus = status;
  auto* target = status;
  tstatus->mdef = tstatus->mdef2 = tstatus->def = tstatus->def2 = SHRT_MAX;
  ${defense} assert(tmdef == 65534);
  ${totaldef} assert(totaldef == 65534);
  int64 val = 0;
  status->max_hp = UINT_MAX;
  ${regen} assert(val == 85899395);
  status_data base; auto* b_status = &base;
  base.smatk = SHRT_MAX;
  void* sc = nullptr;
  status->spl = USHRT_MAX; status->con = USHRT_MAX;
  ${smatk} assert(status->smatk == SHRT_MAX);
  Damage damage;
  int32 ratio = 100;
  bl.data.sp = 100;
  asurastrike(&damage, &bl, &bl, 5, ratio, 0);
  assert(ratio == 1800);
  damage.miscflag = 1; ratio = 100; bl.data.sp = UINT_MAX;
  asurastrike(&damage, &bl, &bl, 5, ratio, 0);
  assert(ratio == 500000);
  damage.miscflag = 8; changes.active = true;
  bl.data.max_hp = 10000; bl.data.max_sp = 1000; ratio = 100;
  tigercannon(&damage, &bl, &bl, 10, ratio, 0);
  assert(ratio == 4095);
  bl.level = 275; bl.data.max_hp = bl.data.max_sp = 1000000000; ratio = 100;
  tigercannon(&damage, &bl, &bl, 10, ratio, 0);
  assert(ratio == 804375000);
  ratio = 100;
  dragonicbreath(&damage, &bl, &bl, 10, ratio, 0);
  assert(ratio == INT_MAX);
  ratio = 100; bl.data.pow = 32767;
  thirdflamebomb(&damage, &bl, &bl, 10, ratio, 0);
  assert(ratio == 550918967);
  tstatus->max_hp = tstatus->max_sp = 1000000000;
  int skill_lv = 5, hp_rate = 50, sp_rate = 50;
  ${healingCases}
  tstatus->max_hp = 1000; tstatus->vit = 100; tstatus->hplus = 10;
  assert(aidpotion(tstatus, tstatus, 10) == 330);
  assert(aidberserkpotion(tstatus, tstatus, 10) == 330);
  tstatus->max_hp = UINT_MAX; tstatus->vit = USHRT_MAX; tstatus->hplus = SHRT_MAX;
  assert(aidpotion(tstatus, tstatus, 100) == INT_MAX);
  assert(aidberserkpotion(tstatus, tstatus, 100) == INT_MAX);
  assert(item_heal(1000, 200) == 2000);
  assert(item_heal(1000000, 65000) == 650000000);
  assert(item_heal(INT_MAX, 65000) == INT_MAX);
  bl.data.hplus = 10;
  assert(heal_amount(&bl, 1000, true) == 1100);
  bl.data.hplus = SHRT_MAX;
  assert(heal_amount(&bl, 100000000, true) == INT_MAX);
  std::cout << "High status regression cases passed (65,536 MATK levels, equipment, passives, resources, combat, skill ratios, healing)\\n";
}
`;
  const build = spawnSync('g++', ['-std=c++17', '-O1', '-fsanitize=address,undefined,float-cast-overflow', '-fno-sanitize-recover=all', '-I', resolve(root, 'src'), '-x', 'c++', '-', '-o', resolve(output)], { input: code, stdio: ['pipe', 'inherit', 'inherit'] });
  if (build.status !== 0) process.exit(build.status || 1);
  const run = spawnSync(resolve(output), [], { stdio: 'inherit' });
  process.exit(run.status || (run.signal ? 1 : 0));
}
