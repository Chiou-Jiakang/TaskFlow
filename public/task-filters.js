"use strict";

(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.TaskFilters = api;
  }
})(typeof window !== "undefined" ? window : null, function () {
  const statuses = new Set(["todo", "in_progress", "done"]);
  const priorities = new Set(["low", "medium", "high"]);

  function filterTasks(tasks, filters = {}) {
    if (!Array.isArray(tasks)) {
      throw new TypeError("tasks 必須是陣列");
    }

    const keyword = String(filters.keyword ?? "")
      .trim()
      .toLocaleLowerCase();

    const status = String(filters.status ?? "");
    const priority = String(filters.priority ?? "");
    const assignee = String(filters.assignee ?? "");

    if (status && !statuses.has(status)) return [];
    if (priority && !priorities.has(priority)) return [];

    if (assignee && assignee !== "unassigned" && !/^[1-9]\d*$/.test(assignee)) {
      return [];
    }

    return tasks.filter((task) => {
      const searchable = [task.title ?? "", task.description ?? ""]
        .join(" ")
        .toLocaleLowerCase();

      if (keyword && !searchable.includes(keyword)) {
        return false;
      }

      if (status && task.status !== status) {
        return false;
      }

      if (priority && task.priority !== priority) {
        return false;
      }

      if (assignee === "unassigned") {
        return task.assigneeId == null;
      }

      if (assignee && String(task.assigneeId) !== assignee) {
        return false;
      }

      return true;
    });
  }

  return { filterTasks };
});
