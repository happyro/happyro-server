import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const args=process.argv.slice(2),plain=args.includes('--no-color');
if(!args.includes('--run')){const c=(n,s)=>plain?s:`\x1b[${n}m${s}\x1b[0m`;console.log(`\n${c('1;36','HappyRO homunculus enemy target contract')}\n\n${c('1;33','Usage')}\n  ${c('1;32','node tests/homunculus-enemy-target.test.mjs --run')} [--no-color]\n\n${c('1;33','Example')}\n  ${c('36','node tests/homunculus-enemy-target.test.mjs --run --no-color')}\n`);}else{
 const db=readFileSync(new URL('../db/re/skill_db.yml',import.meta.url),'utf8');
 const block=db.split('  - Id: 8050\n')[1].split('\n  - Id:')[0];
 assert.match(block,/Name: MH_BLAZING_AND_FURIOUS\n/);assert.match(block,/TargetType: Attack\n/);assert.match(block,/NoDamage: true\n/);assert.match(block,/SpiritSphereCost: 1(?:\n|$)/);
 const impl=readFileSync(new URL('../src/map/skills/homunculus/homunculus_blazingandfurious.cpp',import.meta.url),'utf8');assert.match(impl,/battle_check_target\(src, target, BCT_ENEMY\) > 0/);
 // Apply the protocol target mask selected by the real DB entry to entity categories.
 const masks={Attack:1,Support:16,Self:4},type=block.match(/TargetType: (\w+)/)[1],flag=masks[type];
 const isSelectable=entityMask=>Boolean(entityMask&flag);
 assert.equal(isSelectable(1|64),true,'hostile monster must be selectable');
 assert.equal(isSelectable(16),false,'owner cannot receive this enemy-only spell');
 assert.equal(isSelectable(128|16),false,'friendly homunculus cannot receive this spell');
 const generator=db.split('  - Id: 8051\n')[1].split('\n  - Id:')[0];assert.match(generator,/TargetType: Self\n/);
 console.log('Blazing And Furious DB advertises enemy target and retains no-damage dispatch/sphere requirement');
}
