ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS fee numeric,
  ADD COLUMN IF NOT EXISTS expenses jsonb;
