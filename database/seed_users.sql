-- ============================================================
-- Seed: App Users
-- ============================================================

INSERT INTO users (id, supabase_uid, name, email, role) VALUES
  (
    gen_random_uuid(),
    'd6fd9305-0cbd-40bd-bbc2-58ac22482eb3',
    'Ofir',
    'ofir08@gmail.com',
    'owner'
  )
ON CONFLICT (email) DO NOTHING;
