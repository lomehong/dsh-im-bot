/**
 * Brand for opaque IM user ids (Feishu open_id, WeChat ilink_user_id) that
 * cross the channel boundary into binding and routing. Never a bare string.
 */
declare const IM_USER_ID_BRAND: unique symbol
export type ImUserId = string & { readonly [IM_USER_ID_BRAND]: true }

/** Identifies which platform a message/binding came from. */
export type ChannelKind = 'feishu' | 'wechat' | 'wecom'

/** A (platform, user) pair; unique key for the binding store. */
export interface ImUserRef {
  readonly kind: ChannelKind
  readonly userId: ImUserId
}

/**
 * IM 用户详细信息（由各渠道自行填充，可选字段因平台而异）
 */
export interface InboundUserInfo {
  /** 用户账号/ID */
  userId: string
  /** 用户姓名 */
  name?: string
  /** 职务 */
  position?: string
  /** 部门列表 */
  department?: string[]
  /** 手机号 */
  mobile?: string
  /** 邮箱 */
  email?: string
  /** 头像 URL */
  avatar?: string
}

/**
 * One normalized inbound message from any IM platform. Channels parse
 * platform-specific payloads into this shape before routing.
 */
export interface InboundMessage {
  readonly from: ImUserRef
  readonly text: string
  /** Platform message id, used for idempotent dedup on retry/redelivery. */
  readonly messageId: string
  /** Chat id (Feishu chat_id, ...) when the message is not a 1:1 DM. */
  readonly chatId?: string
  /** True when the message mentioned/at-ed the bot in a group chat. */
  readonly mentioned?: boolean
  /** Decoded images attached to the message (vision input), max 3 per turn. */
  readonly images?: readonly ImImage[]
  /** 发送者详细信息（渠道可选填充） */
  readonly userInfo?: InboundUserInfo
}

/** Outbound reply payload; channels render to platform formats. */
export interface OutboundMessage {
  readonly text: string
  /** Markdown flag lets platforms with markdown support render richly. */
  readonly markdown?: boolean
  /** Reply-to message id when the platform supports threading. */
  readonly replyTo?: string
}

/**
 * A channel's own conversation target: everything needed to send a reply
 * back to the origin of a message. Captured per inbound message and stored
 * alongside the binding for proactive sends.
 */
export interface ReplyTarget {
  readonly kind: ChannelKind
  /** Platform-specific send target (chat_id / user id / session id). */
  readonly targetId: string
}

/**
 * How chatty a live turn's intermediate updates should be. Derived from the
 * user's /回复 verbosity: 简洁=quiet, 标准=normal, 详细=verbose.
 */
export type TurnMode = 'quiet' | 'normal' | 'verbose'

/**
 * A live outbound reply the channel can render while the agent works.
 * update() carries a full snapshot of the turn so far and is fire-and-forget;
 * implementations throttle to their platform's rate limits. Exactly one of
 * finish()/fail() ends the turn; no update() follows them.
 */
export interface TurnSink {
  /** Render an intermediate view of the turn (full snapshot each call). */
  update(view: string): void
  /** The turn finished; final full content, markdown where supported. */
  finish(final: { text: string; markdown?: boolean }): Promise<void>
  /** The turn failed; message is already user-facing. */
  fail(message: string): Promise<void>
}

/** One button-based approval card request; token links clicks back to the bridge. */
export interface ApprovalCardRequest {
  readonly token: string
  readonly guestLabel: string
  readonly toolName: string
  readonly reason: string | undefined
}

/** One inbound image, decoded to bytes with a sniffed media type. */
export interface ImImage {
  readonly bytes: Uint8Array
  readonly mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'
}

/** Sniff the media type from magic bytes; undefined when unrecognised. */
export function sniffImageMediaType(bytes: Uint8Array): ImImage['mediaType'] | undefined {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif'
  if (bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp'
  return undefined
}

/** A button decision delivered by a channel's card-callback path. */
export interface ApprovalAction {
  readonly kind: ChannelKind
  readonly token: string
  readonly decision: 'allow' | 'deny'
  /** The clicking user (verified against the channel owner by the bridge). */
  readonly userId: string
  /** Best-effort card finalization (mark decided/timeout on the card). */
  readonly settleCard?: (outcome: 'allowed' | 'rejected' | 'timeout') => Promise<void>
}

/**
 * One IM platform adapter. A capability-seam style interface: each platform
 * implements connect/onMessage/send/login; routing and binding are shared
 * core and never live in a channel.
 */
export interface ImChannel {
  readonly kind: ChannelKind
  /** Human label for logs and terminal output. */
  readonly label: string
  /** Whether credentials exist and the channel can start. */
  isConfigured(): boolean
  /** Establish the platform connection (WebSocket / long-poll). Resolves when listening. */
  connect(): Promise<void>
  /** Register the inbound-message handler. Must be called before connect(). */
  onMessage(handler: (message: InboundMessage) => void): void
  /** Send a reply to a captured target. */
  send(target: ReplyTarget, message: OutboundMessage): Promise<void>
  /**
   * Open a live updatable reply for one agent turn. Channels whose platform
   * cannot edit sent messages may still batch updates into periodic sends;
   * channels that cannot stream at all omit this and the router falls back
   * to send-on-final only.
   */
  openTurn?(target: ReplyTarget, options: { mode: TurnMode }): Promise<TurnSink>
  /**
   * Watch for permanent channel death (invalidated credentials, unrecoverable
   * protocol state). Optional; the router logs these loudly.
   */
  onDead?(handler: (reason: string) => void): void
  /**
   * Send a button-based approval card (guest tool gate). The card carries a
   * token; the decision comes back through onApprovalAction on the same
   * connection. Returning false (or omitting the method) falls back to the
   * text-reply approval flow.
   */
  sendApprovalCard?(target: ReplyTarget, card: ApprovalCardRequest): Promise<boolean>
  /** Deliver button decisions from approval cards back to the router. */
  onApprovalAction?(handler: (action: ApprovalAction) => void): void
  /** Release the connection; no further handler invocations after resolve. */
  stop(): Promise<void>
}
