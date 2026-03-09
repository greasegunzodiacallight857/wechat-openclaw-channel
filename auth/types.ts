/**
 * @file types.ts
 * @description 微信扫码登录相关类型定义
 */

/** QClaw 环境配置 */
export interface QClawEnvironment {
  /** JPRX 网关地址 */
  jprxGateway: string;
  /** QClaw 基础 URL (未直接使用，走 JPRX 网关) */
  qclawBaseUrl: string;
  /** 微信登录回调地址 */
  wxLoginRedirectUri: string;
  /** WebSocket 网关地址 */
  wechatWsUrl: string;
  /** 微信开放平台 AppID */
  wxAppId: string;
}

/** 登录凭证 */
export interface LoginCredentials {
  /** JWT Token (用于 API 鉴权) */
  jwtToken: string;
  /** Channel Token (用于 WebSocket 连接) */
  channelToken: string;
  /** 用户信息 */
  userInfo: Record<string, unknown>;
  /** API Key (用于调用模型) */
  apiKey: string;
  /** 设备 GUID */
  guid: string;
}

/** 持久化的登录态 */
export interface PersistedAuthState {
  jwtToken: string;
  channelToken: string;
  apiKey: string;
  guid: string;
  userInfo: Record<string, unknown>;
  savedAt: number;
}

/** QClaw API 通用响应 */
export interface QClawApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

/** Token 过期错误 */
export class TokenExpiredError extends Error {
  constructor(message = "登录已过期，请重新登录") {
    super(message);
    this.name = "TokenExpiredError";
  }
}
