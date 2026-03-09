/**
 * @file state-store.ts
 * @description 登录态持久化存储
 *
 * 将 token 保存到本地文件，下次启动时自动加载，避免重复扫码。
 * 文件权限设为 0o600，仅当前用户可读写。
 */

import { readFileSync, writeFileSync, unlinkSync, mkdirSync, chmodSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import type { PersistedAuthState } from "./types.js";

const DEFAULT_STATE_PATH = join(homedir(), ".openclaw", "wechat-access-auth.json");

export const getStatePath = (customPath?: string): string =>
  customPath || DEFAULT_STATE_PATH;

export const loadState = (customPath?: string): PersistedAuthState | null => {
  const filePath = getStatePath(customPath);
  try {
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as PersistedAuthState;
  } catch {
    return null;
  }
};

export const saveState = (state: PersistedAuthState, customPath?: string): void => {
  const filePath = getStatePath(customPath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(state, null, 2), { encoding: "utf-8", mode: 0o600 });
  // 确保已有文件也收紧权限
  try {
    chmodSync(filePath, 0o600);
  } catch {
    // Windows 等平台可能不支持 chmod，忽略
  }
};

export const clearState = (customPath?: string): void => {
  const filePath = getStatePath(customPath);
  try {
    unlinkSync(filePath);
  } catch {
    // file not found — ignore
  }
};
