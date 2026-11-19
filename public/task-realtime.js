"use strict";

// M7-C：只接收資料變更通知，所有內容與權限仍以 REST API 回傳為準。
// 本檔不讀取 Cookie 或 CSRF Token，也不透過 Socket 寫入資料庫。
(function installRealtime(root) {
  const VALID_RESOURCES = new Set(["task", "member", "project"]);
  const VALID_ACTIONS = new Set(["created", "updated", "deleted", "moved"]);

  function projectIdOf(value) {
    if (typeof value === "number") {
      return Number.isSafeInteger(value) && value > 0 ? value : null;
    }
    if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value)) return null;
    const result = Number(value);
    return Number.isSafeInteger(result) ? result : null;
  }

  function validChange(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
    if (!Number.isSafeInteger(payload.projectId) || payload.projectId <= 0) return false;
    if (!VALID_RESOURCES.has(payload.resource) || !VALID_ACTIONS.has(payload.action)) return false;
    if (payload.resourceId !== undefined && (!Number.isSafeInteger(payload.resourceId) || payload.resourceId <= 0)) return false;
    if (payload.version !== undefined && (!Number.isSafeInteger(payload.version) || payload.version <= 0)) return false;
    return true;
  }

  function createRealtimeCoordinator({ createSocket, onChange, onRevoked, onStatus,
    onExpired = () => {}, reportError = () => {}, delay = 100,
    schedule = (fn, ms) => setTimeout(fn, ms), cancel = (id) => clearTimeout(id) }) {
    if (typeof createSocket !== "function" || typeof onChange !== "function" ||
        typeof onRevoked !== "function" || typeof onStatus !== "function") {
      throw new TypeError("M7-C 即時同步設定不完整");
    }
    let socket = null;
    let started = false;
    let desiredProject = null;
    let joinedProject = null;
    let joiningProject = null;
    let generation = 0;
    let pending = null;
    let timer = null;
    let everJoined = false;

    function status(label, kind = "neutral") {
      onStatus(label, kind);
    }
    function cancelTimer() {
      if (timer !== null) cancel(timer);
      timer = null;
    }
    function scheduleFlush() {
      if (!started || !pending || timer !== null) return;
      timer = schedule(() => {
        timer = null;
        if (!started || !socket?.connected || joinedProject !== pending?.projectId) return;
        try {
          // false 代表前端忙碌、編輯或拖曳中；保留通知，等解鎖時再觸發。
          if (onChange({ ...pending }) !== false) pending = null;
        } catch (error) {
          reportError(error);
          status("即時同步待重新整理", "warning");
        }
      }, delay);
    }
    function queueChange(projectId, refreshProjects) {
      if (!started || desiredProject !== projectId) return;
      if (pending?.projectId !== projectId) {
        pending = { projectId, refreshProjects: Boolean(refreshProjects) };
      } else {
        pending.refreshProjects ||= Boolean(refreshProjects);
      }
      scheduleFlush();
    }
    function revoke(projectId) {
      if (projectId !== desiredProject) return;
      desiredProject = null;
      pending = null;
      cancelTimer();
      generation++;
      const old = joinedProject;
      joinedProject = null;
      joiningProject = null;
      if (socket?.connected && old) socket.emit("project:leave", { projectId: old });
      status("專案權限已變更", "warning");
      onRevoked(projectId);
    }
    function joinDesired() {
      const currentSocket = socket;
      if (!started || !currentSocket?.connected) return;
      const projectId = desiredProject;
      if (joinedProject && joinedProject !== projectId) {
        currentSocket.emit("project:leave", { projectId: joinedProject });
        joinedProject = null;
      }
      if (!projectId) {
        status("未選擇即時專案");
        return;
      }
      if (joinedProject === projectId || joiningProject === projectId) return;
      joiningProject = projectId;
      const attempt = ++generation;
      currentSocket.timeout(5000).emit("project:join", { projectId }, (error, ack) => {
        if (!started || socket !== currentSocket || !currentSocket.connected) return;
        if (joiningProject === projectId) joiningProject = null;
        if (desiredProject !== projectId || generation !== attempt) {
          // 退訂過時的加入要求；同 ID 再次選中時保留新的訂閱。
          if (ack?.ok && desiredProject !== projectId) {
            currentSocket.emit("project:leave", { projectId });
          }
          return;
        }
        if (error) {
          status("專案連線未確認，稍後重連", "warning");
          return;
        }
        if (!ack?.ok) {
          if (ack?.code === "NOT_FOUND" || ack?.code === "UNAUTHENTICATED") {
            if (ack.code === "NOT_FOUND") revoke(projectId);
            else { stop(); onExpired(); }
          } else {
            status("無法加入即時專案", "warning");
          }
          return;
        }
        joinedProject = projectId;
        status("即時同步中", "success");
        // 加入 Room 前可能錯過事件；每次加入都從受權限保護的 REST 補抓。
        queueChange(projectId, everJoined);
        everJoined = true;
      });
    }
    function setProject(value) {
      const projectId = projectIdOf(value);
      if (desiredProject === projectId) {
        if (started && socket?.connected) joinDesired();
        return;
      }
      desiredProject = projectId;
      pending = null;
      cancelTimer();
      generation++;
      joiningProject = null;
      if (started && socket?.connected) joinDesired();
    }
    function start() {
      if (started) return;
      started = true;
      try {
        socket = createSocket();
        if (!socket) throw new Error("Socket.IO client 尚未載入");
      } catch (error) {
        started = false;
        socket = null;
        status("即時連線暫不可用，可繼續手動整理", "warning");
        reportError(error);
        return;
      }
      socket.on("connect", () => {
        joinedProject = null;
        joiningProject = null;
        generation++;
        status("即時連線已建立");
        joinDesired();
      });
      socket.on("disconnect", () => {
        joinedProject = null;
        joiningProject = null;
        generation++;
        status("即時連線中斷，重連後自動同步", "warning");
      });
      socket.on("connect_error", (error) => {
        if (error?.message === "UNAUTHENTICATED" || error?.data?.code === "UNAUTHENTICATED") {
          stop();
          onExpired();
        } else status("即時連線重試中（REST 功能仍可用）", "warning");
      });
      socket.on("project:changed", (payload) => {
        if (!validChange(payload) || joinedProject !== payload.projectId) return;
        queueChange(payload.projectId, payload.resource !== "task");
      });
      socket.on("project:access-revoked", (payload) => {
        const id = projectIdOf(payload?.projectId);
        if (id) revoke(id);
      });
      status("正在連接即時服務…");
      socket.connect();
    }
    function stop() {
      started = false;
      desiredProject = null;
      joinedProject = null;
      joiningProject = null;
      pending = null;
      generation++;
      cancelTimer();
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
        socket = null;
      }
      status("即時連線已結束");
    }
    return {
      start, stop, setProject,
      flushPending: scheduleFlush,
      // 只供前端測試觀察；不包含憑證或任何私密資料。
      snapshot: () => ({ started, desiredProject, joinedProject,
        pending: pending ? { ...pending } : null }),
    };
  }

  const exports = { projectIdOf, validChange, createRealtimeCoordinator };
  if (typeof module === "object" && module.exports) module.exports = exports;
  if (!root?.document) return;

  const indicator = root.document.createElement("small");
  indicator.id = "task-realtime-status";
  indicator.setAttribute("role", "status");
  indicator.setAttribute("aria-live", "polite");
  indicator.textContent = "即時同步尚未啟動";
  root.document.querySelector(".tf-toolbar-details")?.append(indicator);

  const coordinator = createRealtimeCoordinator({
    createSocket: () => {
      if (typeof root.io !== "function") throw new Error("Socket.IO client 未載入");
      return root.io({
        path: "/socket.io/",
        transports: ["websocket"],
        autoConnect: false,
        withCredentials: true,
        reconnection: true,
        reconnectionDelay: 600,
        reconnectionDelayMax: 4000,
        timeout: 5000,
      });
    },
    onChange: (update) => root.TaskBoard?.realtimeSync(update) ?? false,
    onRevoked: (projectId) => {
      root.TaskBoard?.realtimeRevoked(projectId);
      Promise.resolve(root.TaskFlowDashboard?.reloadProjects?.()).catch(() => {});
    },
    onStatus: (label, kind) => {
      indicator.textContent = label;
      indicator.dataset.kind = kind;
    },
    onExpired: () => root.location.replace("/auth.html"),
    reportError: (error) => console.warn("TaskFlow 即時同步：", error),
  });
  root.TaskRealtime = coordinator;
})(typeof window === "undefined" ? null : window);
