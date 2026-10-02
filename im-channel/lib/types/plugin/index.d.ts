import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { ChannelKind } from '../core/channel.ts';
export declare const name = "im-channel";
export declare const inject: string[];
export declare const provide: string[];
/** One user-declared channel instance; key in the dict is the instance name. */
export interface ChannelInstanceConfig {
    kind: ChannelKind;
    enabled: boolean;
    displayName?: string;
}
/** Resolved section shape persisted to ~/.dsh/settings.yaml under `im-channel:`. */
export interface ImChannelSection {
    channels: Record<string, ChannelInstanceConfig>;
    commandPrefix: string;
    /** 按回合记忆装配（可选增强，默认关）：dsh-memory assemblePack 逐回合注入 */
    memoryAssemblePerTurn?: boolean;
    /** Allowed IM user ids (or `kind:userId`); empty = everyone allowed. */
    allowlist: string[];
    /** 访客可用的工具模式列表（精确名或前缀通配 `foo*`）；空 = 访客纯对话。 */
    guestTools: string[];
    /** 访客可用的命令（canonical id）；默认帮助/状态/回复/停止。 */
    guestCommands: string[];
    /** IM 会话显式使用的 agent 预设 id；空 = 跟随全局默认预设。 */
    agentPreset: string;
}
export declare const Config: z<ImChannelSection>;
export declare function apply(ctx: Context, config: ImChannelSection): void;
