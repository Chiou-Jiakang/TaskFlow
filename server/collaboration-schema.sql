-- TaskFlow M8-A: incremental collaboration data schema.
-- This script never drops or recreates existing project/task data.
-- Apply only after the M2 project schema and M5 task schema exist.

CREATE TABLE IF NOT EXISTS task_comments (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  task_id INTEGER NOT NULL,
  author_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (
    (is_deleted = 0 AND length(trim(body)) BETWEEN 1 AND 2000)
    OR (is_deleted = 1 AND body = '')
  ),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task
  ON task_comments(project_id, task_id, is_deleted, id DESC);

-- task_id is globally unique, but the redundant project_id also needs protection.
-- Prevent SQL clients from associating comments with another project's task.
CREATE TRIGGER IF NOT EXISTS trg_comment_project_match_insert
BEFORE INSERT ON task_comments
WHEN NOT EXISTS (
  SELECT 1 FROM tasks WHERE id = NEW.task_id AND project_id = NEW.project_id
)
BEGIN
  SELECT RAISE(ABORT, 'TASK_PROJECT_MISMATCH');
END;

CREATE TRIGGER IF NOT EXISTS trg_comment_project_match_update
BEFORE UPDATE OF project_id, task_id ON task_comments
WHEN NOT EXISTS (
  SELECT 1 FROM tasks WHERE id = NEW.task_id AND project_id = NEW.project_id
)
BEGIN
  SELECT RAISE(ABORT, 'TASK_PROJECT_MISMATCH');
END;

-- The activity log contains metadata only, never private comment bodies.
CREATE TABLE IF NOT EXISTS project_activity (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL,
  actor_id INTEGER,
  task_id INTEGER,
  comment_id INTEGER,
  action TEXT NOT NULL CHECK (
    action IN ('comment_created', 'comment_updated', 'comment_deleted')
  ),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
  FOREIGN KEY (comment_id) REFERENCES task_comments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_project_activity_project
  ON project_activity(project_id, id DESC);
