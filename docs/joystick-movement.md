# 摇杆松手停止

`PACKETVER=20211103` 下，HappyRO Client 在移动端摇杆释放或触摸取消时发送 `CZ_HAPPYRO_STOP_MOVE`（`0xd03`）。封包仅包含 2 字节小端包头，不携带坐标；客户端与服务端须配套部署，先更新服务端再更新客户端。

服务端调用 `unit_stop_walking_soon`，沿已有行走路线在接下来的约 0.5—1.5 格内停止；最后一格直接继续到原终点。路线缩短时，向附近玩家广播移动，并通过 `clif_walkok` 更新本人终点。重复停止请求不会重复确认同一条短路线，已有的下一格转向请求也会被清除。

死亡、没有正在行走、强制行走、冲刺以及带技能／追击目标的移动不处理此请求。此请求不取消受击硬直期间尚未开始的延迟移动。停止仍受网络延迟、移动速度和格子步进影响，不是瞬间定格；不以客户端坐标硬停，避免位置回退。

可在根仓库已有的 `work/diagnostics/` 下输出测试产物：

```bash
node tests/joystick-stop.test.mjs ../../work/diagnostics/joystick-stop-test --no-color
```

回归测试编译实际停止处理代码，覆盖格子前后半段、转向、重复请求、最后一格与受保护动作，并启用 AddressSanitizer 和 UndefinedBehaviorSanitizer。移动端浏览器验收应同时记录持续行走和释放后位置，确认没有多余移动请求或反向位移。
