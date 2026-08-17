# im-channel

DeepSeek Harness（dsh）的 IM 服务端通道插件：**飞书 / 微信 / 企业微信**。
把 IM 变成你一个人的数字分身——Owner 一次认领，所有人直接使用。

完整的使用说明见[仓库根 README](../README.md)；架构设计见 [DESIGN.md](./DESIGN.md)。

## 渠道接入

| 渠道 | 一次性准备 | 凭证/状态文件 |
|---|---|---|
| 飞书 | 开放平台建自建应用（机器人能力 + 长连接事件订阅），保存 appId/appSecret；打字机流式需开通 `cardkit:card:write` 权限 | `~/.dsh/im-channel/credentials/feishu.json` |
| 微信 | 设置页扫码（iLink 协议） | `~/.dsh/im-channel/credentials/wechat.json` |
| 企业微信 | 设置页填 BotID + Secret（智能机器人） | `~/.dsh/im-channel/credentials/wecom.json` |

MCP 服务器（streamable-http）配置在 `~/.dsh/im-channel/credentials/mcp-servers.json`，
设置页可视化管理。

## 数字分身模型

- 渠道内第一个 `/bind` 的用户成为 **Owner**（认领制），其余用户一律是**访客**
- 访客零门槛：直接发消息即与分身对话（消息带 `[访客·姓名]` 前缀），共享 Owner 的会话上下文
- 访客可用的**工具**与**命令**由 Owner 在设置页「访客权限」配置（工具默认全部禁用；
  白名单支持 `前缀*` 通配），通过 harness 的 `tools.guard` 单调守卫强制执行
- Owner `/unbind` 释放渠道可交接所有权

## 安装（终端用户）

使用[仓库根目录的一键安装脚本](../README.md#安装)即可，无需手动安装本包。

## 许可

MIT。微信通道的 iLink 协议实现移植自 [Tencent/openclaw-weixin](https://github.com/Tencent/openclaw-weixin)（MIT，Copyright (C) 2026 Tencent）。
