import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const plain = process.argv.includes('--no-color');
const args = process.argv.slice(2).filter(value => value !== '--no-color');
if (!args.length || args[0] === '--help') {
 const color = (code, value) => plain ? value : `\x1b[${code}m${value}\x1b[0m`;
 console.log(`\n${color('1;36', 'HappyRO Knight range regression')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/knight-range.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/knight-range.test.mjs /tmp/knight-range-test')}\n`);
} else {
 if (args.length !== 1 || args[0].startsWith('-')) throw new Error('Expected one artifact path');
 const root = fileURLToPath(new URL('../', import.meta.url));
 const read = file => readFileSync(resolve(root, file), 'utf8');
 function extract(source, signature) {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`Missing ${signature}`);
  const body = source.indexOf('{', start);
  let depth = 1, end = body + 1;
  while (depth && end < source.length) {
   if (source[end] === '{') depth++;
   if (source[end] === '}') depth--;
   end++;
  }
  if (depth) throw new Error(`Unclosed ${signature}`);
  return source.slice(start, end);
 }
 const range = extract(read('src/map/battle.cpp'), 'static int32 battle_range_type(');
 const modify = extract(read('src/map/skills/swordman/windcutter.cpp'), 'void SkillWindCutter::modifyDamageData(');
 const ids = [...new Set([...range.matchAll(/case ([A-Z0-9_]+):/g)].map(match => match[1]))];
 const code = `
#include <cassert>
#include <cstdint>
#include <iostream>
#define RENEWAL
using int32=int32_t; using uint16=uint16_t;
constexpr int BL_PC=1,BL_MOB=2,BF_WEAPON=1,BF_SKILL=2,BF_SHORT=4,BF_LONG=8;
enum { W_DAGGER=1,W_BOW,W_MACE,W_2HMACE,W_1HSPEAR,W_2HSPEAR,W_2HSWORD };
enum { INF2_ISTRAP=100,RK_WINDCUTTER,${ids.join(',')} };
struct block_list { int type=BL_MOB; };
struct map_session_data : block_list { int weapontype1=W_DAGGER; struct { int weapon=W_DAGGER; } status; map_session_data(){type=BL_PC;} };
#define BL_CAST(kind,ptr) ((ptr)->type==kind?static_cast<const map_session_data*>(ptr):nullptr)
struct Damage { int flag=BF_WEAPON|BF_SKILL; int div_=1; };
struct { int skillrange_by_distance=0; } battle_config;
bool nearby=true;
bool skill_get_inf2(uint16,int) { return false; }
bool check_distance_bl(const block_list*,const block_list*,int) { return nearby; }
int skill_get_range2(const block_list*,uint16,uint16,bool) { return 0; }
struct SkillWindCutter { void modifyDamageData(Damage&,const block_list&,const block_list&,uint16) const; };
${range}
${modify}
int main() {
 SkillWindCutter skill; map_session_data src; block_list target;
 for(int level=1;level<=5;level++) for(int by_distance : {0,BL_PC}) for(bool close : {true,false}) {
  battle_config.skillrange_by_distance=by_distance;nearby=close;
  for(int weapon : {W_DAGGER,W_2HSWORD,W_1HSPEAR,W_2HSPEAR}) {
   src.status.weapon=src.weapontype1=weapon;
   const int initial=battle_range_type(&src,&target,RK_WINDCUTTER,level);
   Damage damage;damage.flag|=initial;
   skill.modifyDamageData(damage,src,target,level);
   assert(damage.div_==(weapon==W_2HSWORD?2:1));
   const int expected=(weapon==W_1HSPEAR||weapon==W_2HSPEAR)?BF_LONG:initial;
   assert((damage.flag&(BF_SHORT|BF_LONG))==expected);
   assert((damage.flag&(BF_WEAPON|BF_SKILL))==(BF_WEAPON|BF_SKILL));
   if((weapon==W_1HSPEAR||weapon==W_2HSPEAR)) {
    // Spear attacks must not also trigger melee-only defenses.
    assert((damage.flag&(BF_SHORT|BF_WEAPON))!=(BF_SHORT|BF_WEAPON));
    assert((damage.flag&(BF_LONG|BF_WEAPON))==(BF_LONG|BF_WEAPON));
   }
  }
 }
 Damage npc; npc.flag|=BF_SHORT;skill.modifyDamageData(npc,target,target,5);
 assert(npc.flag==(BF_WEAPON|BF_SKILL|BF_SHORT));
 std::cout<<"PASS: Wind Cutter keeps one range category and weapon hit count at levels 1-5\\n";
}
`;
 const artifact = resolve(args[0]);
 const build = spawnSync('g++', ['-std=c++17', '-fsanitize=undefined', '-fno-sanitize-recover=all', '-x', 'c++', '-', '-o', artifact], { input: code, encoding: 'utf8' });
 if (build.status !== 0) throw new Error(build.stderr);
 const result = spawnSync(artifact, [], { encoding: 'utf8' });
 process.stdout.write(result.stdout);process.stderr.write(result.stderr);
 if (result.status !== 0) throw new Error(`Regression failed: ${result.status ?? result.signal}`);
}
