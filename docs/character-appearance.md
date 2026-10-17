# 职业外观服务端约束

职业外观只改变显示，不能改真实职业、技能、装备资格或实际骑乘状态。产品规则和跨仓库映射统一见根仓库[职业外观](../../../docs/development/character-appearance/README.md)，不在服务端复制第二套职业清单。

## 实现入口

- `src/map/game_control_appearance.cpp`：独立 `characterAppearance` 快照、`character.appearance.update` 校验、保存及重校验；不依附骑乘业务。
- `HappyRO_CharacterAppearance`：角色变量保存选择，0 为默认；不增加迁移 SQL，不读取旧命令或旧变量。
- 权威源为根仓库 `config/character-appearance.json`；服务端生成白名单与 Client、Admin 同步，不能只扩大数字范围。
- 真实职业、阶段及性别决定资格。转职、改性别、登录变量加载后清理不适用保存值；缺少对应骑乘形态只是显示回退，不能清空选择。

## 协议与部署

固定 PACKETVER=20211103。地图通知 `0x0d08` 与选角通知 `0x0d09` 均为 8 字节：uint16 包号、uint32 标识、uint16 外观。地图使用 actor ID，选角使用角色 ID。配套更新客户端、char/map 服务及 Admin 白名单后验收。

人物服装与对应坐骑属于同一个外观选项；普通职业只换人物。缺少对应特殊形态时显示真实职业完整形态，解除后恢复保存选择。具体优先级由客户端解析，服务端仍是资格、状态及保存的权威。

## 验证

生成校验和矩阵工具见根仓库[工具说明](../../../tools/character-appearance/README.md)。检查未知 ID、跨分支、越阶段、性别、忙碌状态拒绝与保存值清理；游戏中检查本人／旁观者、正常重登及选角同步。历史矩阵和真实设备待办见[验收结论](../../../docs/development/character-appearance/progress.md)，源码检查不能代替当前发布包验收。
