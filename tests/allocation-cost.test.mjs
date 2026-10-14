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
  console.log(`\n${color('1;36', 'HappyRO allocation cost regression test')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/allocation-cost.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/allocation-cost.test.mjs /tmp/happyro-allocation-test')}\n`);
} else {
  if (options.length !== 1 || output.startsWith('-')) throw new Error('Expected one artifact path');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const source = readFileSync(resolve(root, 'src/map/clif.cpp'), 'utf8');
  const between = (first, last) => {
    const start = source.indexOf(first);
    const end = source.indexOf(last, start);
    if (start < 0 || end < 0) throw new Error(`Missing production section: ${first}`);
    return source.slice(start, end);
  };
  const send = between('static void clif_par_change(', '\n/// Notifies');
  const costCase = between('\t\tcase SP_USTR:', '\n\t\tcase SP_ATTACKRANGE:');
  const initial = between('void clif_initialstatus(', '\n\n/// Marks');
  // Execute the actual post-snapshot refresh sequence; unrelated status fields are ignored.
  const refresh = initial.slice(initial.indexOf('\n\tclif_updatestatus(sd, SP_STR);'), initial.lastIndexOf('}'));
  const params = [...new Set(refresh.match(/SP_[A-Z]+/g))];
  const code = `
#include <cassert>
#include <cstdint>
#include <iostream>
#include <vector>
using uint16=uint16_t; using int32=int32_t;
enum _sp { SP_USTR=32,SP_UAGI,SP_UVIT,SP_UINT,SP_UDEX,SP_ULUK,${params.filter(p=>!['SP_USTR','SP_ULUK'].includes(p)).map((p,i)=>`${p}=${100+i}`).join(',')} };
constexpr int HEADER_ZC_PAR_CHANGE=0xb0, SELF=0;
struct PACKET_ZC_PAR_CHANGE {uint16 PacketType,varID; int32 count;};
struct map_session_data {int cost=256;};
std::vector<PACKET_ZC_PAR_CHANGE> packets;
void clif_send(const void* p,size_t,const map_session_data*,int){packets.push_back(*static_cast<const PACKET_ZC_PAR_CHANGE*>(p));}
int pc_need_status_point(const map_session_data* sd,int,int){return sd->cost;}
${send}
void clif_updatestatus(map_session_data& sd,_sp type){switch(type){${costCase}default:break;}}
void initial_costs(map_session_data& sd){${refresh}}
int main(){
 map_session_data sd;
 for(int cost:{256,260,512,0,2,26148}){
  sd.cost=cost; packets.clear(); clif_updatestatus(sd,SP_USTR);
  assert(packets.size()==1 && packets[0].PacketType==0xb0 && packets[0].count==cost);
 }
 sd.cost=256;packets.clear();initial_costs(sd);
 assert(packets.size()==6);
 for(int i=0;i<6;i++) assert(packets[i].varID==SP_USTR+i && packets[i].count==256);
 std::cout<<"Full-width costs, capped zero and initial refresh passed\\n";
}
`;
  const build = spawnSync('g++', ['-std=c++17', '-x', 'c++', '-', '-o', resolve(output)], {input:code,stdio:['pipe','inherit','inherit']});
  if (build.status !== 0) process.exit(build.status || 1);
  const run = spawnSync(resolve(output), [], {stdio:'inherit'});
  process.exit(run.status || (run.signal ? 1 : 0));
}
