/**
 * @file device-guid.ts
 * @description 设备唯一标识生成
 *
 * 不使用真实机器码，而是首次运行时随机生成一个 GUID 并持久化到本地文件。
 * 后续启动自动加载，保证同一台机器上 GUID 稳定不变。
 */

import { randomUUID, createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

const GUID_FILE = join(homedir(), ".openclaw", "wechat-access-guid");

/**
 * 获取设备唯一标识
 *
 * 首次运行时随机生成一个 MD5 格式的 GUID 并保存到 ~/.openclaw/wechat-access-guid，
 * 后续启动直接从文件读取，确保稳定。
 */
export const getDeviceGuid = (): string => {
  // 尝试从文件加载已有 GUID
  try {
    const existing = readFileSync(GUID_FILE, "utf-8").trim();
    if (existing) return existing;
  } catch {
    // 文件不存在或读取失败，继续生成
  }

  // 首次运行：生成随机 GUID（MD5 hex 格式，32 字符）
  const guid = createHash("md5").update(randomUUID()).digest("hex");

  // 持久化
  try {
    mkdirSync(dirname(GUID_FILE), { recursive: true });
    writeFileSync(GUID_FILE, guid, "utf-8");
  } catch {
    // 写入失败不致命，本次仍返回生成的 GUID
  }

  return guid;
};
