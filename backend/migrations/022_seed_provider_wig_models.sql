-- Migration 022: Seed wig model price rules for all providers
-- Retail = cost + markup_usd (computed at runtime, not stored)

-- ── Rina Wigs ─────────────────────────────────────────────────
UPDATE providers SET wig_models = '[
  {"name": "Lace Top",         "markup_usd": 1670, "lengths": [
    {"length": "11\"",  "cost": 1260},
    {"length": "12\"",  "cost": 1360},
    {"length": "14\"",  "cost": 1660},
    {"length": "16\"",  "cost": 2000},
    {"length": "17\"",  "cost": 2000},
    {"length": "18\"",  "cost": 2000}
  ]},
  {"name": "Lace Top Curly",   "markup_usd": 1670, "lengths": [
    {"length": "11\"",  "cost": 1460},
    {"length": "12\"",  "cost": 1560},
    {"length": "14\"",  "cost": 1860},
    {"length": "16\"",  "cost": 2200},
    {"length": "17\"",  "cost": 2200},
    {"length": "18\"",  "cost": 2200}
  ]},
  {"name": "Feather",          "markup_usd": 1670, "lengths": [
    {"length": "11\"",  "cost": 1510},
    {"length": "12\"",  "cost": 1610},
    {"length": "14\"",  "cost": 1910},
    {"length": "16\"",  "cost": 2250},
    {"length": "17\"",  "cost": 2250},
    {"length": "18\"",  "cost": 2250}
  ]},
  {"name": "Feather Curly",    "markup_usd": 1670, "lengths": [
    {"length": "11\"",  "cost": 1710},
    {"length": "12\"",  "cost": 1810},
    {"length": "14\"",  "cost": 2110},
    {"length": "16\"",  "cost": 2450},
    {"length": "17\"",  "cost": 2450},
    {"length": "18\"",  "cost": 2450}
  ]},
  {"name": "Skin Top",         "markup_usd": 1400, "lengths": [
    {"length": "11\"",  "cost": 1260},
    {"length": "12\"",  "cost": 1360},
    {"length": "14\"",  "cost": 1660},
    {"length": "16\"",  "cost": 2000},
    {"length": "17\"",  "cost": 2000},
    {"length": "18\"",  "cost": 2000}
  ]},
  {"name": "Elite - Lacetop Brown",  "markup_usd": 1800, "lengths": [
    {"length": "11\"",     "cost": 3900},
    {"length": "12\"",     "cost": 3900},
    {"length": "14\"-17\"","cost": 4100},
    {"length": "18\"+",    "cost": 4600}
  ]},
  {"name": "Elite - Lacetop Blonde", "markup_usd": 1800, "lengths": [
    {"length": "11\"",     "cost": 4200},
    {"length": "12\"",     "cost": 4200},
    {"length": "14\"-17\"","cost": 4400},
    {"length": "18\"+",    "cost": 4900}
  ]},
  {"name": "Elite - Curly Brown",    "markup_usd": 1800, "lengths": [
    {"length": "11\"",     "cost": 4100},
    {"length": "12\"",     "cost": 4100},
    {"length": "14\"-17\"","cost": 4300},
    {"length": "18\"+",    "cost": 4800}
  ]},
  {"name": "Elite - Curly Blonde",   "markup_usd": 1800, "lengths": [
    {"length": "11\"",     "cost": 4400},
    {"length": "12\"",     "cost": 4400},
    {"length": "14\"-17\"","cost": 4600},
    {"length": "18\"+",    "cost": 5100}
  ]},
  {"name": "Fall",             "markup_usd": 750, "lengths": [
    {"length": "14\"",    "cost": 1075},
    {"length": "16\"-18\"","cost": 1125}
  ]},
  {"name": "Fall Curly",       "markup_usd": 750, "lengths": [
    {"length": "14\"",    "cost": 1275},
    {"length": "16\"-18\"","cost": 1325}
  ]}
]'::jsonb
WHERE name = 'Rina Wigs';

