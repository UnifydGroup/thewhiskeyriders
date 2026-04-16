-- Import Morocco 2027 trip transactions
-- This migration loads transaction data from the payment tracker Excel file

-- First, let's get the Morocco trip ID
WITH morocco_trip AS (
  SELECT id FROM trips WHERE name = 'Morocco 2027' LIMIT 1
)

-- Insert transactions, matching member names to user IDs
INSERT INTO member_payments (
  member_id,
  trip_id,
  payment_date,
  amount,
  payment_method,
  notes
)
-- Robert Wentworth Norman - 3 transactions
SELECT
  p.id,
  (SELECT id FROM morocco_trip),
  '2025-07-27'::date,
  500.00,
  'bank_transfer',
  'Morocco 2027 trip payment'
FROM profiles p WHERE p.full_name ILIKE '%Robert Wentworth Norman%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-09-28'::date, 750.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Robert Wentworth Norman%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2026-02-15'::date, 750.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Robert Wentworth Norman%'

-- Daniel Mark Morgan - 4 transactions
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-07-27'::date, 500.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Daniel Mark Morgan%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-10-12'::date, 500.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Daniel Mark Morgan%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-12-08'::date, 500.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Daniel Mark Morgan%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2026-03-02'::date, 500.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Daniel Mark Morgan%'

-- Kristian Hugh Spencer - 3 transactions
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-07-27'::date, 500.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Kristian Hugh Spencer%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-11-10'::date, 500.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Kristian Hugh Spencer%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2026-03-15'::date, 1000.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Kristian Hugh Spencer%'

-- Thomas Kowalczuk - 3 transactions
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-07-27'::date, 500.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Thomas Kowalczuk%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-09-14'::date, 750.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Thomas Kowalczuk%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2026-01-20'::date, 750.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Thomas Kowalczuk%'

-- Travis Tierney - 3 transactions
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-07-27'::date, 500.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Travis Tierney%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-11-03'::date, 750.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Travis Tierney%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2026-02-22'::date, 750.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Travis Tierney%'

-- Jonathon Brauer - 3 transactions
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-07-27'::date, 500.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Jonathon Brauer%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-10-26'::date, 750.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Jonathon Brauer%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2026-01-15'::date, 750.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Jonathon Brauer%'

-- Simon Lewis Dakin - 2 transactions
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-07-27'::date, 500.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Simon Lewis Dakin%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-12-21'::date, 750.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Simon Lewis Dakin%'

-- Will David Clifford - 3 transactions
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-07-28'::date, 500.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Will David Clifford%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-11-16'::date, 750.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Will David Clifford%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2026-02-28'::date, 750.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Will David Clifford%'

-- Reid Ballingall - 3 transactions
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-07-28'::date, 500.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Reid Ballingall%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-10-19'::date, 1500.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Reid Ballingall%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2026-03-09'::date, 2000.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Reid Ballingall%'

-- Matthew James Hampton - 4 transactions
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-07-30'::date, 500.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Matthew James Hampton%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-08-05'::date, 500.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Matthew James Hampton%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-12-14'::date, 625.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Matthew James Hampton%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2026-01-26'::date, 625.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Matthew James Hampton%'

-- Andreas Emmanuel Gloor - 9 transactions
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-08-03'::date, 500.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andreas Emmanuel Gloor%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-08-28'::date, 500.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andreas Emmanuel Gloor%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-09-18'::date, 500.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andreas Emmanuel Gloor%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-10-05'::date, 100.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andreas Emmanuel Gloor%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-11-22'::date, 100.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andreas Emmanuel Gloor%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-12-09'::date, 200.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andreas Emmanuel Gloor%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2026-01-12'::date, 200.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andreas Emmanuel Gloor%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2026-02-01'::date, 200.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andreas Emmanuel Gloor%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2026-03-04'::date, 200.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andreas Emmanuel Gloor%'

-- Campbell Stafford harris - 3 transactions
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-09-01'::date, 500.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Campbell Stafford%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-11-09'::date, 875.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Campbell Stafford%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2026-02-11'::date, 875.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Campbell Stafford%'

-- Hamish Richard Gordon - 3 transactions
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-09-01'::date, 500.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Hamish Richard Gordon%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-11-23'::date, 750.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Hamish Richard Gordon%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2026-03-01'::date, 750.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Hamish Richard Gordon%'

-- Andrew Lewis - 3 transactions
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-09-01'::date, 500.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andrew Lewis%' AND p.full_name NOT ILIKE '%Andrew knight%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-09-29'::date, 750.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andrew Lewis%' AND p.full_name NOT ILIKE '%Andrew knight%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2026-01-08'::date, 750.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andrew Lewis%' AND p.full_name NOT ILIKE '%Andrew knight%'

-- Andrew knight - 25 transactions
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-09-07'::date, 200.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-09-14'::date, 200.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-09-21'::date, 200.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-09-28'::date, 200.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-10-05'::date, 200.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-10-12'::date, 200.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-10-19'::date, 200.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-10-26'::date, 100.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-11-02'::date, 100.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-11-09'::date, 100.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-11-16'::date, 100.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-11-23'::date, 100.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-11-30'::date, 100.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-12-07'::date, 100.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-12-14'::date, 100.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-12-21'::date, 100.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-12-28'::date, 100.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2026-01-04'::date, 100.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2026-01-11'::date, 100.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2026-01-18'::date, 100.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2026-01-25'::date, 150.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2026-02-01'::date, 200.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'

-- Christian Stefan Doyle - 1 transaction
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2025-09-29'::date, 1250.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Christian Stefan Doyle%'

-- Simon Gallagher - 1 transaction
UNION ALL
SELECT p.id, (SELECT id FROM morocco_trip), '2026-03-08'::date, 2000.00, 'bank_transfer', 'Morocco 2027 trip payment' FROM profiles p WHERE p.full_name ILIKE '%Simon Gallagher%'

ON CONFLICT DO NOTHING;
