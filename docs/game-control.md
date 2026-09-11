# Game Control

Game Control 让 Admin 和冒险工具向 map-server 发送已授权命令。web-server 只做认证、能力发现和转发，不模拟地图内存，也不用 SQL 代替运行时命令。

启用时必须同时配置：

- web-server：`game_control_enabled: yes`
- 不少于 32 字节的 `game_control_secret`
- map-server 与 web-server 相同的 Unix Socket 路径

未启用时保持 `game_control_enabled: no`，Socket 为空。Socket 默认权限 `0660`，运行 Admin 的用户必须能访问服务组。

部署验收见 [deploy/README.md](../deploy/README.md)。产品约束见 Admin `docs/product/features/game-control.md`。
