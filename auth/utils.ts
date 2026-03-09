/**
 * @file utils.ts
 * @description 认证模块共享工具函数
 */

/** 安全嵌套取值 */
export const nested = (obj: unknown, ...keys: string[]): unknown => {
  let current = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
};
