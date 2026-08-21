# HappyRO rAthena 服务端代理说明

本仓库是 HappyRO 的 rAthena 服务端仓库。保持与上游兼容，并确保仅限局域网运行的 Web 栈可复现。

## Git 规则

- HappyRO 自有提交必须使用 `type(scope): subject` 格式。
- `scope` 必须存在，使用小写英文；破坏性变更使用 `type(scope)!: subject` 并说明迁移方式。
- 允许的类型：`feat`、`fix`、`config`、`docs`、`refactor`、`test`、`build`、`ci`、`chore`、`perf`、`style`、`revert`。
- subject 使用祈使语气的英文，不以句号结尾，首行不超过 72 个字符。
- 一个提交只包含一个逻辑变更；上游合并提交和上游作者提交不受此限制。
- 只推送到本仓库的 `origin`，不推送到 `upstream`；未经用户明确要求不提交、不推送。

## 服务端不变量

- 保持 `PACKETVER=20211103`、Renewal、封包混淆，以及与 roBrowserLegacy 客户端一致的配置。
- 密钥、生成配置、编译产物、数据库数据、日志和运行时文件不得提交。
- 数据库结构变更必须配套兼容的 SQL 迁移或 import 处理。

## 风格与验收

- 遵守 `.editorconfig`、`.gitattributes`、C++ 风格、YAML 间距和 NPC 脚本缩进。
