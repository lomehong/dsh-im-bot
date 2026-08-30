/**
 * 企业微信扫码轮询协调器：per-scode single-flight + 结果微缓存。
 *
 * 背景（真机诊断）：`/im-channel/wecom/qr/status` 每次请求都真实外呼企微
 * query_result 接口（10s 超时），而客户端 1.5~3s 一轮地轮询且无在途守卫。
 * 外部服务变慢时请求在服务端越积越多，同时占满浏览器每主机 6 连接，
 * 整个设置页（describe / 保存 / MCP 测试）全部排队卡死数分钟。
 *
 * 折叠后：同一 scode 的并发轮询共享同一次外部请求（single-flight），刚落地
 * 的结果在 cacheTtlMs 内直接回缓存——外部调用量上界 = 每个客户端轮询间隔
 * 至多一次，与并发客户端数无关。
 *
 * 终态语义：
 * - expired/failed：落地即清缓存条目（下一轮重新 poll），由调用方清理会话。
 * - success：副作用（存凭证 + 拉起通道）通过 runExclusive 链入 stored
 *   promise 恰好执行一次（只有发起方链入，等待者与缓存命中都不再执行），
 *   且所有等待者都要等副作用完成才拿到结果；成功结果在 successHoldMs 内
 *   长期缓存，防止扫完码后残留的轮询端重复触发配置/重连。
 * - 外部请求失败（含超时）：条目作废，下一轮轮询可重试。
 */
import type { WecomQrPoll } from '../channels/wecom/qr-auth.ts';
/** success 结果的副作用：在 stored promise 上恰好执行一次。 */
export type QrPollExclusive = (result: Extract<WecomQrPoll, {
    status: 'success';
}>) => Promise<void>;
export interface QrPollCoordinatorOptions {
    /** waiting 结果的微缓存时长。默认 2500ms（略大于客户端最快轮询间隔）。 */
    cacheTtlMs?: number;
    /** success 结果的缓存时长（防止重复副作用）。默认 60s。 */
    successHoldMs?: number;
    /** 时钟注入（测试用）。默认 Date.now。 */
    now?: () => number;
}
export declare class QrPollCoordinator {
    private readonly pollFn;
    private readonly entries;
    private readonly cacheTtlMs;
    private readonly successHoldMs;
    private readonly now;
    constructor(pollFn: (scode: string) => Promise<WecomQrPoll>, options?: QrPollCoordinatorOptions);
    /**
     * 取该 scode 的轮询结果：在途则共享同一 promise；缓存新鲜则直接返回；
     * 否则发起一次新 poll。runExclusive 仅在本次调用真正发起 poll 时被链入
     * （恰一次），其余调用方传入的会被忽略。
     */
    pollOnce(scode: string, runExclusive?: QrPollExclusive): Promise<WecomQrPoll>;
    private startPoll;
}
