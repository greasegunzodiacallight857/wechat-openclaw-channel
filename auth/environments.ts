/**
 * @file environments.ts
 * @description QClaw 环境配置（生产/测试）
 */

import type { QClawEnvironment } from "./types.js";

const ENVIRONMENTS: Record<string, QClawEnvironment> = {
  production: {
    jprxGateway: "https://jprx.m.qq.com/",
    qclawBaseUrl: "https://mmgrcalltoken.3g.qq.com/aizone/v1",
    wxLoginRedirectUri: "https://security.guanjia.qq.com/login",
    wechatWsUrl: "wss://mmgrcalltoken.3g.qq.com/agentwss",
    wxAppId: "wx9d11056dd75b7240",
  },
  test: {
    jprxGateway: "https://jprx.sparta.html5.qq.com/",
    qclawBaseUrl: "https://jprx.sparta.html5.qq.com/aizone/v1",
    wxLoginRedirectUri: "https://security-test.guanjia.qq.com/login",
    wechatWsUrl: "wss://jprx.sparta.html5.qq.com/agentwss",
    wxAppId: "wx3dd49afb7e2cf957",
  },
};

export const getEnvironment = (name: string): QClawEnvironment => {
  const env = ENVIRONMENTS[name];
  if (!env) throw new Error(`未知环境: ${name}，可选: ${Object.keys(ENVIRONMENTS).join(", ")}`);
  return env;
};
