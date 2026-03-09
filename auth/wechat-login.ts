/**
 * @file wechat-login.ts
 * @description 微信扫码登录流程编排
 *
 * 对应 Python demo 的 WeChatLogin 类和 do_login 函数。
 * 流程：获取 state → 生成二维码 → 等待 code → 换 token → (邀请码) → 保存
 */

import { createInterface } from "node:readline";
import type { QClawEnvironment, LoginCredentials, PersistedAuthState } from "./types.js";
import { QClawAPI } from "./qclaw-api.js";
import { saveState } from "./state-store.js";
import { nested } from "./utils.js";

/** 构造微信 OAuth2 授权 URL */
const buildAuthUrl = (state: string, env: QClawEnvironment): string => {
  const params = new URLSearchParams({
    appid: env.wxAppId,
    redirect_uri: env.wxLoginRedirectUri,
    response_type: "code",
    scope: "snsapi_login",
    state,
  });
  return `https://open.weixin.qq.com/connect/qrconnect?${params.toString()}#wechat_redirect`;
};

/** 在终端显示二维码 */
const displayQrCode = async (url: string): Promise<void> => {
  console.log("\n" + "=".repeat(60));
  console.log("  请用微信扫描下方二维码登录");
  console.log("=".repeat(60));

  try {
    // qrcode-terminal 是 CJS 模块，动态 import
    const qrterm = await import("qrcode-terminal");
    const generate = qrterm.default?.generate ?? qrterm.generate;
    generate(url, { small: true }, (qrcode: string) => {
      console.log(qrcode);
    });
  } catch {
    console.log("\n(未安装 qrcode-terminal，无法在终端显示二维码)");
    console.log("请安装: npm install qrcode-terminal");
  }

  console.log("\n或者在浏览器中打开以下链接：");
  console.log(`  ${url}`);
  console.log("=".repeat(60));
};

/** 从 stdin 读取一行 */
const readLine = (prompt: string): Promise<string> => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
};

/**
 * 等待用户输入微信授权后重定向 URL 中的 code
 *
 * 接受两种输入：
 * 1. 完整 URL（自动从 query string 或 fragment 提取 code）
 * 2. 裸 code 字符串
 */
