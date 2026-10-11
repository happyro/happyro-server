# HappyRO Server

HappyRO 的游戏服务端，基于 [rAthena](https://github.com/rathena/rathena)。本仓库提供 login、char、map 和 web-server，以及中文 NPC、数据库和 HappyRO 配置。

固定基线：`PACKETVER=20211103`、Renewal。必须与 Client 使用同一封包设置。

编排和本机启动在根仓库 [happyro](https://github.com/happyro/happyro)。不要把上游安装文档当作 HappyRO 默认路径。

## 文档

- [文档索引](docs/README.md)：配置、构建、协议、Game Control 与落点维护。
- [脚本与数据参考](doc/README.md)：与当前源码配套的 rAthena 资料。

## 本机入口

以下命令从 HappyRO 根仓库执行：

```bash
make configure-server
make build-server
make server-start
make server-verify
```

端口：login `6900`、char `6121`、map `5121`、web `8889`。浏览器不直连这些端口。

## 配置位置

HappyRO 覆盖在 `conf/import/`。物理部署的 systemd 模板在 `deploy/systemd/`，与根仓库 `make server-start` 使用的 transient units 不是同一套。
