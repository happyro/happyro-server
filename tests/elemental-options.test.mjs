import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const plain = args.includes('--no-color');
const options = args.filter(arg => arg !== '--no-color');
if (!options.length || options[0] === '--help') {
  const color = (code, text) => plain ? text : `\x1b[${code}m${text}\x1b[0m`;
  console.log(`\n${color('1;36', 'HappyRO elemental option regression')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/elemental-options.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/elemental-options.test.mjs /tmp/elemental-options-test')}\n`);
} else {
  if (options.length !== 1 || options[0].startsWith('-')) throw new Error('Expected one artifact path');
  const directory = fileURLToPath(new URL('../src/map/skills/elemental/', import.meta.url));
  const cases = readdirSync(directory).filter(name => name.endsWith('.cpp')).flatMap(name => {
    const source = readFileSync(resolve(directory, name), 'utf8');
    if (!source.includes('sc_type type2 = (sc_type)(type-1);')) return [];
    const method = source.slice(source.search(/void \w+::castendNoDamageId/));
    const className = method.match(/^void (\w+)::castendNoDamageId/)[1];
    return [{ name, method, className }];
  });
  if (cases.length !== 30) throw new Error(`Review changed option skill coverage: ${cases.length}`);
  const code = `
#include <cassert>
#include <cstdint>
#include <set>
#include <iostream>
using uint16=uint16_t; using int32=int32_t; using t_tick=int64_t; using sc_type=int;
constexpr int BL_ELEM=1,DMGVAL_IGNORE=-30000,DMG_SINGLE=1,BLOWN_NONE=0;
struct status_change { std::set<int> entries; bool getSCE(int type) { return entries.count(type); } };
struct block_list { int id=1; bool elemental=false; status_change sc; };
struct s_elemental_data : block_list { s_elemental_data() { elemental=true; } };
#define BL_CAST(kind,ptr) ((ptr)->elemental ? static_cast<s_elemental_data*>(ptr) : nullptr)
status_change* status_get_sc(block_list* src) { return &src->sc; }
int skill_get_sc(int) { return 101; }
int skill_get_time(int,int) { return 10000; }
int skill_get_blewcount(int,int) { return 3; }
int rnd() { return 1; }
int status_get_amotion(block_list*) { return 100; }
void status_change_end(block_list* src,int type) { src->sc.entries.erase(type); }
void sc_start(block_list*,block_list* target,int type,int,int,int) { target->sc.entries.insert(type); }
void clif_skill_nodamage(block_list*,block_list&,int,int) {}
template<typename... T> void clif_skill_damage(T...) {}
template<typename... T> void skill_blown(T...) {}
${cases.map(({ className, method }) => `
struct ${className} { int getSkillId() const { return 1; } void castendNoDamageId(block_list*,block_list*,uint16,t_tick,int32&) const; };
${method}
`).join('\n')}
template<class Skill> void check() {
 int32 flag=0; Skill skill;
 for(int initial=0;initial<4;initial++) {
  s_elemental_data elemental; block_list master;
  // Unrelated effects must survive both activation and deactivation.
  elemental.sc.entries.insert(999); master.sc.entries.insert(999);
  if(initial&1) elemental.sc.entries.insert(100);
  if(initial&2) master.sc.entries.insert(101);
  skill.castendNoDamageId(&elemental,&master,1,0,flag);
  assert(elemental.sc.getSCE(100)==(initial==0));
  assert(master.sc.getSCE(101)==(initial==0));
  assert(elemental.sc.getSCE(999) && master.sc.getSCE(999));
  skill.castendNoDamageId(&elemental,&master,1,0,flag);
  assert(elemental.sc.getSCE(100)==(initial!=0));
  assert(master.sc.getSCE(101)==(initial!=0));
 }
 block_list ordinary,master;
 skill.castendNoDamageId(&ordinary,&master,1,0,flag);
 assert(ordinary.sc.entries.empty() && master.sc.entries.empty());
}
int main() {
 ${cases.map(({className}) => `check<${className}>();`).join('\n ')}
 std::cout << "30 elemental option skills: activation, removal, partial state and source checks passed\\n";
}
`;
  const output = resolve(options[0]);
  const build = spawnSync('c++', ['-std=c++17', '-fsanitize=undefined', '-fno-sanitize-recover=all', '-x', 'c++', '-', '-o', output], { input: code, encoding: 'utf8' });
  if (build.status !== 0) throw new Error(build.stderr || build.error?.message || 'Build failed');
  const run = spawnSync(output, [], { encoding: 'utf8' });
  process.stdout.write(run.stdout || '');
  if (run.status !== 0) throw new Error(run.stderr || 'Regression failed');
}
