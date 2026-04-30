-- Fix: "new row violates row-level security policy for table habit_history"
-- Run this in Supabase → SQL Editor (once per project).
-- Assumes: public.habits(id, user_id, ...) and public.habit_history(habit_id, date, value, ...).

ALTER TABLE public.habit_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "habit_history_select_own" ON public.habit_history;
DROP POLICY IF EXISTS "habit_history_insert_own" ON public.habit_history;
DROP POLICY IF EXISTS "habit_history_update_own" ON public.habit_history;
DROP POLICY IF EXISTS "habit_history_delete_own" ON public.habit_history;

-- Read history only for habits owned by the signed-in user
CREATE POLICY "habit_history_select_own"
ON public.habit_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.habits h
    WHERE h.id = habit_history.habit_id
      AND h.user_id = auth.uid()
  )
);

-- Log / upsert rows only when the habit belongs to the current user
CREATE POLICY "habit_history_insert_own"
ON public.habit_history
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.habits h
    WHERE h.id = habit_history.habit_id
      AND h.user_id = auth.uid()
  )
);

CREATE POLICY "habit_history_update_own"
ON public.habit_history
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.habits h
    WHERE h.id = habit_history.habit_id
      AND h.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.habits h
    WHERE h.id = habit_history.habit_id
      AND h.user_id = auth.uid()
  )
);

CREATE POLICY "habit_history_delete_own"
ON public.habit_history
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.habits h
    WHERE h.id = habit_history.habit_id
      AND h.user_id = auth.uid()
  )
);
