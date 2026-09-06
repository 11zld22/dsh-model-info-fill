# 模型信息补全（dsh-model-info-fill）

从 [models.dev](https://models.dev) 按模型名补全 DeepSeek Harness 自定义供应商里缺失的：

- 上下文窗口 `contextWindow`
- 输出上限 `maxTokens`
- 思考档位 `reasoningEfforts`
- 图片声明 `input`（仅文档标明视觉时加 `image`）

文档没有对应条目时写入 DSH 默认值。已经手填的字段不会被覆盖。

不会根据 models.dev 创建供应商路由（没有 Base URL / API Key）。百科只做查找表。

## 行为

设置 → 模型 页底部会出现与 HyperSwitch 类似的一行：

> 从 models.dev 拉取上下文、输出上限、思考与模态预设。{时间} · {N} 个模型

- **更新**：重新拉取 `https://models.dev/api.json`，缓存到 `~/.dsh/models-dev.json`
- **自动补全**：保存 `llm-pi-ai` 自定义模型时，只补 `undefined` / 非法容量 / 空 `input`
- **补全全部缺失** / 卡片上的 **补全缺失字段**：手动跑一遍

匹配顺序（大小写不敏感）：精确 id → 去掉 `provider/` 前缀 → catalog 尾巴反查。

| 字段 | catalog 命中 | catalog 未命中 |
|---|---|---|
| `name` | 文档显示名（仅当本地为空） | 不编造 |
| `contextWindow` | `limit.context` | `262144` |
| `maxTokens` | `limit.output` | `32768` |
| `input` | 含 image → `[text, image]`，否则 `[text]` | `[text]` |
| `reasoningEfforts` | 有 effort 档则写入；`reasoning: true` 无档则 `off/minimal/low/medium/high`；明确无思考 → `false` | `{ off: null, low: low, medium: medium, high: high }` |

只处理 `llm-pi-ai.providers.*.models[]`。不碰官方 DeepSeek 路由，不改 `compat` / `headers` / `api` / `baseURL`。

未保存的「添加提供方」草稿卡还没有目录行，保存之后才由 Host 监听补全。

## 安装

```sh
dsh plugin --profile web add github:11zld22/dsh-model-info-fill
```

本地目录也可以：

```sh
dsh plugin --profile web add /path/to/dsh-model-info-fill
```

安装后重启 DSH Web。

## 数据

| 路径 | 内容 |
|---|---|
| `~/.dsh/models-dev.json` | 百科缓存 + `autoFill` |
| `~/.dsh/settings.yaml` 的 `llm-pi-ai` | 被补全的模型字段 |

`DSH_HOME` 存在时，缓存写到 `$DSH_HOME/models-dev.json`。

无缓存或超过 7 天会在启动后后台刷新。拉取失败则沿用旧缓存；没有缓存时补全走默认值，不阻断保存。

## 测试

```sh
npm test
```
