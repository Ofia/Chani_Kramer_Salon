-- Migration 031: seed real employees from Tzipora's spreadsheet
-- Run AFTER 030_employee_fields.sql
-- Uses ON CONFLICT (timedoc_number) to upsert — safe to re-run

INSERT INTO employees (id, first_name, last_name, job_title, pay_type, hourly_rate, weekly_rate, email, timedoc_number, commission_rules, is_active)
VALUES
  (gen_random_uuid(), 'Vicky',      '',       'Stylist',     'hourly',      35,    NULL, 'vb927@aol.com',                   1,  '[]',                                                              true),
  (gen_random_uuid(), 'Tzipora',    '',       'Bookkeeper',  'hourly',      43,    NULL, 'billing.ckwigs@gmail.com',         4,  '[]',                                                              true),
  (gen_random_uuid(), 'Ariella',    '',       'Stylist',     'hourly',      32,    NULL, 'ariellahoch@gmail.com',            5,  '[{"label":"Wash and Set","amount":13},{"label":"Reset","amount":8}]',   true),
  (gen_random_uuid(), 'Dominga',    '',       'Stylist',     'hourly',      26,    NULL, 'domingap425@gmail.com',            6,  '[]',                                                              true),
  (gen_random_uuid(), 'Alla',       '',       'Stylist',     'hourly',      35,    NULL, 'Allashusterman18@gmail.com',       7,  '[]',                                                              true),
  (gen_random_uuid(), 'Raizy',      '',       'Stylist',     'hourly',      41,    NULL, 'Raizygoldstein@yahoo.com',        10,  '[]',                                                              true),
  (gen_random_uuid(), 'Chaya Suri', '',       'Stylist',     'weekly_flat', NULL, 1100, 'goingon18@gmail.com',             11,  '[]',                                                              true),
  (gen_random_uuid(), 'Roxanna',    '',       'Stylist',     'hourly',      32,    NULL, 'emiliarox28@gmail.com',           21,  '[]',                                                              true),
  (gen_random_uuid(), 'Karla',      '',       'Stylist',     'hourly',      24,    NULL, 'Karlasoto5500@gmail.com',         26,  '[]',                                                              true),
  (gen_random_uuid(), 'Chavy',      '',       'Sales Rep',   'hourly',      20,    NULL, 'Chavymshop@yahoo.com',            30,  '[{"label":"Wig","amount":75},{"label":"Fall","amount":25}]',     true),
  (gen_random_uuid(), 'Perela',     'Genuth', 'Stylist',     'hourly',      26,    NULL, 'Pegenuth@gmail.com',              31,  '[]',                                                              true),
  (gen_random_uuid(), 'Perela',     'Kohn',   'Stylist',     'hourly',      23,    NULL, 'Pearlk6003@gmail.com',            33,  '[]',                                                              true)
ON CONFLICT (timedoc_number) DO UPDATE SET
  first_name        = EXCLUDED.first_name,
  last_name         = EXCLUDED.last_name,
  job_title         = EXCLUDED.job_title,
  pay_type          = EXCLUDED.pay_type,
  hourly_rate       = EXCLUDED.hourly_rate,
  weekly_rate       = EXCLUDED.weekly_rate,
  email             = EXCLUDED.email,
  commission_rules  = EXCLUDED.commission_rules,
  is_active         = EXCLUDED.is_active;
