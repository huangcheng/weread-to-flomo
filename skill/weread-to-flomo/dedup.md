# 去重机制

## 1. 核心思路

每条导出到 flomo 的 memo 末尾内嵌一行**稳定标记**：

- 划线：`[wr:hl:{bookmarkId}]`
- 想法：`[wr:tk:{reviewId}]`

下次运行时调 `memo_search` 找标记，命中即跳过该条。

---

## 2. 标记格式（硬约束）

| 项 | 值 |
|----|----|
| 前缀 | `[wr:` |
| 类型 | `hl`（highlight 划线）或 `tk`（think 想法） |
| 分隔 | `:` |
| 标识 | 原始 `bookmarkId` 或 `reviewId`，**不做任何变换**（不改大小写、不裁剪、不 URL-encode） |
| 结尾 | `]` |
| 位置 | memo 正文**最后一行**，前面恰好一个空行 |

完整示例：

```
[wr:hl:5a8d3f2e1234abcd]
[wr:tk:7c1b9a4e_review_id]
```

**禁止**：
- 把标记放到正文中间（不会影响搜索命中，但破坏 `format.md` §6 的输出顺序）
- 在 `]` 后追加任何字符（包括空白、换行后的内容）
- 同一条 memo 写两个标记
- 把 `bookmarkId` / `reviewId` 改大小写或截短

---

## 3. 探测调用（单条模式）

每条待导出条目，调一次：

```
tool: memo_search
arguments:
  keywords: "wr:hl:5a8d3f2e1234abcd"     # 不带方括号，直接 wr:类型:id
  limit: 5
```

> 不要把方括号 `[` `]` 放进 `keywords` —— flomo 搜索引擎对方括号的处理不可靠。`wr:hl:xxxx` 这个核心串就足以唯一定位。

判断命中：

⚠️ **flomo MCP 回包里 `content` 字段会自动 escape 部分 markdown 元字符**。实测 2026-05-16，写入 `[wr:hl:216211_14_2847-2872]` 的 memo，`memo_search` / `memo_batch_get` 等接口回包的 `content` 字段实际是 `\[wr:hl:216211\_14\_2847-2872\]`（`[`、`]`、`_` 前都加了反斜杠）。flomo 的 UI 渲染层会把这些反斜杠脱掉，用户看到的依旧是干净的 `[wr:hl:...]`，但**子串匹配必须在去 escape 后的字符串上做**，否则永远命中失败。

正确的判定步骤：

1. 取 `memo.content`
2. 把里面所有反斜杠去掉：`const normalized = memo.content.replace(/\\/g, '')`
3. 在 `normalized` 里查找完整字符串 `[wr:hl:5a8d3f2e1234abcd]`（含方括号、含完整 ID）
4. 任一条 memo 满足上述匹配即算命中

命中后：
- 不调 `memo_create`
- 把该条加入「已跳过」列表，最终汇报给用户

> **不要**仅用 `memo_search` 返回结果的 `relevance` 阈值判定命中。实测同一关键词下，无关 memo 也能拿到 0.5 的 relevance。relevance 仅用来排序，不可作为命中信号；必须做上述的去 escape 子串匹配。

---

## 4. 批量优化（单本/全部导出）

当一本书的待导出条目较多（>20 条）时，**先**用一个更宽的标签过滤搜索：

```
tool: memo_search
arguments:
  keywords: "wr:hl"
  tag: "微信读书/{清洗后书名}"
  limit: 200
```

然后对返回的 `content` 用正则抽出所有已存在 ID。**先做 §3 的去 escape 处理再跑正则**，否则 `[`/`]`/`_` 周围的反斜杠会让正则匹配失败：

```js
const normalized = memo.content.replace(/\\/g, '');
const re = /\[wr:(hl|tk):([^\]]+)\]/g;
for (const m of normalized.matchAll(re)) {
  existing.add(`${m[1]}:${m[2]}`);   // 例如 "hl:216211_14_2847-2872"
}
```

