import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const plain = args.includes('--no-color');
const options = args.filter(arg => arg !== '--no-color');
if (!options.length || options[0] === '--help') {
 const color = (code, text) => plain ? text : `\x1b[${code}m${text}\x1b[0m`;
 console.log(`\n${color('1;36', 'HappyRO Hunter status regression')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/hunter-status.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/hunter-status.test.mjs /tmp/hunter-status-test')}\n`);
} else {
 if (options.length !== 1 || options[0].startsWith('-')) throw new Error('Expected one artifact path');
 const root = fileURLToPath(new URL('../', import.meta.url));
 const source = readFileSync(resolve(root, 'src/map/status.cpp'), 'utf8');
 const timer = source.slice(source.indexOf('TIMER_FUNC(status_change_timer)'));
 const start = timer.indexOf('case SC_ELECTRICSHOCKER:');
 const end = timer.indexOf('case SC_CAMOUFLAGE:', start);
 if (start < 0 || end < 0) throw new Error('Electric Shocker timer branch missing');
 const code = `
#include <cassert>
#include <cstdint>
#include <iostream>
using int64 = int64_t;
constexpr int SC_ELECTRICSHOCKER=1;
struct block_list {};
struct Status { uint32_t max_sp; };
struct Entry { int val1,val4; };
int64 charged=0;int calls=0;int64 next=0;
void status_charge(block_list*,int64 hp,int64 sp){assert(hp==0);charged=sp;calls++;}
#define sc_timer_next(value) (next=(value))
int run(Status* status,Entry* sce){block_list b;auto*bl=&b;int64 tick=5000;
 switch(SC_ELECTRICSHOCKER){${timer.slice(start, end)}}
 return 1;
}
int main(){
 for(int level=1;level<=5;level++)for(uint32_t sp:{0u,1u,99u,100u,1000000u,200000000u,1000000000u,UINT32_MAX}){
  Status status{sp};Entry entry{level,2};charged=0;calls=0;next=0;
  assert(run(&status,&entry)==0);
  assert(charged==int64(sp)*5*level/100 && calls==1 && next==6000);
  assert(run(&status,&entry)==0 && calls==2 && entry.val4==0);
  next=0;assert(run(&status,&entry)==1 && calls==2 && next==0);
 }
 std::cout<<"Electric Shocker levels, SP boundaries and timer expiry passed\\n";
}
`;
 const output = resolve(options[0]);
 const build = spawnSync('c++', ['-std=c++17', '-fsanitize=undefined', '-fno-sanitize-recover=all', '-x', 'c++', '-', '-o', output], { input: code, encoding: 'utf8' });
 if (build.status !== 0) throw new Error(build.stderr || 'Compiler failed');
 const run = spawnSync(output, [], { encoding: 'utf8' });
 if (run.status !== 0) throw new Error(run.stderr || 'Regression failed');
 process.stdout.write(run.stdout);
}
