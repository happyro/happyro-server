import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const plain = args.includes('--no-color');
const options = args.filter(arg => arg !== '--no-color');
if (!options.length || options[0] === '--help') {
  const color = (code, text) => plain ? text : `\x1b[${code}m${text}\x1b[0m`;
  console.log(`\n${color('1;36', 'HappyRO safe city arrival regression test')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/city-arrival.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/city-arrival.test.mjs ../../work/diagnostics/city-arrival-test')}\n`);
} else {
  if (options.length !== 1 || options[0].startsWith('-')) throw new Error('Expected one artifact path');
  const root = fileURLToPath(new URL('../', import.meta.url));
  function extract(file, start, end) {
    const source = readFileSync(resolve(root, file), 'utf8');
    const begin = source.indexOf(start), finish = source.indexOf(end, begin);
    if (begin < 0 || finish < 0) throw new Error(`Cannot locate ${start}`);
    return source.slice(begin, finish);
  }
  const header = readFileSync(resolve(root, 'src/map/happyro_default_arrivals.hpp'), 'utf8');
  const entrances = header.split('happyro_entrance_arrivals[] = {')[1];
  const actual = [...entrances.matchAll(/\{"([^"\n]+)", (\d+), (\d+)\}/g)]
    .map(([, map, x, y]) => ({ map, x: Number(x), y: Number(y) }));
  const batches = ['quick-pass', 'expanded-pass', 'dungeon-pass', 'full-pass'].map(name =>
    JSON.parse(readFileSync(resolve(root, `docs/navigation-arrivals-${name}.json`), 'utf8')));
  const birth = JSON.parse(readFileSync(resolve(root, 'docs/navigation-arrivals-birth-pass.json'), 'utf8'));
  // Validate tutorial anchors against the actual Renewal terrain, including imports.
  const terrain = new Map();
  for (const file of ['db/map_cache.dat', 'db/re/map_cache.dat', 'db/import-tmpl/map_cache.dat']) {
    const buffer = readFileSync(resolve(root, file));
    let offset = 8;
    for (let i = 0; i < buffer.readUInt16LE(4); i++) {
      const map = buffer.subarray(offset, offset + 12).toString().replace(/\0.*$/, '');
      const width = buffer.readInt16LE(offset + 12), height = buffer.readInt16LE(offset + 14);
      const length = buffer.readInt32LE(offset + 16);
      offset += 20;
      terrain.set(map, {width, height, cells: inflateSync(buffer.subarray(offset, offset + length))});
      offset += length;
    }
  }
  for (const {map, x, y} of birth.new_entrance_maps) {
    const grid = terrain.get(map);
    assert.ok(grid, `${map}: missing terrain`);
    assert.ok(x > 0 && y > 0 && x < grid.width - 1 && y < grid.height - 1, `${map}: outside map`);
    assert.ok([0, 2, 3, 4, 6].includes(grid.cells[y * grid.width + x]), `${map}: impassable anchor`);
  }
  const expected = [...batches, birth].flatMap(batch => batch.new_entrance_maps.map(({ map, x, y }) => ({ map, x, y })));
  assert.deepEqual(actual, expected, 'Runtime entrance coordinates must match reviewed manifests');
  assert.equal(new Set(actual.map(row => row.map)).size, actual.length);
  const expanded = batches.at(-1);
  assert.equal(expanded.existing_maps + expanded.new_entrance_maps.length + expanded.new_service_maps.length + expanded.deferred.length, 891);
  const services = [...header.split('happyro_service_arrivals[] = {')[1].split('};')[0].matchAll(/\{"([^"\n]+)", "([^"\n]+)", true\}/g)].map(([, map, npc]) => ({ map, npc }));
  assert.deepEqual(services, batches.flatMap(batch => batch.new_service_maps.map(({ map, npc }) => ({ map, npc }))));
  const previous = batches.at(-2);
  const reviewed = [...expanded.new_entrance_maps, ...expanded.new_service_maps, ...expanded.deferred];
  assert.equal(new Set(reviewed.map(row => row.map)).size, reviewed.length);
  assert.deepEqual(reviewed.map(row => row.map).sort(), previous.deferred.map(row => row.map).sort());
  const approved = new Set([...actual.filter(row => !birth.new_entrance_maps.some(entry => entry.map === row.map)), ...services].map(row => row.map));
  assert.ok(expanded.deferred.every(row => !approved.has(row.map)));
  const code = readFileSync(resolve(root, 'tests/city-arrival-stubs.hpp'), 'utf8')
    + readFileSync(resolve(root, 'src/map/happyro_default_arrivals.hpp'), 'utf8')
    + extract('src/map/happyro_navigation.cpp', 'static bool happyro_safe_arrival_cell(', 'HappyroNavigationResult happyro_npc_teleport(')
    + readFileSync(resolve(root, 'tests/city-arrival-cases.hpp'), 'utf8');
  const output = resolve(options[0]);
  const build = spawnSync('c++', ['-std=c++17', '-O1', '-fsanitize=address,undefined', '-x', 'c++', '-', '-o', output], { input: code, stdio: ['pipe', 'inherit', 'inherit'] });
  if (build.status !== 0) process.exit(build.status || 1);
  const run = spawnSync(output, [], { stdio: 'inherit' });
  process.exit(run.status || (run.signal ? 1 : 0));
}
