import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const plain = args.includes('--no-color');
const options = args.filter(arg => arg !== '--no-color');
if (!options.length || options[0] === '--help') {
  const color = (code, text) => plain ? text : `\x1b[${code}m${text}\x1b[0m`;
  console.log(`\n${color('1;36', 'HappyRO item announcement regression')}\n\n${color('1;33', 'Usage')}\n  ${color('1;32', 'node tests/item-announcement.test.mjs <artifact-path>')} [--no-color]\n\n${color('1;33', 'Example')}\n  ${color('36', 'node tests/item-announcement.test.mjs ../../work/diagnostics/item-announcement-test')}\n`);
} else {
  if (options.length !== 1 || options[0].startsWith('-')) throw new Error('Expected one artifact path');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const read = file => readFileSync(resolve(root, file), 'utf8');
  function extract(file, start, end) {
    const source = read(file);
    const begin = source.indexOf(start), finish = source.indexOf(end, begin);
    if (begin < 0 || finish < 0) throw new Error(`Cannot locate ${start}`);
    return source.slice(begin, finish);
  }
  const stringBuffer = extract('src/common/strlib.hpp', 'struct StringBuf\n', '#endif');
  const stringBufferCode = extract('src/common/strlib.cpp', 'void _StringBuf_Init(', '/// Appends the contents of another StringBuf')
    + extract('src/common/strlib.cpp', 'int32 StringBuf_Length(', '// Frees a StringBuf returned');
  const drop = extract('src/map/mob.cpp', '//A Rare Drop Global Announce by Lupus', '// Announce first,');
  const mvp = extract('src/map/mob.cpp', '//A Rare MVP Drop Global Announce by Lupus', 'mob_setdropitem_option( item, entry );');
  const steal = extract('src/map/pc.cpp', '//A Rare Steal Global Announce by Lupus', '\n\treturn true;');
  const formats = ['conf/msg_conf/map_msg.conf', 'conf/msg_conf/map_msg_spn.conf'].map(file => {
    const source = read(file);
    return [541, 542].map(id => source.match(new RegExp(`^${id}: (.*)$`, 'm'))[1].trim());
  });
  const code = `
#include <cassert>
#include <cstdarg>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <string>
using int32 = int32_t;
#define ALC_MARK __FILE__, __LINE__, __func__
#define aMalloc2(n, ...) std::malloc(n)
#define aRealloc2(p, n, ...) std::realloc(p, n)
#define aFree(p) std::free(p)
${stringBuffer}
${stringBufferCode}
struct item_data { std::string ename; } item;
struct Player { struct { char name[24]; } status; } player;
struct MonsterDB { std::string jname; } monsterDB;
struct Monster { char name[24]; MonsterDB* db = &monsterDB; } monster;
struct Drop { int rate = 1; } reward;
struct { int rare_drop_announce = 10000; } battle_config;
constexpr int BC_DEFAULT = 0;
std::string actual;
const char* won_format;
const char* stole_format;
const char* msg_txt(Player*, int id) { return id == 541 ? won_format : stole_format; }
item_data* itemdb_search(int) { return &item; }
void intif_broadcast(const char* text, size_t length, int) {
  assert(length == std::strlen(text) + 1);
  actual.assign(text, length - 1);
}
void normal_drop() {
  auto first_sd = &player; auto md = &monster; auto it = &item; auto entry = &reward;
  int drop_rate = 1;
  ${drop}
}
void mvp_drop() {
  auto mvp_sd = &player; auto md = &monster; auto i_data = &item;
  int temp = 1;
  ${mvp}
}
void steal_drop() {
  auto sd = &player; auto md = &monster; auto drop = &reward; int itemid = 4674;
  ${steal}
}
int main() {
  std::strcpy(player.status.name, "测试玩家名字长ab");
  std::strcpy(monster.name, "暗十切艾勒梅斯");
  monsterDB.jname = monster.name;
  const char* formats[][2] = {${formats.map(pair => `{${pair.map(value => JSON.stringify(value)).join(',')}}`).join(',')}};
  for (const auto& name : {std::string("闇·十字切割者 艾勒梅斯卡片"), std::string(1600, 'x') + "测试😀物品"}) {
    item.ename = name;
    for (const auto& format : formats) {
      won_format = format[0]; stole_format = format[1];
      for (auto run : {normal_drop, mvp_drop, steal_drop}) {
        char expected[4096];
        int length = std::snprintf(expected, sizeof(expected), run == steal_drop ? stole_format : won_format,
          player.status.name, monster.name, item.ename.c_str(), 0.01);
        assert(length > 0 && size_t(length) < sizeof(expected));
        actual.clear(); run();
        assert(actual == expected);
      }
    }
  }
  // A disabled rare-drop announcement must still send nothing.
  battle_config.rare_drop_announce = 0;
  for (auto run : {normal_drop, mvp_drop, steal_drop}) { actual.clear(); run(); assert(actual.empty()); }
  std::cout << "PASS ordinary, MVP and steal announcements preserve complete UTF-8 names\\n";
}
`;
  const output = resolve(options[0]);
  const build = spawnSync('c++', ['-std=c++17', '-O1', '-fsanitize=address,undefined', '-x', 'c++', '-', '-o', output], { input: code, stdio: ['pipe', 'inherit', 'inherit'] });
  if (build.status !== 0) process.exit(build.status || 1);
  const run = spawnSync(output, [], { stdio: 'inherit' });
  process.exit(run.status || (run.signal ? 1 : 0));
}
