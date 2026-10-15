# Game Control

Game Control 让 Admin 和冒险工具向 map-server 发送已授权命令。web-server 只做认证、能力发现和转发，不模拟地图内存，也不用 SQL 代替运行时命令。

启用时必须同时配置：

- web-server：`game_control_enabled: yes`
- 不少于 32 字节的 `game_control_secret`
- map-server 与 web-server 相同的 Unix Socket 路径

未启用时保持 `game_control_enabled: no`，Socket 为空。Socket 默认权限 `0660`，web-server 运行用户必须能访问 map-server 的 Socket；Admin 经 HTTP 调用 web-server，不直接连接 Socket。

部署验收见 [deploy/README.md](../deploy/README.md)。产品约束见 Admin `docs/product/game-control.md`。

## 骑乘与随行

`character.snapshot` 返回 `riding` 列表，按当前职业列出 `cart`、`peco`、`dragon`、`gryphon`、`mado`，包含 `active`、`fee`、`ticket`、`reason`。`character.riding.update` 接收 `kind`、布尔 `enabled`、整数 `fee` 和布尔 `ticket`，报价必须与当前快照一致。

该操作沿用冒险工具角色维护权限。map-server 在地图线程中校验职业、必要技能、存活及对话／交易／仓库／摆摊状态、坐骑冲突和余额，随后扣费并更新原生骑乘状态。使用既有 Game Control 通道，PACKETVER 不变。手推车、机甲相互独立；卸下手推车保留其物品。

租金以普隆德拉 NPC 为准：商人系手推车 800 Zeny（可消耗物品 7061 免费券，正常支付时增加 48 卡普拉积分），机匠系手推车免费；骑士系大嘴鸟 2,500 Zeny、十字军系 3,500 Zeny；龙、狮鹫、机甲免费。规则来源为 `npc/kafras/{kafras,functions_kafras}.txt`、`npc/merchants/renters.txt`、`npc/re/merchants/renters.txt`，变更这些租用规则时须同步核对 `game_control_riding.cpp`。
