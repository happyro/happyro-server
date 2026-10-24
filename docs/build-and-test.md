# 构建与测试

以下在 HappyRO 根仓库执行；server-verify 需要已有服务运行：

```bash
make build-server
make server-verify
```

服务间重连逻辑的回归测试（在服务端仓库执行）：

```bash
node tests/interserver-reconnect.test.mjs ../../work/diagnostics/interserver-reconnect-test
```

测试编译实际配置与重连函数，使用受控 DNS 和连接结果验证启动解析失败、地址变化、解析恢复及正常连接不被打断，并启用 AddressSanitizer／UndefinedBehaviorSanitizer。此测试不替代 Docker 部署验收：更新镜像后，还应在隔离环境保持下游服务运行，重建上游并确认 IP 改变，验证内部认证、地图注册及登录进图自动恢复。

修改自定义封包、Game Control 或 NPC 脚本后，还需要：

- Client 封包注册与长度一致；
- 检查 NPC 目录是否与源码一致；需要更新时使用同入口的 generate 子命令（根仓库 `node tools/resources/world/generate-npc-catalog.mjs check --no-color`）；
- 在真实 map-server 上验证传送、召唤或发放。

上游 `doc/` 中的脚本命令和数据库格式说明仍然有效，但安装步骤以根仓库开发文档为准。

## 构建产物与实际运行程序

上述 `make server-start`／`server-verify` 使用 Linux systemd；macOS 按根仓库[服务说明](../../../docs/operations/services.md)检查 launchd 的 `Program` 和工作目录。CMake 产物通常写在本仓库根目录，而已配置的 macOS 服务可能运行 `work/runtime/native/bin/` 的安装副本。

C++ 或公共头文件变化后先完成构建；停止对应进程，备份并安装新程序，核对 SHA-256，再启动并检查本次日志中的监听、数据库连接及 login → char → map 互联。公共代码变化检查全部四个游戏程序。仅重启旧安装副本不会更新代码。

魔物数据库、佣兵名、刷怪或任务脚本文本变化通常无需重新编译 C++，但须重载对应数据或重启地图服。涉及客户端名称表、任务 LUB、NPC／魔物目录时同时更新这些消费者；单独重启地图服不能刷新浏览器静态资源或后台目录。
