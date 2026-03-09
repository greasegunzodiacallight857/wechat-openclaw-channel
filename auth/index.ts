/**
 * @file auth/index.ts
 * @description 认证模块导出
 */

export type {
  QClawEnvironment,
  LoginCredentials,
  PersistedAuthState,
  QClawApiResponse,
} from "./types.js";
export { TokenExpiredError } from "./types.js";

export { getEnvironment } from "./environments.js";
export { getDeviceGuid } from "./device-guid.js";
export { QClawAPI } from "./qclaw-api.js";
export { loadState, saveState, clearState } from "./state-store.js";
export { performLogin } from "./wechat-login.js";
export type { PerformLoginOptions } from "./wechat-login.js";
