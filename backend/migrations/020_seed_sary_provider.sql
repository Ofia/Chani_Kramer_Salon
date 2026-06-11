-- Migration 020: Add Sary wig company provider
INSERT INTO providers (name, provider_type, is_active)
VALUES ('Sary', 'wig_company', true)
ON CONFLICT DO NOTHING;
