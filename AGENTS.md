# HappyRO 代理说明

本仓库属于仅限局域网运行的 HappyRO Web 栈。

## Git 规则

- HappyRO 自有提交必须使用 type(scope): subject 格式。
- scope 必须存在，使用小写英文；破坏性变更使用 type(scope)!: subject，并在正文说明迁移方式。
- 允许的 type：feat、fix、config、docs、refactor、test、build、ci、chore、perf、style、revert。
- subject 使用祈使语气的英文，不以句号结尾，首行总长度不超过 72 个字符。
- 一个提交只包含一个逻辑变更；上游合并提交和上游作者提交不受此限制。
- lang/zh-cn 是长期中文产品分支；语言分支不合并回 main。
- 三个仓库只推送到各自的 origin，不推送到 upstream。
- 未经用户明确要求，不提交、不推送。
