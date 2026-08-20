# im-channel 设计方案

IM 前端通道：飞书、微信、企业微信（QQ / 钉钉为远期规划）。
产品形态是「个人的数字分身」：渠道内 Owner 一次认领，其余用户作为访客直接使用。

## 总体架构

```
im-channel 插件（外部包，经 install.mjs 或 pnpm add git 安装）
├── core/            平台无关
│   ├── channel.ts   ImChannel 接口：connect / onMessage / send / openTurn(TurnSink) / stop
│   ├── bind-store   Owner/访客绑定存储（~/.dsh/im-channel/bindings.json）
│   ├── router.ts    消息路由：命令门禁 → 数字分身路由（访客→Owner 会话）→ driver.prompt → TurnSink
│   ├── render.ts    /回复 三档的实时视图与终稿渲染
│   └── guest-permissions.ts  访客工具/命令白名单（模式匹配 + 目录）
├── plugin/
│   ├── driver.ts    AgentDriver：create/resume + followup + whenIdle + tools.guard 访客门禁
│   ├── login-api.ts 浏览器侧 HTTP：扫码登录 / 绑定管理 / 访客权限读写
│   └── index.ts     Cordis 插件入口（inject agents）
└── channels/        平台适配器
    feishu / wechat / wecom (+ mcp-server-manager 通用 MCP 管理)
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
          ← TurnSink 按平台能力与频控节流：
             飞书 CardKit 流式卡片（平台端打字机，~0.9s 全量快照；缺 cardkit:card:write 权限时
             降级 message.patch 整刷 → 再降级文本编辑）；微信 ~3s 增量一批；企业微信 replyStream
```

- **数字分身路由**：`bind-store.ownerFor(kind)` 找渠道 Owner；访客消息动态路由到 Owner 会话
  （promptOptions.actor=guest），消息带 `[访客·姓名]` 前缀；未认领渠道回复初始化提示。
- **访客工具门禁**：driver 在 agent setup 注册 `agentCtx.tools.guard()`（单调、只能拒绝）——
  访客轮次中未命中 guestTools 白名单（精确名/`前缀*`）的工具调用被拒绝，文案面向模型；
  Owner 轮次不受影响，轮次结束恢复。
- **打断**：执行中收到新消息 → `agent.cancel(user)` + 等旧 turn 落定（8s 超时强制收尾）→ 旧轮以「⏹ 已被中断 + 部分输出」收尾，新消息作为新输入；`/补充` 则走 steering（followup 不取消）追加指令。
- **交互式提问**：driver 在 agent setup 注册作用域遮蔽的 `ask_user_question` 工具（同名就近遮蔽全局实现，仅影响本 agent 及子孙）→ QuestionBridge 把问题渲染成编号选项推给提问用户的 IM，回复（序号/文字/逗号多选/自定义）映射回结构化答案；10 分钟超时拒绝；命令前缀的回复不消费。网页端会话不受影响。
- **图片输入**：飞书（messageResource 流式下载）/企微（URL 下载 + aeskey AES 解密）解析图片消息 → 魔数嗅探媒体类型 → attachments 服务 `saveImage` 持久化 → ImageBlock 附加到用户消息（每轮 ≤3 张、单张 ≤5MB）。
- **企微扫码接入**：`work.weixin.qq.com/ai/qc` 快速创建服务（generate/query_result），扫码即建机器人并直接返回 botid+secret，自动保存并重连；手动 BotID/Secret 作为折叠兜底。
- **会话恢复**：绑定持久化于 `bindings.json`，进程重启后 driver 的 owned 表为空；router 在 prompt 前懒重连（`agents.resume(resumeSessionId)`），失败则为 Owner 重建分身并更新锚点，访客随锚点跟随。遗留绑定（无 isMaster）加载时自动晋升最早行为 Owner。
- **verbosity**：`/回复` 三档映射为 sink 模式 —— 简洁=quiet（只推工具计数+终稿末条）、标准=normal（文字段落流式，基于 assistant/chunk text-delta 增量）、详细=verbose（工具+文字流式）；渲染见 `core/render.ts`。

## 渠道接入与所有权（两条独立线）

