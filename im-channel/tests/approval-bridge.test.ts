/**
 * Approval-bridge renderer tests: the card-payload builders are pure
 * functions, so they're fully testable in isolation. The actual waterfall
 * wiring depends on the harness's user-approval service and is exercised
 * end-to-end in a deployment, not here.
 */
import { describe, expect, it } from 'vitest'
import { postApprovalCard, renderFeishuCard, renderWechatCard, type ApprovalPromptTarget, type ApprovalPromptSender } from '../src/plugin/approval-bridge.ts'

describe('renderFeishuCard', () => {
  it('renders an interactive card with Allow and Deny buttons', () => {
    const card = renderFeishuCard({ tool: 'bash', reason: 'delete files', callId: 'c-1' }, 'apr-1')
    expect(card.type).toBe('interactive')
    expect(card.card.schema).toBe('2.0')
    const elements = card.card.body.elements
    expect(elements.length).toBe(2)
    const actions = (elements[1] as { actions: Array<{ value: { decision: string; approvalId: string } }> }).actions
    expect(actions).toHaveLength(2)
    expect(actions[0]?.value).toEqual({ approvalId: 'apr-1', decision: 'allowed-once' })
    expect(actions[1]?.value).toEqual({ approvalId: 'apr-1', decision: 'rejected' })
  })
})

describe('renderWechatCard', () => {
  it('renders a plain-text fallback with the harness decision URL', () => {
    const text = renderWechatCard({ tool: 'bash', reason: 'delete files', callId: 'c-1' }, 'http://localhost:3080')
    expect(text.startsWith('⚠️ Tool approval needed')).toBe(true)
    expect(text).toContain('bash')
    expect(text).toContain('delete files')
    expect(text).toContain('http://localhost:3080/im-channel/approval/decide?tool=bash&callId=c-1')
  })

  it('omits callId in the URL when the request has none', () => {
    const text = renderWechatCard({ tool: 'fs.write', reason: 'overwrite', callId: undefined }, 'http://h')
    expect(text).toContain('callId=')
    // Empty-value query is fine; we don't strip it (server treats empty as absent).
  })
})

describe('postApprovalCard', () => {
  it('routes feishu targets through renderFeishuCard JSON', async () => {
    const sent: Array<{ target: ApprovalPromptTarget; message: { text: string } }> = []
    const sender: ApprovalPromptSender = {
      async send(target, message) { sent.push({ target, message }) },
    }
    await postApprovalCard(sender, { kind: 'feishu', targetId: 'chat-1' }, { tool: 'bash', reason: 'rm', callId: 'c' }, { approvalId: 'apr-1' })
    expect(sent).toHaveLength(1)
    expect(sent[0]!.target.kind).toBe('feishu')
    const body = JSON.parse(sent[0]!.message.text)
    expect(body.type).toBe('interactive')
  })

  it('routes wechat targets through the plain-text fallback', async () => {
    const sent: Array<{ target: ApprovalPromptTarget; message: { text: string } }> = []
    const sender: ApprovalPromptSender = {
      async send(target, message) { sent.push({ target, message }) },
    }
    await postApprovalCard(sender, { kind: 'wechat', targetId: 'wx-1' }, { tool: 'bash', reason: 'rm', callId: 'c' }, { harnessUrl: 'http://h' })
    expect(sent).toHaveLength(1)
    expect(sent[0]!.target.kind).toBe('wechat')
    expect(sent[0]!.message.text.startsWith('⚠️')).toBe(true)
  })

  it('refuses to send a feishu card without an approvalId', async () => {
    const sender: ApprovalPromptSender = { async send() {} }
    await expect(
      postApprovalCard(sender, { kind: 'feishu', targetId: 'chat-1' }, { tool: 'bash', reason: 'rm', callId: 'c' }, {})
    ).rejects.toThrow(/approvalId/)
  })

  it('refuses to send a wechat card without a harnessUrl', async () => {
    const sender: ApprovalPromptSender = { async send() {} }
    await expect(
      postApprovalCard(sender, { kind: 'wechat', targetId: 'wx-1' }, { tool: 'bash', reason: 'rm', callId: 'c' }, {})
    ).rejects.toThrow(/harnessUrl/)
  })
})