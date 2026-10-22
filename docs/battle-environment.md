# 地图服环境变量

地图服直接读取以下进程环境变量，原生服务与 Docker 使用相同实现。

| 环境变量 | battle 配置 | 默认值 | 环境变量允许范围 |
| --- | --- | --- | --- |
| `HAPPYRO_AREA_SIZE` | `area_size` | 18 格 | 5–50，十进制整数 |
| `HAPPYRO_MAX_WALK_PATH` | `max_walk_path` | 17 格 | 1–32，十进制整数 |

未设置或空值保留 battle 配置文件的值；非空变量在全部 import 读取完成后覆盖文件配置，随后执行既有配置调整。环境变量拒绝负数、小数、符号、空白、布尔值、溢出和越界值；错误会明确打印变量名并终止地图服。

默认视野同时在 `conf/battle/client.conf` 与内置配置表中设为 18。优先级为：非空环境变量 > battle 配置文件（包括导入文件）> 内置默认值。已有导入配置显式设置为 14 时，应移除该覆盖或设置 `HAPPYRO_AREA_SIZE=18`。

更改进程环境变量需要重启地图服（Docker 需要重新创建 map 容器）。重载 battle 配置会重新应用当前进程的环境变量，因此管理后台对同名文件配置的修改不能覆盖非空环境变量。GM `@setbattleflag` 仍是临时运行时修改，下次配置重载或进程重启重新按上述优先级取值。

systemd 可通过 `systemctl edit happyro-map-server` 设置：

```ini
[Service]
Environment=HAPPYRO_AREA_SIZE=18
Environment=HAPPYRO_MAX_WALK_PATH=17
```

视野还参与怪物活跃 AI、事件广播及部分跟随逻辑。环境变量范围是输入校验范围，不是性能保证。提高视野不会自动提高寻怪范围或行走上限；绕障碍后的路径仍可能超过单次行走上限。客户端寻怪与活动范围由 Gateway 的 `CLIENT_AUTO_COMBAT_SEARCH_RANGE` 和 `CLIENT_AUTO_COMBAT_ACTIVITY_RANGE` 独立提供。

### 玩法与工具权限环境变量

以下 10 项是新增的地图服进程变量。未设置或留空时保留当前 battle 文件和后台管理方式；非空值在配置导入后覆盖文件。均使用十进制整数，布尔项填 `0` / `1`，不接受 `true` / `false`。

| 环境变量 | 用途 | 当前默认 | 允许范围 |
| --- | --- | --- | --- |
| `HAPPYRO_NAVIGATION_TELEPORT_POLICY` | 导航传送权限 | `2` | 0–2 |
| `HAPPYRO_NAVIGATION_TELEPORT_CROSS_MAP` | 导航跨地图传送 | `1` | 0–1 |
| `HAPPYRO_NAVIGATION_TELEPORT_COOLDOWN` | 导航传送冷却（秒） | `1` | 0–3600 |
| `HAPPYRO_GAME_TOOLS_MONSTER_SPAWN_POLICY` | 图鉴召怪权限 | `2` | 0–2 |
| `HAPPYRO_GAME_TOOLS_MONSTER_SPAWN_COOLDOWN` | 召怪冷却（秒） | `1` | 0–3600 |
| `HAPPYRO_GAME_TOOLS_MONSTER_SPAWN_DURATION` | 召怪存活时间（秒） | `600` | 1–3600 |
| `HAPPYRO_GAME_TOOLS_MONSTER_SPAWN_ALLOW_BOSS` | 允许召唤 Boss / MVP | `1` | 0–1 |
| `HAPPYRO_GAME_TOOLS_CHARACTER_MAINTENANCE_POLICY` | 角色维护权限 | `2` | 1–2 |
| `HAPPYRO_GAME_TOOLS_GAME_SETTINGS_POLICY` | 游戏设置工具权限 | `2` | 1–2 |
| `HAPPYRO_GAME_TOOLS_ITEM_GRANT_POLICY` | 物品发放权限 | `2` | 1–2 |

权限值：`0` 关闭（仅支持范围含 0 的项目）、`1` 仅管理员、`2` 所有玩家。角色维护、游戏设置及物品发放仅支持 1 / 2，不支持 0。默认值沿用当前配置，本次没有改变功能开放范围。

非空环境变量控制的项目，在后台或游戏内设置提交时会被 API 明确拒绝，提示具体环境变量名；检查发生在写入配置文件之前，整批请求均不执行。地图服控制接口也会在修改前拒绝含受控项的整批请求。当前表单仍可输入，限制在提交时反馈。需要恢复后台管理时清空对应变量，并重新创建地图服容器或重启原生地图服。

新增功能需同时更新地图服与 API；旧镜像不会因加入变量自动获得支持。更新后的 Docker Compose 已映射这些变量，调整值只需重新创建地图服容器，无须再次构建镜像。API 从地图服读取覆盖状态，不需要复制这些变量到 API 环境。

示例：保持普通玩家可以导航，限制召怪和发放为管理员操作：

```dotenv
HAPPYRO_NAVIGATION_TELEPORT_POLICY=2
HAPPYRO_NAVIGATION_TELEPORT_CROSS_MAP=1
HAPPYRO_NAVIGATION_TELEPORT_COOLDOWN=1
HAPPYRO_GAME_TOOLS_MONSTER_SPAWN_POLICY=1
HAPPYRO_GAME_TOOLS_ITEM_GRANT_POLICY=1
```

这些项目沿用地图服原有 GM 临时命令行为；GM 临时改值不等于改写部署配置，下次 battle 重载或进程重启会重新应用环境变量。经验、掉落、精炼、死亡惩罚等候选项本轮未新增环境变量，继续使用原有配置和已开放的后台入口。
