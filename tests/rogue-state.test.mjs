import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const args = process.argv.slice(2);
const plain = args.includes('--no-color');
const options = args.filter(arg => arg !== '--no-color');
if (!options.length || options[0] === '--help') {
 const color = (code, text) => plain ? text : `\x1b[${code}m${text}\x1b[0m`;
 console.log(`\n${color('1;36', 'HappyRO Rogue combat regression')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/rogue-state.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/rogue-state.test.mjs /tmp/rogue-state-test')}\n`);
} else {
 if (options.length !== 1 || options[0].startsWith('-')) throw new Error('Expected one artifact path');
 const root = fileURLToPath(new URL('../', import.meta.url));
 const read = name => readFileSync(resolve(root, name), 'utf8');
 const shared = read('src/map/skill.cpp');
 const status = read('src/map/status.cpp');
 const selectStart = shared.indexOf('void skill_select_menu(');
 const select = shared.slice(selectStart, shared.indexOf('int32 skill_elementalanalysis(', selectStart));
 const releaseStart = status.indexOf('case SC_CLOSECONFINE2:', status.indexOf('int32 status_change_end('));
 const release = status.slice(releaseStart, status.indexOf('[[fallthrough]];', releaseStart));
 const invis = status.slice(status.indexOf('case SC__INVISIBILITY:', status.indexOf('TIMER_FUNC(status_change_timer)'))).match(/status_charge\(bl, 0, ([^\n]+)\) \)/)?.[1];
 const shadow = shared.match(/if\( src && \(status_isdead\(\*src\) \|\| ([^\n]+)\) \) \{/)[1];
 if (!select.startsWith('void') || releaseStart < 0 || !invis) throw new Error('Missing Rogue production paths');
 const parser = read('src/map/clif.cpp').split('void clif_parse_SkillSelectMenu')[1].split('/// Kagerou')[0];
 if (parser.includes('pc_istrading')) throw new Error('Trading path bypasses selection state cleanup');
 const code = `
#include <cassert>
#include <cstdint>
#include <algorithm>
#include <iostream>
using int32=int32_t; using int64=int64_t; using uint16=uint16_t;
using std::min;
constexpr int SC_STOP=1,SC_AUTOSHADOWSPELL=2,SC__AUTOSHADOWSPELL=3,SKILL_FLAG_PLAGIARIZED=4,INF2_ISAUTOSHADOWSPELL=5,SC_CLOSECONFINE=6,SC_CLOSECONFINE2=7,BCT_ENEMY=1;
struct Entry { int val1=1,val2=1; };
struct status_change { Entry e; bool active=true; Entry* getSCE(int) { return active?&e:nullptr; } };
struct block_list { int relation=1; bool dead=false; status_change sc; };
struct map_session_data: block_list {
 struct { struct { uint16 id=100; int lv=10,flag=SKILL_FLAG_PLAGIARIZED; } skill[2]; } status;
 int learned=10,failed=0,started=0,level=0,chance=0; bool trading=false;
};
int pc_checkskill(map_session_data* s,int) { return s->learned; }
bool pc_isdead(map_session_data* s) { return s->dead; }
bool pc_istrading(map_session_data* s) { return s->trading; }
void clif_skill_fail(map_session_data& s,int) { s.failed++; }
void status_change_end(block_list* s,int) { s->sc.active=false; }
int skill_get_index(int id) { return id==100?1:0; }
bool skill_get_inf2(int id,int) { return id==100; }
int skill_get_time(int,int lv) { return lv*1000; }
void sc_start4(map_session_data* s,map_session_data*,int,int,int,int lv,int prob,int,int) { s->started++;s->level=lv;s->chance=prob; }
${select}
block_list owner; block_list* map_id2bl(int id) { return id==1?&owner:nullptr; }
status_change* status_get_sc(block_list* b) { return b?&b->sc:nullptr; }
void release_target(int val2) { switch(SC_CLOSECONFINE2) { ${release} break; } }
bool status_isdead(block_list& b) { return b.dead; }
int battle_check_target(block_list*,block_list* b,int) { return b->relation; }
bool invalid_shadow(block_list* src) { block_list target; auto* bl=&target; return status_isdead(*src) || ${shadow}; }
int64 invis_cost(uint32_t sp,int level) { struct { uint32_t max_sp; } data{sp}; auto* status=&data; Entry e; e.val1=level; auto* sce=&e; return ${invis}; }
int main() {
 for(int level=1;level<=10;level++) {
  map_session_data s; s.sc.e.val1=level;
  skill_select_menu(s,100);
  assert(!s.sc.active && s.started==1 && s.level==(level+5)/2 && s.chance==(level==10?15:30-2*level));
 }
 for(int cancel : {0,65535}) { map_session_data s; skill_select_menu(s,cancel); assert(!s.sc.active && !s.started && !s.failed); }
 for(int mode=0;mode<6;mode++) {
  map_session_data s; s.sc.e.val1=10;
  if(mode==0)s.sc.active=false;
  if(mode==1)s.learned=0;
  if(mode==2)s.dead=true;
  if(mode==3)s.trading=true;
  if(mode==4)s.status.skill[1].flag=0;
  if(mode==5)s.status.skill[1].id=0;
  skill_select_menu(s,100); assert(!s.sc.active && !s.started && s.failed==1);
 }
 map_session_data s; s.status.skill[1].lv=1; skill_select_menu(s,100); assert(s.level==1);
 owner.sc.e.val1=1;owner.sc.e.val2=2;owner.sc.active=true;
 release_target(1);assert(owner.sc.active && owner.sc.e.val1==1 && owner.sc.e.val2==1);
 release_target(1);assert(!owner.sc.active && owner.sc.e.val2==0);
 for(int relation : {-1,0,1}) { owner.relation=relation; assert(invalid_shadow(&owner)==(relation<=0)); }
 owner.relation=1; owner.dead=true;assert(invalid_shadow(&owner));
 for(uint32_t sp : {100u,1000000000u,UINT32_MAX}) for(int level=1;level<=5;level++) assert(invis_cost(sp,level)==int64(sp)*(12-2*level)/100);
 std::cout << "Rogue selection cleanup, confinement, shadow target and SP boundaries passed\\n";
}
`;
 const output=resolve(options[0]);
 const build=spawnSync('c++',['-std=c++17','-fsanitize=undefined','-fno-sanitize-recover=all','-x','c++','-','-o',output],{input:code,encoding:'utf8'});
 if(build.status!==0) throw new Error(build.stderr||'Compiler failed');
 const run=spawnSync(output,[],{encoding:'utf8'});
 if(run.status!==0) throw new Error(run.stderr||'Regression failed');
 process.stdout.write(run.stdout);
}
