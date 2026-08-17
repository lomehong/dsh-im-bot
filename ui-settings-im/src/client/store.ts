/** The supported bot platform kinds. */
export const KINDS = ['feishu', 'wechat', 'wecom'] as const
export type Kind = typeof KINDS[number]
