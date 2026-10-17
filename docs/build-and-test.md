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
