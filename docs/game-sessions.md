# 游戏登录会话

客户端与 Gateway 配套提供“保持登录”和断线原角色恢复。标准包版本仍为 `20211103`，新增登录包 `0x0d05`：91 字节，包括包号、24 字节账号名、64 字节十六进制单次票据与 1 字节 clienttype。

## 安装与升级

在 HappyRO 主数据库执行 `sql-files/upgrades/upgrade_20261012_sessions.sql`，再启动更新后的 login-server、web-server、Gateway 和客户端。SQL 可重复执行，面向 HappyRO 默认 `login` 表；使用自定义账号表的部署须相应修改触发器目标。

根仓库数据库初始化脚本及 `tools/deployment/manage.py deploy` 已接入；保留旧数据库时也会执行，失败不启动后续游戏服务。直接手工启动服务的部署应先执行 SQL。无需修改 PACKETVER，也不修改角色／物品表。

## 会话生命周期

Gateway 生成 32 字节密码学随机凭据和票据。Web 服务只存 SHA-256 摘要；会话最长 30 天，单次票据 30 秒。create 需要账号及当前启用的 WebToken，resume 需要会话凭据，revoke 删除当前会话。

- `POST /session/create`：校验账号、WebToken、状态与有效期，建立会话；同浏览器旧凭据被撤销。
- `POST /session/resume`：原子轮换会话凭据，重新校验密码摘要和账号限制，并签发单次票据。
- `POST /session/revoke`：撤销当前凭据及其未消费票据。

公网浏览器通过 Gateway 的 `/api/game-session/` 接入，Cookie 不传给普通游戏资源。Gateway 校验来源、限制 JSON 请求大小、禁止缓存；Web 服务会话路由不记录请求／响应明细。

登录服务原子消费票据，再执行正常的账号、客户端、服务器及 PIN 流程。发现已有在线角色或待选角认证时返回拒绝，不主动踢人；客户端有限重试，仍失败则交还用户处理。普通密码登录保持既有规则。

数据库触发器在密码、账号状态、封禁或账号有效期变化时撤销会话，因此改回原密码或解除封禁不会恢复旧会话。服务重启保留会话表，但普通一次性 AuthCode 仍不可复用。

HTTP 按产品要求同样支持持久 Cookie；HTTPS 使用独立名称并启用 Secure。页面会话凭据只留在客户端内存，刷新后丢弃。游戏状态始终以服务端为准，不保存或重放客户端操作队列。

## 验证

编译 login-server、web-server。真实本地联调：

```sh
node tests/session-live.test.mjs --run --no-color
```

该测试需要 Gateway 3338、Login 6900、Web 服务及 `happyro-mariadb` 容器；仅创建并删除专用测试账号，覆盖 HTTP Cookie、轮换、票据重放拒绝、撤销、密码修改再改回、封禁再解封和过期。无参数只显示帮助。

客户端另覆盖三端登录 UI、恢复状态机、PIN 顺序、原角色与镜头恢复，浏览器检查 HTTP/HTTPS、关闭后再打开与退出。真机系统后台冻结和系统回收页面仍应单独验收。
