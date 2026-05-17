-- Run once in Supabase → SQL Editor (fixes "account not found" on forgot password)
CREATE OR REPLACE FUNCTION public.email_exists_for_reset(check_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.email IS NOT NULL
      AND lower(trim(u.email)) = lower(trim(check_email))
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.email IS NOT NULL
      AND lower(trim(p.email)) = lower(trim(check_email))
  );
$$;

REVOKE ALL ON FUNCTION public.email_exists_for_reset(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_exists_for_reset(text) TO anon;
GRANT EXECUTE ON FUNCTION public.email_exists_for_reset(text) TO authenticated;
