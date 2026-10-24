# 服务端文档

| 主题 | 入口 |
| --- | --- |
| 开发与部署 | [配置](happyro-configuration.md)、[地图服环境变量](battle-environment.md)、[构建与测试](build-and-test.md)、[systemd 模板](../deploy/README.md) |
| 游戏控制 | [Game Control](game-control.md)、[职业外观](character-appearance.md)、[传送落点](navigation-arrivals.md) |
| 社交与随行 | [好友详情、宠物、生命体与佣兵](social-and-companions.md) |
| 会话与协议 | [保持登录](game-sessions.md)、[摇杆停步](joystick-movement.md)、[NPC 完整名称](npc-name-protocol.md) |
| 上游参考 | [脚本、数据库及协议](../doc/README.md) |

`docs/` 维护 HappyRO 扩展；`doc/` 是与源码配套的 rAthena 参考，不与自有产品文档合并。传送落点 JSON 来源清单仍被测试读取，不能作为过期报告删除。全栈安装与发布由 [HappyRO 根仓库](https://github.com/happyro/happyro)编排。

## 自动战斗的权威边界

技能选择、增益维持、自动恢复和请求退避由 Client 调度；Server 继续校验技能目标、材料、AP、HP、状态、装备、冷却及地图规则。客户端预检不替代权威校验，也不增加服务端托管战斗或离线挂机。技能数据库、状态或伤害载体变化后，同步检查客户端能力规则和属性资料生成器，具体入口见[客户端战斗实现](../../happyro-client/docs/gameplay/combat.md)。

## 发布与变更记录

本仓库随 HappyRO 统一版本交付，目标版本读取根仓库 `deploy/docker/VERSION`。历史交付摘要见[版本摘要](../../../changelog/releases/v0.5.0.md)，本仓库原始变化见 [changelog](../changelog/)。镜像构建与最终包验收按根仓库[发布流程](../../../docs/operations/docker-release.md)执行。
