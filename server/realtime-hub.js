"use strict";

// M7-A：Socket.IO 身分驗證與專案 Room。此階段不允許 Socket 寫入資料庫。
const { Server } = require("socket.io");
const { createAuthRepository } = require("./auth-foundation");

const SESSION_COOKIE = "taskflow_session";
const MAX_ROOMS_PER_SOCKET = 32;

function readSessionCookie(header) {
  if (typeof header !== "string") return null;
  let value = null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== SESSION_COOKIE) {
      continue;
    }
    // 不接受重複 Session Cookie，也不接受空值。
    if (value !== null) return null;
    value = part.slice(separator + 1).trim();
  }
  return value || null;
}

function positiveId(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function roomName(projectId) {
  return `project:${projectId}`;
}

function originAllowed(request, configuredOrigin = process.env.TASKFLOW_ORIGIN) {
  const origin = request.headers.origin;
  const site = request.headers["sec-fetch-site"];
  if (site && !["same-origin", "none"].includes(site)) return false;
  if (typeof origin !== "string" || !origin) return false;
  const host = request.headers.host;
  if (!configuredOrigin && (typeof host !== "string" || !host)) return false;

  try {
    const expected = new URL(
      configuredOrigin || `http://${host}`,
    ).origin;
    return new URL(origin).origin === expected && origin === expected;
  } catch {
    return false;
  }
}

function attachRealtime(httpServer, db) {
  if (!httpServer || typeof httpServer.on !== "function") {
    throw new TypeError("必須提供 Node.js HTTP Server。");
  }
  if (!db || typeof db.prepare !== "function") {
    throw new TypeError("必須提供已初始化的 SQLite Database。");
  }

  const auth = createAuthRepository(db);
  const membership = db.prepare(`
    SELECT pm.role
    FROM project_members AS pm
    INNER JOIN projects AS p ON p.id = pm.project_id
    WHERE pm.project_id = ? AND pm.user_id = ?
  `);

  const io = new Server(httpServer, {
    path: "/socket.io/",
    serveClient: true,
    cors: { origin: false },
    maxHttpBufferSize: 10240,
    // M7-C 將透過重新加入 Room + REST 補抓資料實現恢復。
    // 不啟用可能恢復已撤銷權限 Room 的 Connection State Recovery。
    allowRequest: (request, callback) => {
      callback(null, originAllowed(request));
    },
  });

  function sessionFor(socket) {
    return auth.getUserBySession(socket.data.sessionToken);
  }

  io.use((socket, next) => {
    const token = readSessionCookie(socket.handshake.headers.cookie);
    const user = token ? auth.getUserBySession(token) : null;
    if (!user || !originAllowed(socket.request)) {
      const error = new Error("UNAUTHENTICATED");
      error.data = { code: "UNAUTHENTICATED" };
      return next(error);
    }
    socket.data.userId = user.id;
    socket.data.sessionToken = token;
    next();
  });

  io.on("connection", (socket) => {
    socket.on("project:join", (payload, ack) => {
      if (typeof ack !== "function") return;
      if (
        !payload || typeof payload !== "object" || Array.isArray(payload) ||
        Object.keys(payload).length !== 1 ||
        !Object.hasOwn(payload, "projectId") ||
        !positiveId(payload.projectId)
      ) {
        return ack({ ok: false, code: "INVALID_INPUT" });
      }
      if (!sessionFor(socket)) {
        socket.disconnect(true);
        return ack({ ok: false, code: "UNAUTHENTICATED" });
      }
      const projectId = payload.projectId;
      const found = membership.get(projectId, socket.data.userId);
      if (!found) return ack({ ok: false, code: "NOT_FOUND" });
      const joinedProjects = [...socket.rooms].filter((name) =>
        name.startsWith("project:")
      );
      if (
        !socket.rooms.has(roomName(projectId)) &&
        joinedProjects.length >= MAX_ROOMS_PER_SOCKET
      ) {
        return ack({ ok: false, code: "ROOM_LIMIT" });
      }
      socket.join(roomName(projectId));
      return ack({ ok: true, projectId, role: found.role });
    });

    socket.on("project:leave", (payload, ack) => {
      if (typeof ack !== "function") return;
      if (!payload || !positiveId(payload.projectId) ||
          Object.keys(payload).length !== 1) {
        return ack({ ok: false, code: "INVALID_INPUT" });
      }
      socket.leave(roomName(payload.projectId));
      return ack({ ok: true, projectId: payload.projectId });
    });
  });

  // 只讓伺服器內部呼叫；M7-B 將於成功 COMMIT 後使用。
  // 發送前再次查詢 Session 和專案成員，以防長連線持有過期權限。
  function publishProjectChanged(projectId, change) {
    if (!positiveId(projectId)) throw new TypeError("projectId 不合法。");
    if (
      !change || typeof change !== "object" || Array.isArray(change) ||
      /* M8-C3-BEGIN */ !["task", "member", "project", "comment"].includes(change.resource) ||
      !["created", "updated", "deleted", "moved"].includes(change.action) ||
      (change.resourceId !== undefined && !positiveId(change.resourceId)) ||
      (change.version !== undefined && !positiveId(change.version)) ||
      Object.keys(change).some((key) =>
        !["resource", "action", "resourceId", "version"].includes(key)
      )
    ) {
      throw new TypeError("即時事件欄位不合法。");
    }

    const room = roomName(projectId);
    const recipients = io.sockets.adapter.rooms.get(room);
    let delivered = 0;
    if (!recipients) return 0;
    const event = Object.freeze({ projectId, ...change, at: new Date().toISOString() });
    for (const socketId of [...recipients]) {
      const socket = io.sockets.sockets.get(socketId);
      if (!socket) continue;
      if (!sessionFor(socket)) {
        socket.disconnect(true);
        continue;
      }
      if (!membership.get(projectId, socket.data.userId)) {
        socket.leave(room);
        socket.emit("project:access-revoked", { projectId });
        continue;
      }
      socket.emit("project:changed", event);
      delivered += 1;
    }
    return delivered;
  }

  return { io, publishProjectChanged };
}

module.exports = {
  readSessionCookie,
  positiveId,
  originAllowed,
  attachRealtime,
};
