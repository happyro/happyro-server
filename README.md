# HappyRO Server

HappyRO 的游戏服务端，基于 [rAthena](https://github.com/rathena/rathena)。本仓库提供 login、char、map 和 web-server，以及中文 NPC、数据库和 HappyRO 配置。

固定基线：`PACKETVER=20211103`、Renewal。必须与 Client 使用同一封包设置。

编排和本机启动在根仓库 [happyro](https://github.com/happyro/happyro)。不要把上游安装文档当作 HappyRO 默认路径。

## 文档

- [HappyRO 配置](docs/happyro-configuration.md)
- [Game Control](docs/game-control.md)
- [构建与测试](docs/build-and-test.md)
- [上游 rAthena](docs/upstream.md)
- 原始帮助文件仍在 [doc/](doc/)

## 本机入口

```bash
make configure-server
make build-server
make server-start
make server-verify
```

端口：login `6900`、char `6121`、map `5121`、web `8889`。浏览器不直连这些端口。

## 配置位置

HappyRO 覆盖在 `conf/import/`。物理部署的 systemd 模板在 `deploy/systemd/`，与根仓库 `make server-start` 使用的 transient units 不是同一套。