1. **机器人凭证**——飞书/微信在设置页扫码、企业微信填 BotID+Secret；凭证存 `~/.dsh/im-channel/credentials/<kind>.json`（0600）。
2. **分身所有权（认领制）**——渠道内第一个 `/bind` 的用户成为 Owner（绑定行 isMaster=true，
   `ownerFor` 取每渠道最早者）；其余用户即访客，无需绑定。Owner `/unbind` 释放渠道可交接。

## 渠道

| 平台 | 传输 | 接入 | 流式回复 |
|---|---|---|---|
| feishu | WSClient 长连接 | 自建应用 appId/secret，设置页扫码 | CardKit 流式卡片（打字机）→ 卡片整刷 → 文本编辑 |
| wechat | iLink 长轮询 getupdates | 设置页扫码（移植 openclaw-weixin，MIT） | 批量增量消息（协议无编辑能力） |
| wecom | 智能机器人回调 + 主动推送 | 设置页填 BotID + Secret | replyStream 流式（不可用时一次性回复） |

远期规划：QQ、钉钉。另含通用 MCP 服务器管理（streamable-http，凭证
`~/.dsh/im-channel/credentials/mcp-servers.json`），注册进分身会话。

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
- **数字分身与访客权限**：渠道内第一个 `/bind` 者为 Owner，其余用户为访客（共享 Owner 会话）
  - 访客工具门禁：driver 在插件根 context 注册【全局层】`tools.guard()`（单调、只能拒绝），actor 经 `session.header.parentSession` 链归因到根会话——子代理派生的调用同样受控；未命中 `im-channel.guestTools` 白名单（精确名/`前缀*`）的工具调用走审批升级
  - 工具审批（已上线，覆盖访客白名单外工具 + Owner 沙箱 escalate）：`tools/pre-execute` 返回 `{kind:'ask'}` / 沙箱 escalate 经 harness `approval/request` 瀑布线交给 ApprovalBridge——优先发**按钮审批卡片**（飞书 interactive + `card.action.trigger` 长连接回调；企微 button_interaction 模板卡片 + `template_card_event` 回传；均无需公网回调地址），点击即决策并定稿卡片（结果按钮替换操作按钮，企微要求 button_list 1-6 个、task_id 与回调一致、req_id 走 {headers} 包裹结构）；文本回复「允许/拒绝」作为兜底并行生效；3 分钟超时 fail-cled 并把卡片置为超时态；无审批服务时守卫兜底拒绝
  - 外发脱敏：driver 对流式视图与终稿统一过 `ctx.masking.maskTextSync`，敏感信息不落第三方 IM
  - 长回复治理：超 6000 字符的回复落盘 `~/.dsh/im-channel/spills/`，IM 先发首尾预览 + `/全文 <编号>` 取回；轮末附 token 页脚，`/状态` 显示上下文水位，`/压缩`（Owner）主动触发 compaction
  - 访客命令门禁：`im-channel.guestCommands`（默认 帮助/状态/回复/停止），管理命令（bind/项目/模型/思考/新建/unbind）仅 Owner
- 工具审批：已实现（见上文访客权限小节）——IM 按钮卡片决策，覆盖访客工具白名单与沙箱 escalate
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

## 配置（settings.yaml `im-channel:` 节）

```yaml
im-channel:
  channels:                 # 渠道实例（设置页自动维护；凭证齐备且启用才连接）
    feishu-1: { kind: feishu, enabled: true, displayName: 飞书机器人 1 }
    wechat-1: { kind: wechat, enabled: true, displayName: 微信机器人 1 }
    wecom-1: { kind: wecom, enabled: true, displayName: 企微机器人 1 }
  commandPrefix: "/"
  allowlist: []             # 用户白名单（userId 或 kind:userId）；空 = 不限
  guestTools: []            # 访客可用工具（精确名/前缀*）；空 = 纯对话
  guestCommands: [帮助, 状态, 回复, 停止]   # 访客可用命令
```

浏览器侧 HTTP（webServer exact 路由，LoginApi 注册）：
`/im-channel/login/start|status`（扫码）、`/im-channel/bindings(|/remove)`、
`/im-channel/guest-permissions(|/update)`、`/im-channel/mcp-servers(|/add|/update|/remove)`、
`/im-channel/wecom/configure`。
