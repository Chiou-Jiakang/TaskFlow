"use strict";

// M7-B：REST 在 Repository 已成功 COMMIT、HTTP 回應完成後才通知 Socket。
// 此模組只通知資料已異動；不將私有任務內容直接透過 WebSocket 洩漏。
const VALID_RESOURCES = new Set(["task", "member", "project"]);
const VALID_ACTIONS = new Set(["created", "updated", "deleted", "moved"]);

function positiveId(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function validateChange(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const { projectId, resource, action, resourceId, version } = input;
  if (!positiveId(projectId) || !VALID_RESOURCES.has(resource) || !VALID_ACTIONS.has(action)) return null;
  if (resourceId !== undefined && !positiveId(resourceId)) return null;
  if (version !== undefined && !positiveId(version)) return null;
  if (Object.keys(input).some((key) => !["projectId", "resource", "action", "resourceId", "version"].includes(key))) {
    return null;
  }
  return { projectId, change: { resource, action,
    ...(resourceId === undefined ? {} : { resourceId }),
    ...(version === undefined ? {} : { version }),
  } };
}

function createRealtimeNotifier(getPublisher, { reportError = console.error } = {}) {
  if (typeof getPublisher !== "function") throw new TypeError("getPublisher 必須是函式");

  return (_req, res, next) => {
    // 完全不修改既有路由的 HTTP 回應；成功狀態也必須有 Repository 的明確註記。
    res.once("finish", () => {
      if (res.statusCode < 200 || res.statusCode >= 300) return;
      const validated = validateChange(res.locals?.taskflowRealtimeChange);
      if (!validated) return;

      try {
        const publish = getPublisher();
        if (typeof publish === "function") {
          publish(validated.projectId, validated.change);
        }
      } catch (error) {
        // 已 COMMIT 的寫入不可因推播失敗偽裝為 HTTP 寫入失敗。
        reportError("TaskFlow M7-B 即時通知失敗（資料已成功寫入）:", error);
      }
    });
    next();
  };
}

module.exports = { validateChange, createRealtimeNotifier };
