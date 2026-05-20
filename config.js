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

  supabaseUrl:  "https://dfichurseuthmdehhgyt.supabase.co",


  supabaseKey:  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmaWNodXJzZXV0aG1kZWhoZ3l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzOTk4NzAsImV4cCI6MjA5MDk3NTg3MH0.j0Li7WMaBpU5qHEQ_e6rflIK9KE4Fhlb_Q9O_RWzrig",


  adminPasswordHash: "ed15095434babb52daf8f4a9577a8cabc489647f0ba71a064b5131f3d3a56323",

 // supabaseUrl: "https://YOUR_PROJECT_ID.supabase.co",

  /**
   * Supabase ANON (public) key  ← used by the website (safe to expose)
   * Where to find it: Supabase dashboard → Settings → API → anon / public
   * This key can only read data — it cannot write unless you allow it via RLS.
   */
  //supabaseKey: "YOUR_ANON_KEY_HERE",

  /**
   * SHA-256 hash of your admin password.
   * The plain-text password is NEVER stored — only this hash.
   *
   * How to generate:
   *   1. Open any browser console (F12 → Console)
   *   2. Paste and run:
   *
   *      crypto.subtle.digest("SHA-256", new TextEncoder().encode("your-password"))
   *        .then(b => console.log(Array.from(new Uint8Array(b))
   *          .map(x => x.toString(16).padStart(2,"0")).join("")));
   *
   *   3. Copy the printed hex string and paste it below.
   *
   * The hash below is the SHA-256 of "admin1234" — change it before deploying.
   */
 // adminPasswordHash: "ac9689e2272427085e35b9d3e3e8bed88cb3434828b43b86fc0596cad4c6e270",  // SHA-256 of "admin1234"
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
