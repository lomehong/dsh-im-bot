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
import type { QrLoginBridge } from '../../plugin/login-api.ts';
/**
 * 通过 BotID + Secret 配置企业微信机器人。
 * 保存凭据后，通道会自动连接。
 *
 * @param botId - 企业微信智能机器人 BotID（管理后台获取）
 * @param secret - 企业微信智能机器人 Secret（管理后台获取）
 * @returns 成功返回 true，失败抛出错误
 */
export declare function configureWecomBot(botId: string, secret: string): Promise<void>;
/**
 * 检查是否已配置企业微信凭据
 */
export declare function isWecomConfigured(): boolean;
/**
 * 清除企业微信凭据
 */
export declare function clearWecomCredentials(): Promise<void>;
/**
 * 企业微信登录桥接器（兼容 login-api 接口）
 *
 * 由于企业微信不需要扫码登录，这里的 beginWecomLogin 实际上
 * 只是检查凭据是否存在。浏览器端的配置表单通过独立的 API 路由处理。
 */
export declare function beginWecomLogin(session: QrLoginBridge): Promise<void>;
