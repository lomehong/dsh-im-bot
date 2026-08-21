import { BindStore } from "./bind-store.js";
import { loadWechatCredentials } from "../channels/wechat/index.js";
import { loadFeishuCredentials } from "../channels/feishu/index.js";
import { loadWecomCredentials } from "../channels/wecom/index.js";
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
        boundUsersOf: kind => {
            try {
                const rows = BindStore.shared.rowsForListing();
                return rows.filter(row => row.kind === kind).length;
            }
            catch {
                return 0;
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
        return {
            kind,
            label: KIND_LABELS[kind],
            configured: account !== undefined,
            online: running.has(kind),
            account,
            boundUsers: deps.boundUsersOf(kind),
        };
    });
}
