# 构建与测试

HappyRO 本机编译使用根仓库：

```bash
make build-server
make server-verify
```

修改自定义封包、Game Control 或 NPC 脚本后，还需要：

- Client 封包注册与长度一致；
- 重新生成 NPC 目录（根仓库 `node tools/generate-npc-catalog.mjs`）；
- 在真实 map-server 上验证传送、召唤或发放。

上游 `doc/` 中的脚本命令和数据库格式说明仍然有效，但安装步骤以根仓库开发文档为准。
