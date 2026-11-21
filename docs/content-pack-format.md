# 内容包格式

内容包由 `manifest.json`、`pieces.json`、`segments.json`、`senses.json` 和 `cards.json` 组成。

- `manifest.json` 保存内容包 ID、版本和词条数量。
- `pieces.json` 保存诗词和文言文篇目、作者、教材位置和来源标签。
- `segments.json` 保存句段、顺序和篇目 ID。
- `senses.json` 保存具体义项、例句、出处、来源标签和词条编号。
- `cards.json` 保存卡片类型、提示、答案和预计用时。

卡片 ID 使用内容版本和稳定内容键生成。文本修订需要产生新版本并提供迁移映射，历史复习事件继续保留。
