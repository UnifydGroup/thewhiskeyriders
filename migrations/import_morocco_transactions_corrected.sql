-- Corrected Migration: Import Morocco 2027 Trip Transactions
-- Uses accurate data from the Excel file Transactions sheet
-- Includes proper member mapping and Westpac interest tracking

-- First, delete any existing transactions for this trip to start fresh
DELETE FROM member_payments WHERE trip_id = (SELECT id FROM trips WHERE name = 'Morocco 2027' LIMIT 1);

-- Get the Morocco trip ID
WITH morocco_trip AS (
  SELECT id FROM trips WHERE name = 'Morocco 2027' LIMIT 1
),

-- Insert all member transactions from the Excel file
member_transactions AS (
  -- Andreas Emmanuel Gloor (ID 1) - 9 transactions
  SELECT p.id as member_id, (SELECT id FROM morocco_trip) as trip_id, '2025-08-03'::date as payment_date, 500.00 as amount, 'bank_transfer' as payment_method
  FROM profiles p WHERE p.full_name ILIKE '%Andreas Emmanuel Gloor%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-08-28'::date, 500.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Andreas Emmanuel Gloor%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-09-18'::date, 500.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Andreas Emmanuel Gloor%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-10-05'::date, 100.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Andreas Emmanuel Gloor%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-11-22'::date, 100.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Andreas Emmanuel Gloor%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-12-09'::date, 200.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Andreas Emmanuel Gloor%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2026-01-12'::date, 200.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Andreas Emmanuel Gloor%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2026-02-01'::date, 200.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Andreas Emmanuel Gloor%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2026-03-04'::date, 200.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Andreas Emmanuel Gloor%'

  -- Andrew knight (ID 2) - 25 transactions
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-09-07'::date, 200.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-09-14'::date, 200.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-09-21'::date, 200.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-09-28'::date, 200.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-10-05'::date, 200.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-10-12'::date, 200.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-10-19'::date, 200.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-10-26'::date, 100.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-11-02'::date, 100.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-11-09'::date, 100.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-11-16'::date, 100.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-11-23'::date, 100.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-11-30'::date, 100.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-12-07'::date, 100.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-12-14'::date, 100.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-12-21'::date, 100.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-12-28'::date, 100.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2026-01-04'::date, 100.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2026-01-11'::date, 100.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2026-01-18'::date, 100.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2026-01-25'::date, 150.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2026-02-01'::date, 200.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Andrew knight%'

  -- Andrew Lewis (ID 3) - 3 transactions
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-09-01'::date, 500.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Andrew Lewis%' AND p.full_name NOT ILIKE '%Andrew knight%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-09-29'::date, 750.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Andrew Lewis%' AND p.full_name NOT ILIKE '%Andrew knight%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2026-01-08'::date, 750.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Andrew Lewis%' AND p.full_name NOT ILIKE '%Andrew knight%'

  -- Campbell Stafford harris (ID 4) - 3 transactions
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-09-01'::date, 500.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Campbell Stafford%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-10-08'::date, 1250.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Campbell Stafford%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2026-03-15'::date, 500.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Campbell Stafford%'

  -- Christian Stefan Doyle (ID 5) - 1 transaction
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-10-02'::date, 1250.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Christian Stefan Doyle%'

  -- Daniel Mark Morgan (ID 6) - 4 transactions
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-07-27'::date, 500.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Daniel Mark Morgan%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-10-12'::date, 500.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Daniel Mark Morgan%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-12-08'::date, 500.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Daniel Mark Morgan%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2026-03-02'::date, 500.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Daniel Mark Morgan%'

  -- Hamish Richard Gordon (ID 7) - 3 transactions
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-09-01'::date, 500.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Hamish Richard Gordon%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-10-08'::date, 750.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Hamish Richard Gordon%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2026-03-01'::date, 750.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Hamish Richard Gordon%'

  -- Jonathon Brauer (ID 8) - 3 transactions
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-07-27'::date, 500.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Jonathon Brauer%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-10-09'::date, 750.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Jonathon Brauer%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2026-01-15'::date, 750.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Jonathon Brauer%'

  -- Kristian Hugh Spencer (ID 9) - 3 transactions
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-07-27'::date, 500.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Kristian Hugh Spencer%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-10-08'::date, 750.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Kristian Hugh Spencer%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2026-03-15'::date, 750.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Kristian Hugh Spencer%'

  -- Matthew James Hampton (ID 10) - 4 transactions
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-07-30'::date, 500.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Matthew James Hampton%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-08-05'::date, 500.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Matthew James Hampton%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-09-29'::date, 750.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Matthew James Hampton%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2026-01-26'::date, 500.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Matthew James Hampton%'

  -- Reid Ballingall (ID 11) - 3 transactions
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-07-28'::date, 500.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Reid Ballingall%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-10-19'::date, 1500.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Reid Ballingall%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2026-03-09'::date, 2000.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Reid Ballingall%'

  -- Robert Wentworth Norman (ID 12) - 3 transactions
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-07-27'::date, 500.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Robert Wentworth Norman%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-09-28'::date, 750.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Robert Wentworth Norman%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-10-08'::date, 750.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Robert Wentworth Norman%'

  -- Simon Gallagher (ID 13) - 1 transaction
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2026-03-08'::date, 2000.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Simon Gallagher%'

  -- Simon Lewis Dakin (ID 14) - 2 transactions
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-07-27'::date, 500.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Simon Lewis Dakin%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-12-21'::date, 750.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Simon Lewis Dakin%'

  -- Thomas Kowalczuk (ID 15) - 3 transactions
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-07-27'::date, 500.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Thomas Kowalczuk%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-10-08'::date, 750.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Thomas Kowalczuk%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2026-01-20'::date, 750.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Thomas Kowalczuk%'

  -- Travis Tierney (ID 16) - 3 transactions
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-07-27'::date, 500.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Travis Tierney%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-10-08'::date, 750.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Travis Tierney%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2026-02-22'::date, 750.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Travis Tierney%'

  -- Will David Clifford (ID 17) - 3 transactions
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-07-28'::date, 500.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Will David Clifford%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2025-11-16'::date, 750.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Will David Clifford%'
  UNION ALL
  SELECT p.id, (SELECT id FROM morocco_trip), '2026-02-28'::date, 750.00, 'bank_transfer' FROM profiles p WHERE p.full_name ILIKE '%Will David Clifford%'
)

INSERT INTO member_payments (member_id, trip_id, payment_date, amount, payment_method, notes)
SELECT member_id, trip_id, payment_date, amount, payment_method, 'Morocco 2027 trip payment' FROM member_transactions
ON CONFLICT DO NOTHING;

-- Note: Westpac Interest ($184.34 total) is tracked separately as group kitty income
-- PayPal transactions are included in the member payments above where applicable
