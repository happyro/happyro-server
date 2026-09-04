# 物理部署

本目录提供 HappyRO 四个 rAthena 服务的 systemd 模板。模板默认使用仓库根目录作为工作目录，并假定四个可执行文件位于同一目录：

- `login-server`
- `char-server`
- `map-server`
- `web-server`

## 安装前检查

1. 创建专用运行用户和组（示例为 `happyro`），并确保其可以读取仓库、`conf/`、`db/` 和运行时资源。运行后台 Laravel 的用户必须加入 `happyro` 服务组，才能访问 Game Control Socket；admin 仓库的 systemd 模板已通过 `SupplementaryGroups=happyro` 声明这一关系。
2. 修改模板中的 `User`、`Group`、`WorkingDirectory` 和 `ExecStart` 为实际绝对路径。
3. 核对 `conf/` 及 `conf/import/` 的最终配置。后读取的同名键会覆盖先读取的值。
4. Game Control 未启用时保持 `game_control_enabled: no`，并保持 `game_control_socket` 为空；启用时必须同时配置有效的绝对 Socket 路径，否则 web-server 会在启动时拒绝配置。

## 安装与启动

将模板复制到 `/etc/systemd/system/` 后执行：

```sh
systemctl daemon-reload
systemctl enable happyro-login-server.service happyro-char-server.service happyro-map-server.service happyro-web-server.service
systemctl start happyro-login-server.service
systemctl start happyro-char-server.service
systemctl start happyro-map-server.service
systemctl start happyro-web-server.service
```

启动顺序由 `Requires` 和 `After` 约束为 login -> char -> map -> web。map-server 的 `RuntimeDirectory=happyro` 会创建 `/run/happyro`，Unix Socket 必须配置在该目录下，例如 `/run/happyro/map-control.sock`。Socket 默认权限为 `0660`，目录和服务组必须允许后台用户访问。

## Game Control 验收

启用前必须同时为 web-server 设置不少于 32 字节的 `game_control_secret`、`game_control_enabled: yes`，并为 map-server 设置相同的 Socket 路径。先检查能力发现和配置回读，再在测试角色上执行维护和召唤命令；失败时停止 web/map 服务、删除 Socket，并恢复上一版二进制与配置。

## 停止与回滚

```sh
systemctl stop happyro-web-server.service happyro-map-server.service
systemctl stop happyro-char-server.service happyro-login-server.service
```

通过 `systemctl status`、`journalctl -u <unit>` 和端口/Socket 检查确认进程已退出后，才能替换二进制或配置。rAthena 会将工作目录切换到可执行文件所在目录，因此二进制和 `conf/`、`db/` 必须来自同一个部署根目录。
