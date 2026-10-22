import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const root=path.resolve(import.meta.dirname,'..');
const args=process.argv.slice(2);
const paint=(code,text)=>args.includes('--no-color')?text:`\x1b[${code}m${text}\x1b[0m`;
const options=args.filter(arg=>arg!=='--no-color');
if(!options.length||options[0]==='--help'){
 console.log(`\n${paint('1;36','HappyRO map-load recovery policy tests')}\n\n${paint('1;33','Usage')}\n  ${paint('1;32','node tests/map-load-recovery.test.mjs OUTPUT')} [--no-color]\n\n${paint('1;33','Example')}\n  ${paint('36','node tests/map-load-recovery.test.mjs ../../work/novice-audit/map-load-recovery-test')}\n`);
}else{
 if(options.length!==1||options[0].startsWith('-'))throw Error('Expected output executable path');
 const output=path.resolve(options[0]);fs.mkdirSync(path.dirname(output),{recursive:true});
 const flags=['-std=c++17'];if(process.env.SDKROOT)flags.push('-isysroot',process.env.SDKROOT);
 const build=spawnSync(process.env.CXX||'c++',[...flags,path.join(root,'tests/map-load-recovery.cpp'),'-o',output],{stdio:'inherit'});
 if(build.status!==0)process.exit(build.status||1);
 const run=spawnSync(output,[],{stdio:'inherit'});process.exit(run.status||0);
}
