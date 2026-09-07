# 模型信息补全（dsh-model-info-fill）

DeepSeek Harness 插件。给自定义供应商里的模型，按名字从 [models.dev](https://models.dev) 补全缺失字段：

- 上下文窗口 `contextWindow`
- 输出上限 `maxTokens`
- 思考档位 `reasoningEfforts`
- 图片声明 `input`

百科里没有的模型会套你设的默认值；已经手填过的字段不会覆盖。

不会根据 models.dev 创建供应商（没有 Base URL / API Key）。百科只用来查模型能力。

## 安装

```sh
dsh plugin --profile web add github:11zld22/dsh-model-info-fill
```

装完重启 DSH Web。打开 **设置 → 模型** 即可使用。

## 怎么用

底部「模型信息补全」一行会显示百科同步时间和模型数量。

| 操作 | 作用 |
|---|---|
| **更新** | 重新拉取 models.dev |
| **自动补全** | 保存自定义模型时，自动补缺失字段 |
| **补全全部缺失** | 立刻给当前所有自定义模型补一遍 |
| **未匹配 N** | 展开：改默认值，并手改百科对不上的模型 |

每个自定义供应商卡片上，「编辑」和「删除」之间有 **补全缺失字段**。该供应商若有未匹配模型，按钮上会显示数量。

### 未匹配

点「未匹配」后可以：

1. **改默认值**：上下文、maxTokens、是否支持图片、有哪些思考强度。之后新加的、百科对不上的模型都用这套。
2. **改某一条**：同样的字段，另加「默认档位」（这个供应商新对话的默认思考）。选「不改」就不会动供应商的 `reasoning`。

思考强度一个都不勾，表示这个模型不会思考。

## 补全规则

匹配顺序（大小写不敏感）：精确 id → 去掉 `provider/` 前缀 → 用 id 尾巴反查。

| 字段 | 百科命中 | 未命中 |
|---|---|---|
| `name` | 用文档名（仅当本地为空） | 不编造 |
| `contextWindow` | 文档值 | 你设的默认值（初始 262144） |
| `maxTokens` | 文档值 | 你设的默认值（初始 32768） |
| `input` | 文档含 image 则 `[text, image]` | 默认是否勾选「支持图片」 |
| `reasoningEfforts` | 文档的思考档；明确无思考则为 `false` | 你勾选的思考强度 |

只写 `llm-pi-ai.providers.*.models[]`。不改官方 DeepSeek 路由，不改 `compat` / `headers` / `api` / `baseURL`。

未保存的「添加提供方」草稿还没有目录行，保存之后才会自动补全。

## 数据

| 路径 | 内容 |
|---|---|
| `~/.dsh/models-dev.json` | 百科缓存、自动补全开关、未匹配默认值 |
| `~/.dsh/settings.yaml` 的 `llm-pi-ai` | 被补全或手改的模型字段 |

若设置了 `DSH_HOME`，缓存写到 `$DSH_HOME/models-dev.json`。

无缓存或超过 7 天会在启动后后台刷新。拉取失败沿用旧缓存；没有缓存时用默认值，不阻断保存。

## 开发

```sh
npm test
```

## License

MIT
