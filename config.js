/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║              CONFIGURATION — edit this file              ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Step 1 – Create a free Supabase project at https://supabase.com
 * Step 2 – Run the SQL below in your Supabase SQL editor
 * Step 3 – Paste your project URL and anon key here
 * Step 4 – Choose a strong admin password
 *
 * ── SQL to run in Supabase ──────────────────────────────────
 *
 *   -- 1. Students table
 *   create table students (
 *     id          bigserial primary key,
 *     student_id  text unique not null,
 *     name        text,
 *     class_name  text,
 *     attendance  numeric,
 *     activities  numeric,
 *     midterm     numeric,
 *     project     numeric,
 *     bonus       numeric,
 *     total       numeric
 *   );
 *   alter table students enable row level security;
 *   create policy "public read" on students for select using (true);
 *
 *   -- 2. Access log table
 *   create table access_logs (
 *     id           bigserial primary key,
 *     student_id   text        not null,
 *     student_name text,
 *     checked_at   timestamptz not null default now()
 *   );
 *   alter table access_logs enable row level security;
 *   create policy "allow insert" on access_logs for insert with check (true);
 *   create policy "allow select" on access_logs for select using (true);
 *
 * ────────────────────────────────────────────────────────────
 */

const APP_CONFIG = {
  /**
   * Supabase Project URL
   * Where to find it: Supabase dashboard → Settings → API → Project URL
   * Looks like: https://abcdefghijklmn.supabase.co
   */
  supabaseUrl: "https://YOUR_PROJECT_ID.supabase.co",

  /**
   * Supabase ANON (public) key  ← used by the website (safe to expose)
   * Where to find it: Supabase dashboard → Settings → API → anon / public
   * This key can only read data — it cannot write unless you allow it via RLS.
   */
  supabaseKey: "YOUR_ANON_KEY_HERE",

  /**
   * Admin dashboard password — change this to something strong.
   * Keep this file in a private GitHub repo so it is not publicly visible.
   */
  adminPassword: "admin1234",
};

/*
 * NOTE — the SERVICE ROLE key (for import-to-supabase.js) is NOT stored
 * here because it bypasses Row Level Security and must never be exposed
 * in a browser. Set it only in a .env file on your local machine:
 *
 *   SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
 *   SUPABASE_SERVICE_KEY=your_service_role_key_here
 *
 * The service role key is found at:
 *   Supabase dashboard → Settings → API → service_role (secret)
 */
