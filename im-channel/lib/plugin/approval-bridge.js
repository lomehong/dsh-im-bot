/**
 * IM-mediated tool approval bridge.
 *
 * The harness exposes an `approval/request` waterfall for any listener that
 * wants to answer a permission prompt. This bridge makes im-channel one such
 * listener: when a tool is about to run and the harness asks for approval,
 * the bridge posts an Allow / Deny card to the bound IM user and waits for
 * the user's reply via the host-side card-callback route.
 *
 * **Status: scaffold.** The actual wiring (host-side callback route, event
 * scope subscription, handoff between waterfall decision and IM card reply)
 * depends on the harness `user-approval` service surface, which is peer-dep
 * only — no live runtime tests possible without a deployment. What is real
 * and tested here: the card-payload renderers below (`renderFeishuCard`,
 * `renderWechatCard`) and the outcome vocabulary (`ApprovalOutcome`).
 */
/** Build a Feishu interactive card payload with two action buttons. The
 *  callback URL is host-routed (`/im-channel/approval/decide`) and carries the
 *  approval id + decision via the button value. */
export function renderFeishuCard(model, approvalId) {
    return {
        type: 'interactive',
        card: {
            schema: '2.0',
            config: { wide_screen_mode: true },
            body: {
                elements: [
                    { tag: 'markdown', content: `⚠️ **Tool approval needed**\n\nTool: \`${model.tool}\`\nReason: ${model.reason}` },
                    { tag: 'action', actions: [
                            { tag: 'button', type: 'primary', text: { tag: 'plain_text', content: 'Allow (once)' }, value: { approvalId, decision: 'allowed-once' } },
                            { tag: 'button', type: 'danger', text: { tag: 'plain_text', content: 'Deny' }, value: { approvalId, decision: 'rejected' } },
                        ] },
                ],
            },
        },
    };
}
/** Wechat has no message-editing / card primitives, so the only delivery
 *  surface is plain text. We surface the approval + a short URL that opens
 *  the harness web UI where the user can decide. */
export function renderWechatCard(model, harnessUrl) {
    const tail = `Approve / deny: ${harnessUrl}/im-channel/approval/decide?tool=${encodeURIComponent(model.tool)}&callId=${encodeURIComponent(model.callId ?? '')}`;
    return `⚠️ Tool approval needed\nTool: ${model.tool}\nReason: ${model.reason}\n${tail}`;
}
/** Send one approval card through the right channel sender. */
export async function postApprovalCard(sender, target, model, ctx) {
    if (target.kind === 'feishu') {
        if (ctx.approvalId === undefined)
            throw new Error('feishu approval card requires approvalId');
        await sender.send(target, { text: JSON.stringify(renderFeishuCard(model, ctx.approvalId)) });
        return;
    }
    if (ctx.harnessUrl === undefined)
        throw new Error('wechat approval card requires harnessUrl');
    await sender.send(target, { text: renderWechatCard(model, ctx.harnessUrl) });
}
