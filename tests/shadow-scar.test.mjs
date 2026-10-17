import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const plain = args.includes('--no-color');
const options = args.filter(arg => arg !== '--no-color');
if (!options.length || options[0] === '--help') {
 const color = (code, text) => plain ? text : `\x1b[${code}m${text}\x1b[0m`;
 console.log(`\n${color('1;36', 'HappyRO Shadow Scar lifecycle regression')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/shadow-scar.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/shadow-scar.test.mjs /tmp/shadow-scar-test')}\n`);
} else {
 if (options.length !== 1 || options[0].startsWith('-')) throw new Error('Expected one artifact path');
 const root = fileURLToPath(new URL('../', import.meta.url));
 const source=readFileSync(resolve(root,'src/map/unit.cpp'),'utf8');
 const start=source.indexOf('static TIMER_FUNC(unit_shadowscar_timer)');
 const end=source.indexOf('/**\n * Initialization function', start);
 if(start<0 || end<0)throw new Error('Shadow Scar methods missing');
 const status=readFileSync(resolve(root,'src/map/status.cpp'),'utf8');
 const cleanupStart=status.indexOf('\t\tcase SC_SHADOW_SCAR:',status.indexOf('int32 status_change_clear('));
 const cleanup=cleanupStart<0?'':status.slice(cleanupStart,status.indexOf('\n\t\tcase ',cleanupStart+1));
 const code=`
#include <algorithm>
#include <cassert>
#include <cstdint>
#include <iostream>
#include <set>
#include <vector>
using int32=int32_t;using t_tick=int64_t;
constexpr int SC_SHADOW_SCAR=1,INFINITE_TICK=-1,MAX_SHADOW_SCAR=100;
#define TIMER_FUNC(name) int name(int tid,t_tick tick,int id,intptr_t data)
struct status_change_entry{int val1=0;};
struct status_change{bool active=false;status_change_entry entry;status_change_entry*getSCE(int){return active?&entry:nullptr;}};
struct block_list{int id=7;status_change sc;};
struct unit_data{block_list*bl;std::vector<int32>shadow_scar_timer;};
block_list target;unit_data unit{&target};bool reject=false,available=true;int nextid=0;std::set<int>pending;std::vector<int>packets;
block_list*map_id2bl(int id){return id==target.id?&target:nullptr;}
unit_data*unit_bl2ud(block_list*b){return b?&unit:nullptr;}
status_change*status_get_sc(block_list*b){return available?&b->sc:nullptr;}
void clif_enchantingshadow_spirit(const unit_data&u){packets.push_back(u.shadow_scar_timer.size());}
using Callback=int(*)(int,t_tick,int,intptr_t);
int add_timer(t_tick,Callback,int,int){pending.insert(++nextid);return nextid;}
void delete_timer(int id,Callback){pending.erase(id);}
t_tick gettick(){return 100;}
const char*status_get_name(block_list&){return "target";}
void ShowWarning(const char*,...){ }
bool sc_start(block_list*,block_list*b,int,int,int count,int){if(reject)return false;b->sc.active=true;b->sc.entry.val1=count;return true;}
void unit_clearshadowscar(unit_data&);
void status_change_end(block_list*bl,int type){
 if(!bl->sc.active)return;
 bl->sc.active=false;
 switch(type){${cleanup}}
}
${source.slice(start,end)}
void expire(int id){pending.erase(id);unit_shadowscar_timer(id,100,target.id,0);}
int main(){
 unit_addshadowscar(unit,1000);unit_addshadowscar(unit,2000);unit_addshadowscar(unit,3000);
 assert(target.sc.entry.val1==3 && packets.back()==3);
 auto ids=unit.shadow_scar_timer;
 expire(ids[1]);assert(target.sc.entry.val1==2 && packets.back()==2);
 expire(ids[0]);assert(target.sc.entry.val1==1 && packets.back()==1);
 expire(ids[2]);assert(!target.sc.active && pending.empty() && packets.back()==0);
 for(int i=0;i<100;i++)unit_addshadowscar(unit,3000);
 assert(target.sc.entry.val1==100 && pending.size()==100);
 unit_addshadowscar(unit,3000);assert(pending.size()==100);
 status_change_end(&target,SC_SHADOW_SCAR);
 assert(unit.shadow_scar_timer.empty() && pending.empty() && packets.back()==0);
 unit_addshadowscar(unit,3000);assert(target.sc.entry.val1==1 && pending.size()==1);
 status_change_end(&target,SC_SHADOW_SCAR);
 reject=true;unit_addshadowscar(unit,3000);assert(unit.shadow_scar_timer.empty() && pending.empty());
 reject=false;available=false;unit_addshadowscar(unit,3000);assert(pending.empty());
 assert(unit_shadowscar_timer(99,100,999,0)==1);
 std::cout<<"Shadow Scar staggered expiry, removal, reapplication, cap and rejected status passed\\n";
}
`;
 const output = resolve(options[0]);
 const build = spawnSync('c++', ['-std=c++17', '-fsanitize=undefined', '-fno-sanitize-recover=all', '-x', 'c++', '-', '-o', output], { input: code, encoding: 'utf8' });
 if (build.status !== 0) throw new Error(build.stderr || 'Compiler failed');
 const run = spawnSync(output, [], { encoding: 'utf8' });
 if (run.status !== 0) throw new Error(run.stderr || 'Regression failed');
 process.stdout.write(run.stdout);
}
