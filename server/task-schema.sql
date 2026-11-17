-- TaskFlow M5-A: additive task schema.
-- Keep M2 schema.sql and M3 auth-schema.sql unchanged.

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 120),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo', 'in_progress', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),
  assignee_id INTEGER,
  due_date TEXT CHECK (
    due_date IS NULL OR (
      length(due_date) = 10 AND
      due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
    )
  ),
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, assignee_id)
    REFERENCES project_members(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_project_board
  ON tasks(project_id, status, position, id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_assignee
  ON tasks(project_id, assignee_id);

-- When a project member leaves/is removed, existing tasks remain but
-- the assignment is cleared. Update task version to invalidate stale edits.
CREATE TRIGGER IF NOT EXISTS trg_tasks_unassign_on_member_delete
BEFORE DELETE ON project_members
BEGIN
  UPDATE tasks
  SET assignee_id = NULL,
      version = version + 1,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE project_id = OLD.project_id
    AND assignee_id = OLD.user_id;
END;