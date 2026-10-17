import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const plain = args.includes('--no-color');
const options = args.filter(arg => arg !== '--no-color');
if (!options.length || options[0] === '--help') {
 const color = (code, text) => plain ? text : `\x1b[${code}m${text}\x1b[0m`;
 console.log(`\n${color('1;36', 'HappyRO Priest shield regression')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/priest-shield.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/priest-shield.test.mjs /tmp/priest-shield-test')}\n`);
} else {
 if (options.length !== 1 || options[0].startsWith('-')) throw new Error('Expected one artifact path');
 const root = fileURLToPath(new URL('../', import.meta.url));
 const source = readFileSync(resolve(root, 'src/map/status.cpp'), 'utf8');
 const start = source.indexOf('case SC_KYRIE:', source.indexOf('case SC_MAGICROD:', source.indexOf('case SC_POISONREACT:')));
 const end = source.indexOf('case SC_MAGICPOWER:', start);
 if (start < 0 || end < 0) throw new Error('Kyrie initialization branch missing');
 const code = `
#include <cassert>
#include <cstdint>
#include <iostream>
using int64 = int64_t;
constexpr int SC_KYRIE=1;
struct Status { uint32_t max_hp; };
void check(uint32_t hp,int level,int members) {
 Status data{hp};auto* status=&data;
 int val1=level,val2=0,val3=0,val4=members;
 switch(SC_KYRIE){${source.slice(start,end)}}
 assert(val2==int64(hp)*(level*2+10)/100+members*2);
 assert(val3==(members ? 6+level : level/2+5));
}
int main(){
 for(int level=1;level<=10;level++)
  for(uint32_t hp:{0u,1u,99u,100u,1000000u,143165576u,200000000u,2000000000u,UINT32_MAX})
   for(int members:{0,1,2,12}) check(hp,level,members);
 std::cout<<"Kyrie and Praefatio levels, party sizes and HP boundaries passed\\n";
}
`;
 const output = resolve(options[0]);
 const build = spawnSync('c++', ['-std=c++17', '-fsanitize=undefined', '-fno-sanitize-recover=all', '-x', 'c++', '-', '-o', output], { input: code, encoding: 'utf8' });
 if (build.status !== 0) throw new Error(build.stderr || 'Compiler failed');
 const run = spawnSync(output, [], { encoding: 'utf8' });
 if (run.status !== 0) throw new Error(run.stderr || 'Regression failed');
 process.stdout.write(run.stdout);
}
