# im-channel 设计方案

国内 IM 前端通道：飞书、微信、QQ、钉钉。用户在手机上与自己的 DeepSeek Harness agent 对话。

## 总体架构

```
im-channel 插件（外部包，经 dsh plugin --profile <p> add 安装）
├── core/            平台无关
│   ├── channel.ts   ImChannel 接口：connect / onMessage / send / stop
│   ├── bind-store   口令绑定存储（~/.dsh/im-channel/bindings.json）
│   └── router.ts    消息路由：命令 → 绑定检查 → driver.prompt → 回复
├── plugin/
│   ├── driver.ts    AgentDriver 实现：ctx.agents.create + followup + whenIdle
│   └── index.ts     Cordis 插件入口（inject agents）
└── channels/        各平台适配器（逐个实现）
    feishu / wechat / qq / dingtalk
```

## 数据流

```
手机 IM → 平台长连接(WS/长轮询) → channel 解析为 InboundMessage
  → router：allowlist → 命令? → BindStore
            绑定消息      → driver.prompt(sessionId, text, { verbosity, onUpdate })
                          → channel.openTurn(target, { mode }) 打开 TurnSink
                            （飞书：一张可刷新的 markdown 卡片；微信：批量增量消息）
                          → agent 事件流边收集边 onUpdate(view) 推过程
                          → whenIdle() 落定 → sink.finish(终稿)
          ← TurnSink 内部按平台频控节流（飞书 ~2.2s patch 一次；微信 ~3s 增量一批）
```

- **打断**：执行中收到新消息 → `agent.cancel(user)` + 等旧 turn 落定（8s 超时强制收尾）→ 旧轮以「⏹ 已被中断 + 部分输出」收尾，新消息作为新输入。
- **会话恢复**：绑定持久化于 `bindings.json`，进程重启后 driver 的 owned 表为空；router 在 prompt 前懒重连（`agents.create` 同 sessionId = resume），失败才提示重新 `/bind`。
- **verbosity**：`/回复` 三档映射为 sink 模式 —— 简洁=quiet（只推工具计数+终稿末条）、标准=normal（文字段落流式）、详细=verbose（工具+文字流式）；终稿渲染见 `core/render.ts`。

## 两条绑定线（互相独立）

1. **机器人凭证（扫码）**——终端渲染二维码，手机扫码，凭证存 `~/.dsh/im-channel/credentials/<kind>.json`（0600）。每平台 SDK 原生支持。
2. **用户绑定（口令）**——harness 启动时终端显示 `BIND-XXXXXX`（10 分钟一次性）；用户在 IM 里发 `/bind BIND-XXXXXX`，通过后该 IM 用户绑定到一个新建 session。

## 四平台

| 平台 | 传输 | 登录 | SDK |
|---|---|---|---|
| feishu | WSClient 长连接 | 自建应用 appId/secret（可 OAuth 扫码） | @larksuiteoapi/node-sdk |
| wechat | iLink 长轮询 getupdates | 终端二维码（移植 openclaw-weixin，MIT） | 自实现 api/ 模块 |
| qq | 官方 bot WebSocket | qqbot-connector qrConnect() 扫码回凭证 | @tencent-connect/qqbot-connector |
| dingtalk | dingtalk-stream WS | 群内自定义机器人（勾 Stream 模式）→ clientId/secret | dingtalk-stream |

实施顺序：wechat → qq → feishu → dingtalk（用户价值 × 实现难度权衡）。

## Harness 集成（机制已验证）

- 插件声明 `export const inject = ['agents']`；`ctx.agents.create({sessionId, meta:{cwd}, agentOptions})` → `AgentHandle`；同 sessionId 重复 create = resume（重启后懒重连用）
- 发消息：`createUserMessage({content:[{type:'text',text}],source:{kind:'user'}})` + `agent.followup(msg)`
- 收回复：`ctx.on('session/event')` 收 `assistant/message` text 块 —— 边收集边通过 `onUpdate(view)` 推给 TurnSink；`agent/inbox/claimed` 关联 turn；`whenIdle()` 落定后 `sink.finish(renderFinal(...))`
- 打断：新 prompt 对在飞 turn `agent.cancel({kind:'user'})`，等 `whenIdle` 落定后提交新消息
- Bundle 声明：package.json `"dsh": { "bundle": { "patch": "cordis.patch.yml" } }`，patch 为 id 定向 YAML 行（replace config / insert 行 / `!!js` 表达式）
- 配置：`ctx.settings` 命名空间（settings.yaml `im-channel:` 节，含 `allowlist`）；凭证走 `ctx.credentials.resolve(ref)`

## 安全

- 凭证文件 0600，目录 ~/.dsh/im-channel/
- 可选用户白名单：settings `im-channel.allowlist`（userId 或 `kind:userId`），名单外的消息静默忽略（不暴露探测面）
- 飞书群聊仅响应被 @ 的消息（mention 占位符会从文本中剥离）
- 绑定：当前为「能发消息即可绑定」（依赖飞书自建应用可用范围/微信单聊边界做准入）；后续可恢复一次性口令
- 工具审批：暂未实现（agent 使用 harness 默认权限策略）；规划接飞书卡片按钮回调做危险工具确认

## 配置（cordis.yml 示例）

```yaml
- id: im-channel
  name: '@dsh-extra/im-channel'
  inject: [agents]
  config:
    channels:
      feishu: { enabled: true, appIdEnv: FEISHU_APP_ID, appSecretEnv: FEISHU_APP_SECRET }
      wechat: { enabled: true }
      qq: { enabled: true }
      dingtalk: { enabled: false, clientIdEnv: DINGTALK_CLIENT_ID, clientSecretEnv: DINGTALK_CLIENT_SECRET }
    commandPrefix: "/"
```
