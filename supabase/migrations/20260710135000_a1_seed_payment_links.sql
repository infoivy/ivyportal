-- A1: Seed payment links (Whop checkout links + Wise + Revolut)
-- Visible to closers + admins only (existing RLS policy covers this).
-- Data provided by Abdulrahman on Jul 10, 2026.

INSERT INTO public.payment_links (label, currency, amount, url, method, notes, sort_order)
VALUES
  -- Whop checkout links
  ('Whop $100',  'USD', 100,  'https://whop.com/checkout/plan_SS2FyIccs9w7m', 'whop', NULL, 10),
  ('Whop $200',  'USD', 200,  'https://whop.com/checkout/plan_hxke4MtN8rIy8', 'whop', NULL, 20),
  ('Whop $300',  'USD', 300,  'https://whop.com/checkout/plan_NUWTm0STkJhLu', 'whop', NULL, 30),
  ('Whop $400',  'USD', 400,  'https://whop.com/checkout/plan_KhJahWG94Esn1', 'whop', NULL, 40),
  ('Whop $500',  'USD', 500,  'https://whop.com/checkout/plan_sWXNMK93z07Ws', 'whop', NULL, 50),
  ('Whop $600',  'USD', 600,  'https://whop.com/checkout/plan_999lM6Xldtkg7', 'whop', NULL, 60),
  ('Whop $700',  'USD', 700,  'https://whop.com/checkout/plan_endfIMeJnrl25', 'whop', NULL, 70),
  ('Whop $800',  'USD', 800,  'https://whop.com/checkout/plan_ZURfMVcKFQefw', 'whop', NULL, 80),
  ('Whop $900',  'USD', 900,  'https://whop.com/checkout/plan_iNjU0Fyi6rpGd', 'whop', NULL, 90),
  ('Whop $1,000','USD', 1000, 'https://whop.com/checkout/plan_X732xt1bLXdIM', 'whop', NULL, 100),
  ('Whop $1,500','USD', 1500, 'https://whop.com/checkout/plan_wC9EbVwaUxS8W', 'whop', NULL, 110),
  ('Whop $2,000','USD', 2000, 'https://whop.com/checkout/plan_WsU1dWjiKDEKb', 'whop', NULL, 120),
  ('Whop $2,500','USD', 2500, 'https://whop.com/checkout/plan_aIxue4errEJvx', 'whop', NULL, 130),

  -- Wise USD (bank transfer from US)
  (
    'Wise — USD Bank Transfer',
    'USD',
    NULL,
    NULL,
    'wise',
    E'Name: Saroz Kader\nAccount type: Deposit\nRouting number (wire & ACH): 084009519\nAccount number: 646990392864702\nAddress: Wise US Inc, 108 W 13th St, Wilmington, DE, 19801, United States\nSwift/BIC (outside US): TRWIUS35XXX',
    200
  ),

  -- Wise EUR (SEPA)
  (
    'Wise — EUR SEPA',
    'EUR',
    NULL,
    NULL,
    'wise',
    E'Name: Saroz Kader\nIBAN: BE50 9052 4673 0318\nSwift/BIC (outside SEPA): TRWIBEB1XXX\nAddress: Wise, Rue du Trône 100, 3rd floor, Brussels, 1050, Belgium',
    210
  ),

  -- Revolut payment link
  (
    'Revolut — Payment Link',
    'EUR',
    NULL,
    'https://revolut.me/sarozk',
    'bank',
    NULL,
    300
  ),

  -- Revolut EUR bank transfer
  (
    'Revolut — EUR Bank Transfer',
    'EUR',
    NULL,
    NULL,
    'bank',
    E'Beneficiary: Saroz Kader\nIBAN: NL24 REVO 3551 4778 41\nBIC: REVONL22\nBank: Revolut Bank UAB, Barbara Strozzilaan 201, 1083 HN, Amsterdam, Netherlands\nCorrespondent BIC: CHASDEFX',
    310
  )
ON CONFLICT DO NOTHING;