-- ── Sary Wigs ──────────────────────────────────────────────────
UPDATE providers SET wig_models = '[
  {"name": "Classic (Skin Top)", "markup_usd": 1400, "lengths": [
    {"length": "Shorties",         "cost": 490},
    {"length": "10\"",             "cost": 760},
    {"length": "11\"",             "cost": 760},
    {"length": "12\"",             "cost": 950},
    {"length": "12\" Blunt",       "cost": 1150},
    {"length": "14\"-15\"",        "cost": 1400},
    {"length": "14\"-15\" Blunt",  "cost": 1600},
    {"length": "16\"-18\"",        "cost": 1800},
    {"length": "16\"-18\" Blunt",  "cost": 2100}
  ]},
  {"name": "Lace Top",           "markup_usd": 1670, "lengths": [
    {"length": "11\"",             "cost": 1260},
    {"length": "12\"",             "cost": 1360},
    {"length": "12\" Blunt",       "cost": 1560},
    {"length": "14\"",             "cost": 1660},
    {"length": "14\" Blunt",       "cost": 1860},
    {"length": "16\"-18\"",        "cost": 2000},
    {"length": "16\"-18\" Blunt",  "cost": 2200}
  ]},
  {"name": "Fall",               "markup_usd": 750, "lengths": [
    {"length": "14\"",             "cost": 875},
    {"length": "16\"-18\"",        "cost": 1025},
    {"length": "20\"",             "cost": 1125}
  ]}
]'::jsonb
WHERE name = 'Sary';

