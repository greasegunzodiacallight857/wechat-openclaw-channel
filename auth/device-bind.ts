/**
 * @file device-bind.ts
 * @description 设备绑定流程：生成企微客服链接 → 用户在微信中打开 → 轮询绑定状态
 *
 * 登录拿到 token 后，微信里还看不到对话入口。
 * 必须通过客服链接完成设备绑定，微信中才会出现聊天入口。
 */

import type { QClawAPI } from "./qclaw-api.js";
import { nested } from "./utils.js";

/** 默认的企微客服 open_kfid */
const DEFAULT_OPEN_KFID = "wkzLlJLAAAfbxEV3ZcS-lHZxkaKmpejQ";

/** 轮询间隔（毫秒） */
const POLL_INTERVAL_MS = 2000;

/** 默认超时（毫秒） */
const DEFAULT_TIMEOUT_MS = 300_000; // 5 分钟

export interface DeviceBindOptions {
  /** 已认证的 QClawAPI 实例 */
  api: QClawAPI;
  /** 企微客服 open_kfid（可选，有默认值） */
  openKfId?: string;
  /** 轮询超时（毫秒） */
  timeoutMs?: number;
  /** 日志输出 */
  log?: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
  /** 显示二维码（终端场景用，传入 URL 后在终端渲染 QR） */
  showQr?: (url: string) => Promise<void>;
}

export interface DeviceBindResult {
  /** 是否绑定成功 */
  success: boolean;
  /** 客服链接 URL（即使未成功也可能有值） */
  contactUrl?: string;
  /** 绑定成功时的微信昵称 */
  nickname?: string;
  /** 描述信息 */
  message: string;
}

/**
 * 在终端显示二维码的默认实现
 */
async function defaultShowQr(url: string): Promise<void> {
  try {
    const qrterm = await import("qrcode-terminal");
    const generate = qrterm.default?.generate ?? qrterm.generate;
    generate(url, { small: true }, (qrcode: string) => {
      console.log(qrcode);
    });
  } catch {
    // qrcode-terminal 不可用，静默跳过
  }
}

/**
 * 执行设备绑定流程
 *
 * 步骤：
 * 1. 调用 4018 接口生成企微客服链接
 * 2. 展示链接（终端 QR / URL）供用户在微信中打开
 * 3. 轮询 4019 接口等待绑定完成
 */
export async function performDeviceBinding(options: DeviceBindOptions): Promise<DeviceBindResult> {
  const {
    api,
    openKfId = DEFAULT_OPEN_KFID,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    log = { info: console.log, warn: console.warn, error: console.error },
    showQr = defaultShowQr,
  } = options;

  // 1. 生成企微客服链接
  log.info("[device-bind] 生成企微客服链接...");
  let linkResult;
  try {
    linkResult = await api.generateContactLink(openKfId);
  } catch (e) {
    const msg = `生成客服链接失败: ${e instanceof Error ? e.message : String(e)}`;
    log.warn(`[device-bind] ${msg}`);
    return { success: false, message: msg };
  }

  if (!linkResult.success) {
    const msg = `生成客服链接失败: ${linkResult.message ?? "未知错误"}`;
    log.warn(`[device-bind] ${msg}`);
    return { success: false, message: msg };
  }

  const linkData = linkResult.data as Record<string, unknown>;
  const contactUrl =
    (nested(linkData, "url") as string) ||
    (nested(linkData, "data", "url") as string) ||
    (nested(linkData, "resp", "url") as string) ||
    "";

  if (!contactUrl) {
    const msg = "服务端未返回客服链接 URL";
    log.warn(`[device-bind] ${msg}`);
    return { success: false, message: msg };
  }

  // 2. 展示链接
  console.log("");
  console.log("=".repeat(64));
  console.log("请用「控制端微信」打开下方链接，完成设备绑定");
  console.log("绑定后微信中会出现对话入口");
  console.log("=".repeat(64));
  await showQr(contactUrl);
  console.log(`\n链接: ${contactUrl}\n`);

  // 3. 轮询绑定状态
  log.info("[device-bind] 等待设备绑定...");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    try {
      const status = await api.queryDeviceByGuid();
      if (status.success) {
        const sd = status.data as Record<string, unknown>;
        const nickname =
          (nested(sd, "nickname") as string) ||
          (nested(sd, "data", "nickname") as string);
        const externalUserId =
          (nested(sd, "external_user_id") as string) ||
          (nested(sd, "data", "external_user_id") as string);

        if (nickname || externalUserId) {
          const msg = `设备绑定成功!${nickname ? ` 微信昵称: ${nickname}` : ""}`;
          log.info(`[device-bind] ${msg}`);
          return { success: true, contactUrl, nickname: nickname || undefined, message: msg };
        }
      }
    } catch {
      // 轮询失败不中断，继续重试
    }
  }

  return {
    success: false,
    contactUrl,
    message: "设备绑定超时。请确认已在微信中打开上方链接，然后重启 Gateway 重试。",
  };
}
