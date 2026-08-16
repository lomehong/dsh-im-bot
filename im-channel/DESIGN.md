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
  - 设计草案（见下文 § 工具审批）：hooks `ctx.on('session/event')` 监听 `tool/call`，命中危险名单时调 `ctx.approval.request({tool, reason, callId})`；通过 `approval/request` waterfall 监听器渲染飞书 / 微信卡，按钮回调用 `approval/decided` 决定 allow / deny
  - 依赖：peer dep `@deepseek-ai/dsh-user-approval >=0.1.0`（已加入 package.json；部署需保证 harness 暴露 `ctx.approval` 服务）

## 工具审批（规划）

把 `im-channel` 注册成 harness 的 `approval/request` waterfall 上的一个 answerer：工具即将运行 → harness 通知瀑布 → 我们在 IM 里发卡片 → 用户点按钮 → 我们回 `approval/decided` → harness 继续或拒绝。

```
agent 发起 tool/call
  → harness 工具栈调用 ctx.approval.request({tool, reason, callId})
    → waterfall 派发 approval/request 事件（agent-scoped, scope-filtered）
      → im-channel 的 answerer 命中：渲染飞书 / 微信卡片（Allow/Deny 按钮）
        → 用户在 IM 里点击 → 卡片 callback URL → host 解析 → approval/decided(allow|deny)
          → waterfall 解析 → harness 继续执行或拒绝
  → 旁路：另一 answerer（ACP / Web）若已抢先决定，事件不再到达我们（sibling order 不保证）
```

接入点：
- `plugin/driver.ts` 仍是工具事件收集点 — 当前只把 `tool/call` 文本写进 `inflight.toolLines`；未来把它升级成"等 approval 完成后再让 agent 继续"的屏障
- 卡片渲染走飞书 `FeishuTurnSink` 已有 `stream → card → text` 降级；微信端 `WechatTurnSink` 只能批量追加，所以审批结果只能等用户回到 Web UI（规划）
- 危险名单配置：`im-channel:` 节新增 `dangerousTools: string[]`（默认 `['bash', 'fs.write', 'fs.edit', 'git push']`）
- 答案词汇：`allowed-once` / `rejected` / `cancelled` / `unavailable`；超时（默认 5 分钟）= `cancelled`

不做的事（明确推迟）：
- 「记住这次选择 / 全局规则」—— harness `user-approval` README 明确说只支持 `allowed-once`，没有 `allow-always` 概念
- 多用户授权分流（一会话绑一用户已经够用）
- 微信端审批 UI（协议不支持编辑已发消息，只能跑批量；审批先以飞书为准）

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