const waitForAuthCode = async (): Promise<string> => {
  console.log();
  console.log("微信扫码授权后，浏览器会跳转到一个新页面。");
  console.log("请从浏览器地址栏复制完整 URL，或只复制 code 参数值。");
  console.log();

  const raw = await readLine("请粘贴 URL 或 code: ");
  if (!raw) return "";

  // 尝试从 URL 中提取 code
  if (raw.includes("code=")) {
    try {
      const url = new URL(raw);
      // 先查 query string
      const code = url.searchParams.get("code");
      if (code) return code;
      // 再查 fragment（微信可能将 code 放在 hash 后面）
      if (url.hash) {
        const fragmentParams = new URLSearchParams(url.hash.replace(/^#/, ""));
        const fCode = fragmentParams.get("code");
        if (fCode) return fCode;
      }
    } catch {
      // URL 解析失败，尝试正则
    }
    const match = raw.match(/[?&#]code=([^&#]+)/);
    if (match?.[1]) return match[1];
  }

  // 直接就是 code
  return raw;
};

export interface PerformLoginOptions {
  guid: string;
  env: QClawEnvironment;
  bypassInvite?: boolean;
  /** 自定义 state 文件路径 */
  authStatePath?: string;
  /** 日志函数 */
  log?: { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
}

/**
 * 执行完整的微信扫码登录流程
 *
 * 步骤：
 * 1. 获取 OAuth state
 * 2. 生成二维码并展示
 * 3. 等待用户输入 code
 * 4. 用 code 换 token
 * 5. 创建 API Key（非致命）
 * 6. 邀请码检查（可绕过）
 * 7. 保存登录态
 */
export const performLogin = async (options: PerformLoginOptions): Promise<LoginCredentials> => {
  const { guid, env, bypassInvite = false, authStatePath, log } = options;
  const info = (...args: unknown[]) => log?.info?.(...args) ?? console.log(...args);
  const warn = (...args: unknown[]) => log?.warn?.(...args) ?? console.warn(...args);

  const api = new QClawAPI(env, guid);

  // 1. 获取 OAuth state
  info("[Login] 步骤 1/5: 获取登录 state...");
  let state = String(Math.floor(Math.random() * 10000)); // 随机兜底
  const stateResult = await api.getWxLoginState();
  if (stateResult.success) {
    const s = nested(stateResult.data, "state") as string | undefined;
    if (s) state = s;
  }
  info(`[Login] state=${state}`);

  // 2. 生成二维码
  info("[Login] 步骤 2/5: 生成微信登录二维码...");
  const authUrl = buildAuthUrl(state, env);
  await displayQrCode(authUrl);

  // 3. 等待 code
  info("[Login] 步骤 3/5: 等待微信扫码授权...");
  const code = await waitForAuthCode();
  if (!code) {
    throw new Error("未获取到授权 code");
  }

  // 4. 用 code 换 token
  info(`[Login] 步骤 4/5: 用授权码登录 (code=${code.substring(0, 10)}...)`);
  const loginResult = await api.wxLogin(code, state);
  if (!loginResult.success) {
    throw new Error(`登录失败: ${loginResult.message ?? "未知错误"}`);
  }

  const loginData = loginResult.data as Record<string, unknown>;
  const jwtToken = (loginData.token as string) || "";
  const channelToken = (loginData.openclaw_channel_token as string) || "";
  const userInfo = (loginData.user_info as Record<string, unknown>) || {};

  api.jwtToken = jwtToken;
  api.userId = String(userInfo.user_id ?? "");
  // 更新 loginKey（服务端可能返回新值，后续 API 调用需要使用）
  const loginKey = userInfo.loginKey as string | undefined;
  if (loginKey) {
    api.loginKey = loginKey;
  }

  info(`[Login] 登录成功! 用户: ${(userInfo.nickname as string) ?? "unknown"}`);

  // 5. 创建 API Key（非致命）
  info("[Login] 步骤 5/5: 创建 API Key...");
  let apiKey = "";
  try {
    const keyResult = await api.createApiKey();
    if (keyResult.success) {
      apiKey =
        (nested(keyResult.data, "key") as string) ??
        (nested(keyResult.data, "resp", "data", "key") as string) ??
        "";
      if (apiKey) info(`[Login] API Key: ${apiKey.substring(0, 8)}...`);
    }
  } catch (e) {
    warn(`[Login] 创建 API Key 失败（非致命）: ${e}`);
  }

  // 邀请码检查
  const userId = String(userInfo.user_id ?? "");
  if (userId && !bypassInvite) {
    try {
      const check = await api.checkInviteCode(userId);
      if (check.success) {
        const verified = nested(check.data, "already_verified");
        if (!verified) {
          info("\n[Login] 需要邀请码验证。");
          const inviteCode = await readLine("请输入邀请码: ");
          if (inviteCode) {
            const submitResult = await api.submitInviteCode(userId, inviteCode);
            if (!submitResult.success) {
              throw new Error(`邀请码验证失败: ${submitResult.message}`);
            }
            info("[Login] 邀请码验证通过!");
          }
        }
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("邀请码验证失败")) throw e;
      warn(`[Login] 邀请码检查失败（非致命）: ${e}`);
    }
  } else if (bypassInvite) {
    info("[Login] 已跳过邀请码验证 (bypassInvite=true)");
  }

  // 保存登录态
  const credentials: LoginCredentials = {
    jwtToken,
    channelToken,
    userInfo,
    apiKey,
    guid,
  };

  const persistedState: PersistedAuthState = {
    jwtToken,
    channelToken,
    apiKey,
    guid,
    userInfo,
    savedAt: Date.now(),
  };
  saveState(persistedState, authStatePath);
  info("[Login] 登录态已保存");

  return credentials;
};
