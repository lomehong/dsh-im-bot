/**
 * 企业微信智能机器人登录引导。
 *
 * 与微信/飞书的扫码登录不同，企业微信智能机器人采用 BotID + Secret 静态配置方式：
 * 管理员在企业微信管理后台创建智能机器人，获取 BotID 和 Secret，
 * 然后在 DSH 设置页面输入保存。
 *
 * 登录桥接器负责在浏览器端提供表单输入界面引导，
 * 验证凭据后保存到 ~/.dsh/im-channel/credentials/wecom.json。
 */
import { loadWecomCredentials, saveWecomCredentials, saveWecomMcpConfig } from "./index.js";
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
/**
 * 验证企业微信 BotID + Secret 是否有效
 * 仅做基本非空检查，具体有效性由 SDK 连接时验证
 */
async function validateCredentials(botId, secret) {
    if (!botId || !secret)
        return false;
    if (botId.length < 2)
        return false;
    if (secret.length < 2)
        return false;
    return true;
}
/**
 * 通过 BotID + Secret 配置企业微信机器人。
 *
 * @param botId - 企业微信智能机器人 BotID（管理后台获取）
 * @param secret - 企业微信智能机器人 Secret（管理后台获取）
 */
export async function configureWecomBot(botId, secret) {
    const valid = await validateCredentials(botId, secret);
    if (!valid) {
        throw new Error('BotID 和 Secret 不能为空。');
    }
    saveWecomCredentials({ botId, secret });
}
/**
 * 保存 MCP 服务器配置
 */
export async function saveWecomMcpConfigEx(mcpServers) {
    saveWecomMcpConfig({ mcpServers });
}
/**
 * 检查是否已配置企业微信凭据
 */
export function isWecomConfigured() {
    return loadWecomCredentials() !== undefined;
}
/**
 * 清除企业微信凭据
 */
export async function clearWecomCredentials() {
    const path = join(homedir(), '.dsh', 'im-channel', 'credentials', 'wecom.json');
    if (existsSync(path)) {
        const fs = await import('node:fs/promises');
        await fs.unlink(path);
    }
}
/**
 * 企业微信登录桥接器（兼容 login-api 接口）
 *
 * 由于企业微信不需要扫码登录，这里的 beginWecomLogin 实际上
 * 只是检查凭据是否存在。浏览器端的配置表单通过独立的 API 路由处理。
 */
export async function beginWecomLogin(session) {
    // 企业微信不需要扫码，而是通过 BotID + Secret 配置
    // 设置 qrUrl 为特殊标记，让前端显示配置表单而非二维码
    session.qrUrl = 'wecom:config-form';
    // 无论是否已配置，都返回成功，前端根据 qrUrl 特殊值显示表单
    return;
}