正则本身（去 escape 之后用）：

```regex
\[wr:(hl|tk):([^\]]+)\]
```

把抽到的 `(类型, id)` 二元组放入一个 `Set`。本地对每条待导出条目做集合检查，命中跳过，未命中加入「待写入」。这样把 N 次 `memo_search` 降到 1 次。

### 4.1 标签参数注意

`tag` 参数填**纯标签名**，不带前导 `#`，不带前导 `/`：

```
tag: "微信读书/{清洗后书名}"        # 正确
tag: "#微信读书/{清洗后书名}"       # ❌ 错：带 #
tag: "/微信读书/{清洗后书名}"       # ❌ 错：前导 /
```

### 4.2 limit 上限

flomo 单次 `memo_search` 上限取决于服务端。本文档约定 200 作为批量上限：

- 该本书已导出 ≤ 200 条 → 一次 `memo_search` 拿全
- 该本书已导出 > 200 条（罕见） → 退化为「逐条 `memo_search`」（即 §3 单条模式），不要拼凑分页

### 4.3 关键字与标签组合

`keywords: "wr:hl"` + `tag: "微信读书/{清洗后书名}"` 是「**同时**满足」的过滤（and），既限制类型前缀又限制书名标签。如果只想拿想法集合，把 `keywords` 换成 `wr:tk`。如果想一次拿到这本书的全部（划线 + 想法），把 `keywords` 留空或改成 `wr:`，仅靠标签过滤。

---

## 5. 与 `format.md` 的对接

- 写入新 memo 时，标记由 §2 的格式生成，按 `format.md` §6 放在 memo 末尾
- 探测时，从 weread 接口拿到的 `bookmarkId` / `reviewId` **直接**用于 `keywords` 与正则匹配，不要清洗

---

## 6. 边界与异常

| 场景 | 行为 |
|------|------|
| 用户在 flomo 里**手动删过**这条 memo | `memo_search` 找不到，本次会重新写入。这是预期 |
| 用户在 weread 里**删过**这条划线/想法 | 本次 `/book/bookmarklist` / `/review/list/mine` 不返回它；本 Skill 不会主动从 flomo 删除对应 memo（保守策略，避免误删）|
| 用户**人工**编辑过 flomo memo 末尾的标记 | 标记格式被破坏 → 本次探测找不到 → 重新写入。需要在汇报里提示「flomo 中已存在 X 条但末尾标记不规范，本次按未导出处理」时不强制做（v0.1 不做检测） |
| 同一 ID 被错误地写入两次 | 本不应发生（先探测再写）。如真出现，向用户报告但**不要**自动清理 |
| `memo_search` 返回 5xx / 网络错误 | 等 2 秒退避重试一次；仍失败则**保守地视为未命中**（宁可重复写也不丢条目）并在汇报里附 warning |
| `bookmarkId` / `reviewId` 含特殊字符 | weread 实际不会返回方括号、`#` 等 flomo 标签禁止字符，但极端情况下可以让 `memo_search` 走 §3 单条模式（`keywords` 是字符串匹配，不是正则） |

---

## 7. 自检清单（探测前/写入前）

- [ ] 探测调用的 `keywords` 没有方括号？
- [ ] 命中判定**先做** `content.replace(/\\/g, '')` 去 escape，再做子串匹配？（flomo 回包会自动 escape `[`/`]`/`_`）
- [ ] 命中判断检查的是完整字符串 `[wr:hl:...]`（含方括号），不是子串 `wr:hl:...`？
- [ ] 没有用 `relevance` 阈值代替子串匹配？（relevance 不可靠）
- [ ] 批量优化里的 `tag` 参数没有前导 `#` 或 `/`？
- [ ] 批量优化里的正则在去 escape 后的字符串上跑？
- [ ] 写入时生成的标记格式严格匹配 `[wr:(hl|tk):{原 ID}]`？
- [ ] 标记是 memo 的最后一行，前面恰好一个空行？