-- ── BK Finest Natural Wigs ─────────────────────────────────────
UPDATE providers SET wig_models = '[
  {"name": "Skin (Cap 2/4/5/6)",      "markup_usd": 1500, "lengths": [
    {"length": "10\"","cost": 2770}, {"length": "12\"","cost": 3100}, {"length": "15\"","cost": 3150},
    {"length": "20\"","cost": 3250}, {"length": "25\"","cost": 3450}, {"length": "30\"","cost": 3700},
    {"length": "35\"","cost": 3950}, {"length": "40\"","cost": 4300}, {"length": "45\"","cost": 4500}
  ]},
  {"name": "Airy Skin (Cap 2/4/5/6)", "markup_usd": 1500, "lengths": [
    {"length": "10\"","cost": 3120}, {"length": "12\"","cost": 3450}, {"length": "15\"","cost": 3500},
    {"length": "20\"","cost": 3600}, {"length": "25\"","cost": 3800}, {"length": "30\"","cost": 4050},
    {"length": "35\"","cost": 4300}, {"length": "40\"","cost": 4650}, {"length": "45\"","cost": 4850}
  ]},
  {"name": "Lace Top (Cap 2/4/5/6)",  "markup_usd": 1500, "lengths": [
    {"length": "10\"","cost": 4145}, {"length": "12\"","cost": 4475}, {"length": "15\"","cost": 4525},
    {"length": "20\"","cost": 4625}, {"length": "25\"","cost": 4825}, {"length": "30\"","cost": 5075},
    {"length": "35\"","cost": 5325}, {"length": "40\"","cost": 5675}, {"length": "45\"","cost": 5875}
  ]},
  {"name": "Skin (Cap 6/8)",          "markup_usd": 1500, "lengths": [
    {"length": "10\"","cost": 2820}, {"length": "12\"","cost": 3250}, {"length": "15\"","cost": 3400},
    {"length": "20\"","cost": 3500}, {"length": "25\"","cost": 3700}, {"length": "30\"","cost": 3930},
    {"length": "35\"","cost": 4230}, {"length": "40\"","cost": 4550}, {"length": "45\"","cost": 4740}
  ]},
  {"name": "Airy Skin (Cap 6/8)",     "markup_usd": 1500, "lengths": [
    {"length": "10\"","cost": 3170}, {"length": "12\"","cost": 3600}, {"length": "15\"","cost": 3750},
    {"length": "20\"","cost": 3850}, {"length": "25\"","cost": 4050}, {"length": "30\"","cost": 4280},
    {"length": "35\"","cost": 4580}, {"length": "40\"","cost": 4900}, {"length": "45\"","cost": 5090}
  ]},
  {"name": "Lace Top (Cap 6/8)",      "markup_usd": 1500, "lengths": [
    {"length": "10\"","cost": 4125}, {"length": "12\"","cost": 4625}, {"length": "15\"","cost": 4775},
    {"length": "20\"","cost": 4875}, {"length": "25\"","cost": 5075}, {"length": "30\"","cost": 5305},
    {"length": "35\"","cost": 5605}, {"length": "40\"","cost": 5925}, {"length": "45\"","cost": 6115}
  ]},
  {"name": "Skin (Cap 7/8)",          "markup_usd": 1500, "lengths": [
    {"length": "10\"","cost": 3030}, {"length": "12\"","cost": 3400}, {"length": "15\"","cost": 3550},
    {"length": "20\"","cost": 3650}, {"length": "25\"","cost": 4000}, {"length": "30\"","cost": 4700},
    {"length": "35\"","cost": 5000}, {"length": "40\"","cost": 5270}, {"length": "45\"","cost": 5550}
  ]},
  {"name": "Airy Skin (Cap 7/8)",     "markup_usd": 1500, "lengths": [
    {"length": "10\"","cost": 3380}, {"length": "12\"","cost": 3750}, {"length": "15\"","cost": 3900},
    {"length": "20\"","cost": 4000}, {"length": "25\"","cost": 4350}, {"length": "30\"","cost": 5050},
    {"length": "35\"","cost": 5350}, {"length": "40\"","cost": 5620}, {"length": "45\"","cost": 5900}
  ]},
  {"name": "Lace Top (Cap 7/8)",      "markup_usd": 1500, "lengths": [
    {"length": "10\"","cost": 4405}, {"length": "12\"","cost": 4775}, {"length": "15\"","cost": 4925},
    {"length": "20\"","cost": 5025}, {"length": "25\"","cost": 5375}, {"length": "30\"","cost": 6075},
    {"length": "35\"","cost": 6375}, {"length": "40\"","cost": 6645}, {"length": "45\"","cost": 6925}
  ]},
  {"name": "Skin (Cap 33)",           "markup_usd": 1500, "lengths": [
    {"length": "10\"","cost": 3230}, {"length": "12\"","cost": 3600}, {"length": "15\"","cost": 3750},
    {"length": "20\"","cost": 3850}, {"length": "25\"","cost": 4200}, {"length": "30\"","cost": 4900},
    {"length": "35\"","cost": 5200}, {"length": "40\"","cost": 5470}, {"length": "45\"","cost": 5750}
  ]},
  {"name": "Airy Skin (Cap 33)",      "markup_usd": 1500, "lengths": [
    {"length": "10\"","cost": 3580}, {"length": "12\"","cost": 3950}, {"length": "15\"","cost": 4100},
    {"length": "20\"","cost": 4200}, {"length": "25\"","cost": 4550}, {"length": "30\"","cost": 5250},
    {"length": "35\"","cost": 5550}, {"length": "40\"","cost": 5820}, {"length": "45\"","cost": 6100}
  ]},
  {"name": "Lace Top (Cap 33)",       "markup_usd": 1500, "lengths": [
    {"length": "10\"","cost": 4605}, {"length": "12\"","cost": 4975}, {"length": "15\"","cost": 5125},
    {"length": "20\"","cost": 5225}, {"length": "25\"","cost": 5575}, {"length": "30\"","cost": 6275},
    {"length": "35\"","cost": 6575}, {"length": "40\"","cost": 6845}, {"length": "45\"","cost": 7125}
  ]}
]'::jsonb
WHERE name = 'BK Wigs';

-- ── Rochi Lipsker ──────────────────────────────────────────────
UPDATE providers SET wig_models = '[
  {"name": "Dark Color", "markup_usd": 1500, "lengths": [
    {"length": "3\"-10\"",  "cost": 4600},
    {"length": "11\"-15\"", "cost": 5100},
    {"length": "16\"-22\"", "cost": 5500},
    {"length": "23\"-27\"", "cost": 6200},
    {"length": "28\"-30\"", "cost": 6900},
    {"length": "31\"-35\"", "cost": 7500},
    {"length": "36\"-39\"", "cost": 7800},
    {"length": "40\"-45\"", "cost": 8500}
  ]},
  {"name": "Light Color", "markup_usd": 1500, "lengths": [
    {"length": "3\"-10\"",  "cost": 5100},
    {"length": "11\"-15\"", "cost": 5500},
    {"length": "16\"-22\"", "cost": 6200},
    {"length": "23\"-27\"", "cost": 6800},
    {"length": "28\"-30\"", "cost": 7600},
    {"length": "31\"-35\"", "cost": 8200},
    {"length": "36\"-39\"", "cost": 8600},
    {"length": "40\"-45\"", "cost": 9300}
  ]}
]'::jsonb
WHERE name = 'Rochi Lipsker';
