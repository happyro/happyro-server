# HappyRO 配置

本机绑定地址由根仓库 `deploy/rathena/profile.env` 经 `make configure-server` 写入 `conf/import/`。后读取的同名键覆盖先读取的值。

关键约束：

- `PACKETVER=20211103`
- 关闭封包混淆，与客户端 `packetKeys: false` 一致
- 角色名允许中文（`char_name_option: 0`）
- PIN 码关闭
- web-server 允许来源与 Gateway `http://localhost:3338` 对齐

NPC、db 和消息中的玩家可见中文直接改本仓库。生成 NPC 目录时以 `npc/**/*.txt` 为存在性权威。
