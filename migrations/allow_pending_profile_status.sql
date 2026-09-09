-- Fix: self-signup (src/app/api/auth/signup-request/route.ts) sets new profiles to
-- status = 'pending', and the admin approval flow (member edit API, admin dashboard,
-- login gating) already reads/writes 'pending' throughout the app. The DB check
-- constraint was never updated to allow it, so every self-signup failed with:
--   new row for relation "profiles" violates check constraint "profiles_status_check"
--
-- Applied directly to production (project xhapsqyyjrdwczquanxd) on 2026-08-20.
-- This file just documents the change in the migrations history.

ALTER TABLE public.profiles DROP CONSTRAINT profiles_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check
  CHECK (status::text = ANY (ARRAY['active', 'inactive', 'archived', 'pending']::character varying[]::text[]));
