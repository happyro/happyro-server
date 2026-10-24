import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const pc = read('src/map/pc.cpp');
const clif = read('src/map/clif.cpp');
function body(source, signature) {
 const start = source.indexOf(signature);
 assert.ok(start >= 0, signature);
 return source.slice(start, source.indexOf('\n}\n', start) + 3);
}

test('all supported mutation paths batch permission updates', () => {
 for (const name of ['pc_jobchange', 'pc_skill', 'pc_skillup', 'pc_allskillup', 'pc_resetskill', 'pc_resetlvl', 'pc_skill_plagiarism', 'pc_skill_plagiarism_reset', 'pc_equipitem', 'pc_unequipitem', 'pc_equipswitch']) {
  const signature = pc.match(new RegExp(`^(?:bool|void|int32) ${name}\\(`, 'm'))?.[0];
  assert.ok(signature, name);
  assert.ok(body(pc, signature).includes('InventoryEquipUpdate equip_update('), name);
 }
 assert.ok(body(read('src/map/status.cpp'), 'int32 status_calc_pc_(').includes('InventoryEquipUpdate equip_update(*sd);'));
 assert.ok(body(read('src/map/game_control_skills.cpp'), 'int32_t game_control_learn_job_skills(').includes('InventoryEquipUpdate equip_update(*sd);'));
 for (const mutation of [body(pc, 'bool pc_jobchange('), body(read('src/map/game_control_skills.cpp'), 'int32_t game_control_learn_job_skills(')]) {
  assert.ok(mutation.indexOf('equip_update.finish();') >= 0);
  assert.ok(mutation.indexOf('equip_update.finish();') < mutation.indexOf('chrif_save('));
 }
 const jobChange = body(pc, 'bool pc_jobchange(');
 const endSoulLink = jobChange.indexOf('status_change_end( sd, SC_SPIRIT );');
 assert.ok(endSoulLink > jobChange.indexOf('sd->class_ = b_class;'));
 assert.ok(endSoulLink < jobChange.indexOf('pc_isequip('), 'end temporary equipment exemptions before checking worn items');
 assert.equal(jobChange.match(/status_change_end\( sd, SC_SPIRIT \);/g)?.length, 1);
 const finalWornCheck = jobChange.indexOf('// Mount/cart removal');
 assert.ok(finalWornCheck > jobChange.indexOf('pc_setoption(sd, i);'));
 assert.ok(finalWornCheck > jobChange.indexOf('pc_setcart(sd, 0);'));
 assert.ok(finalWornCheck > jobChange.indexOf('pc_calc_skilltree(sd);'));
 assert.ok(finalWornCheck < jobChange.lastIndexOf('status_calc_pc(sd,SCO_FORCE);'));

 const inventory = body(clif, 'void clif_inventorylist(');
 assert.ok(inventory.includes('sd->inventory_dual_wield = pc_can_dual_wield(sd);'));
 assert.match(inventory, /clif_item_equip\([^;]+pc_equippoint\( sd, i \)/);
 assert.ok(inventory.includes('if (include_equip_switch)'));
 assert.ok(inventory.indexOf('clif_equipswitch_list(sd);') > inventory.indexOf('clif_inventoryEnd( sd, type );'));
 assert.match(clif, /clif_inventorylist\(sd, false\);[^;]*pc_checkitem\(sd\);[^;]*clif_equipswitch_list\(sd\);/s);
});

test('production permission reconciliation handles grants, loss and nested updates', () => {
 const header = read('src/map/pc.hpp');
 const declaration = header.slice(header.indexOf('class InventoryEquipUpdate {'), header.indexOf('\n};', header.indexOf('class InventoryEquipUpdate {')) + 3);
 const functions = pc.slice(pc.indexOf('bool pc_can_dual_wield('), pc.indexOf('int32 pc_equippoint_sub(')) + body(pc, 'int32 pc_equippoint_sub(');
 const source = read('tests/inventory-equip-permissions-stubs.hpp') + declaration + '\n' + functions + read('tests/inventory-equip-permissions-cases.hpp');
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'happyro-equip-permissions-'));
 try {
  const binary = path.join(dir, 'regression');
  const compile = spawnSync('c++', ['-std=c++17', '-fsanitize=address,undefined', '-x', 'c++', '-', '-o', binary], { input: source, encoding: 'utf8' });
  assert.equal(compile.status, 0, compile.stderr);
  const run = spawnSync(binary, [], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /PASS:/);
 } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
