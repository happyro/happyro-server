# HappyRO 配置

本机绑定地址由根仓库 `deploy/rathena/profile.env` 经 `make configure-server` 写入 `conf/import/`。文件内后读取的同名键覆盖先读取的值；地图服非空环境变量在全部 import 之后覆盖对应配置。范围、优先级及后台冲突处理见[地图服环境变量](battle-environment.md)。

关键约束：

- `PACKETVER=20211103`
- 关闭封包混淆，与客户端 `packetKeys: false` 一致
- 角色名允许中文（`char_name_option: 0`）
- PIN 码关闭
- web-server 允许来源与实际 HAPPYRO_GAME_PUBLIC_URL / Gateway 入口一致，原生模板为 `http://127.0.0.1:3338`

## 新建角色出生

`HAPPYRO_CHARACTER_START_MODE` 默认为 `classic`，新建人类角色出生与初始保存点为 `new_1-1,53,107`；`ship` 使用 `iz_int,18,26`。空值及其他值使角色服启动失败。变量由 char-server 启动时读取，只影响之后新建的人类角色；杜兰沿用独立出生配置。当前策略实现位于 `src/char/new_player_start.hpp`，完整流程见[经典初心者说明](../../../docs/development/classic-novice/README.md)。

NPC、db 和消息中的玩家可见中文直接改本仓库。生成 NPC 目录时以 `npc/**/*.txt` 为存在性权威。

## 魔物显示名与内部标识

中文名称修改以 ID／AegisName 和已审来源为准。`mob_db.yml` 的 Name、存在的 JapaneseName、魔物型佣兵与脚本刷怪标签分别核对，保留内部 ID、事件身份、剧情专名及战斗数值。固定封包可能只容纳 UTF-8 短标签，客户端通过当前 ID 和默认短名恢复完整中文；不能直接扩大封包或全局替换字符串。

根仓库[魔物审查记录](../../../docs/localization/monster-name-scans/application/README.md)保存来源及例外；`python3 -m tools.localization.monsters.verify_application verify --no-color` 从根仓库复核。任务说明还需要核对 `db/re/quest_db.yml` 的实际目标，避免不同魔物的旧译名碰撞。
