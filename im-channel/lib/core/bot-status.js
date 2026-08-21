import { BindStore } from "./bind-store.js";
import { loadWechatCredentials } from "../channels/wechat/index.js";
import { loadFeishuCredentials } from "../channels/feishu/index.js";
import { loadWecomCredentials } from "../channels/wecom/index.js";
/** 用户标识脱敏：前 8 位 + 省略号（与设置页 Owner 展示同口径）。 */
export function maskUserId(userId) {
    return userId.length <= 8 ? userId : `${userId.slice(0, 8)}…`;
}
const KIND_LABELS = {
    wechat: '微信',
    feishu: '飞书',
    wecom: '企业微信',
};
/** 生产依赖：凭证文件 + BindStore 单例。 */
export function defaultBotStatusDeps() {
    return {
        accountOf: kind => {
            try {
                if (kind === 'wechat')
                    return loadWechatCredentials()?.accountId;
                if (kind === 'feishu')
                    return loadFeishuCredentials()?.appId;
                return loadWecomCredentials()?.botId;
            }
            catch {
                return undefined;
            }
        },
        bindingsOf: kind => {
            try {
                return BindStore.shared
                    .rowsForListing()
                    .filter(row => row.kind === kind)
                    .map(row => ({ userId: row.userId, ...(row.isMaster !== undefined ? { isMaster: row.isMaster } : {}), boundAt: row.boundAt, sessionId: row.sessionId }));
            }
            catch {
                return [];
            }
        },
    };
}
/**
 * 汇总三个平台的机器人状态。
 * @param channels router 当前持有的通道实例列表（undefined 时全部按离线计）
 * @param deps 可替换依赖（测试注入）
 */
export function collectBotStatus(channels, deps = defaultBotStatusDeps()) {
    const running = new Set(channels?.map(c => c.kind) ?? []);
    return Object.keys(KIND_LABELS).map(kind => {
        const account = deps.accountOf(kind);
        // Owner 在前，其余按绑定时间升序；用户标识脱敏后出域。
        const bindings = deps.bindingsOf(kind)
            .slice()
            .sort((a, b) => (Number(b.isMaster ?? false) - Number(a.isMaster ?? false)) || a.boundAt.localeCompare(b.boundAt))
            .map(row => ({ userId: maskUserId(row.userId), isMaster: row.isMaster === true, boundAt: row.boundAt, sessionId: row.sessionId }));
        return {
            kind,
            label: KIND_LABELS[kind],
            configured: account !== undefined,
            online: running.has(kind),
            account,
            boundUsers: bindings.length,
            bindings,
        };
    });
}
