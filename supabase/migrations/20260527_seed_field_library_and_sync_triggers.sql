-- @auto-migrate
-- ══════════════════════════════════════════════════════════════════
-- Form Field Library — seed standard fields + enforce auto-sync
-- ══════════════════════════════════════════════════════════════════

-- ── 1. SYNC TRIGGER: keep use_count accurate on form_fields changes
CREATE OR REPLACE FUNCTION sync_library_use_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.library_field_id IS DISTINCT FROM NEW.library_field_id))
     AND NEW.library_field_id IS NOT NULL THEN
    UPDATE form_field_library SET use_count = use_count + 1 WHERE id = NEW.library_field_id;
  END IF;
  IF (TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.library_field_id IS DISTINCT FROM NEW.library_field_id))
     AND OLD.library_field_id IS NOT NULL THEN
    UPDATE form_field_library SET use_count = GREATEST(0, use_count - 1) WHERE id = OLD.library_field_id;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_form_fields_use_count ON form_fields;
DROP TRIGGER IF EXISTS trg_sync_library_use_count ON form_fields;
CREATE TRIGGER trg_sync_library_use_count
  AFTER INSERT OR UPDATE OF library_field_id OR DELETE ON form_fields
  FOR EACH ROW EXECUTE FUNCTION sync_library_use_count();


-- ── 2. AUTO-LINK TRIGGER: any new form_field without a library entry
--    automatically gets one created and linked (BEFORE INSERT)
CREATE OR REPLACE FUNCTION auto_link_form_field_to_library()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  lib_id uuid;
BEGIN
  IF NEW.library_field_id IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.field_type = 'section_header' THEN RETURN NEW; END IF;

  SELECT id INTO lib_id
  FROM form_field_library
  WHERE lower(trim(label)) = lower(trim(NEW.label)) AND field_type = NEW.field_type
  LIMIT 1;

  IF lib_id IS NULL THEN
    INSERT INTO form_field_library (field_type, label, placeholder, helper_text, options, settings, category)
    VALUES (NEW.field_type, NEW.label, NEW.placeholder, NEW.helper_text, NEW.options, NEW.settings, NULL)
    RETURNING id INTO lib_id;
  END IF;

  NEW.library_field_id := lib_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_link_field_to_library ON form_fields;
CREATE TRIGGER trg_auto_link_field_to_library
  BEFORE INSERT ON form_fields
  FOR EACH ROW EXECUTE FUNCTION auto_link_form_field_to_library();


-- ── 3. SEED: standard fields for Morocco 2027 (idempotent — skip if label+type exists)

-- MEDICAL
INSERT INTO form_field_library (field_type, label, description, placeholder, helper_text, options, category)
SELECT field_type, label, description, placeholder, helper_text, options::jsonb, category FROM (VALUES
  ('single_choice', 'Blood Type', 'Member''s blood type — critical for emergency medical situations', NULL, 'Select your blood type', '["A+","A-","B+","B-","AB+","AB-","O+","O-","Unknown"]'::jsonb, 'Medical'),
  ('long_text', 'Known Allergies', 'Any allergies to food, medication, insects, or environment', 'e.g. Penicillin, peanuts, bee stings…', 'List all known allergies. Write "None" if you have none.', NULL, 'Medical'),
  ('long_text', 'Current Medications', 'Medications taken regularly or needed on the trip', 'e.g. Blood pressure medication, insulin…', 'Include dosage and frequency. Write "None" if not applicable.', NULL, 'Medical'),
  ('long_text', 'Medical Conditions', 'Pre-existing medical conditions relevant to strenuous activity', 'e.g. Asthma, diabetes, heart condition…', 'Include anything that may affect your ability to participate. Write "None" if not applicable.', NULL, 'Medical'),
  ('yes_no', 'Do you carry an EpiPen?', 'Whether the member carries an epinephrine auto-injector', NULL, 'If yes, please ensure it is packed and accessible during the trip.', NULL, 'Medical'),
  ('yes_no', 'Do you have travel insurance?', 'Confirmation of travel insurance — required for all participants', NULL, 'Travel insurance including medical evacuation is mandatory for this trip.', NULL, 'Medical'),
  ('short_text', 'Travel Insurance Provider', 'Name of the travel insurance company', 'e.g. Cover-More, Allianz…', NULL, NULL, 'Medical'),
  ('short_text', 'Travel Insurance Policy Number', 'Policy number for travel insurance', 'e.g. POL-123456', NULL, NULL, 'Medical'),
  ('short_text', 'Emergency Medical Contact — Name', 'Name of person to contact in a medical emergency', 'Full name', 'This person will be contacted if you cannot be reached.', NULL, 'Medical'),
  ('short_text', 'Emergency Medical Contact — Phone', 'Phone number for emergency medical contact', 'Include country code, e.g. +61 4xx xxx xxx', NULL, NULL, 'Medical'),
  ('short_text', 'Doctor / GP Name', 'Name of the member''s regular doctor', 'Dr. Jane Smith', NULL, NULL, 'Medical'),
  ('short_text', 'Doctor / GP Phone', 'Phone number of the member''s regular doctor', 'Include country code', NULL, NULL, 'Medical')
) AS v(field_type, label, description, placeholder, helper_text, options, category)
WHERE NOT EXISTS (
  SELECT 1 FROM form_field_library x WHERE lower(trim(x.label)) = lower(trim(v.label)) AND x.field_type = v.field_type
);

-- TRAVEL
INSERT INTO form_field_library (field_type, label, description, placeholder, helper_text, options, category)
SELECT field_type, label, description, placeholder, helper_text, options::jsonb, category FROM (VALUES
  ('short_text', 'Passport Number', 'Member''s current passport number', 'e.g. PA6257096', 'As it appears on your passport. Required for visa processing.', NULL, 'Travel'),
  ('date', 'Passport Expiry Date', 'Date the member''s passport expires', NULL, 'Your passport must be valid for at least 6 months beyond the trip end date.', NULL, 'Travel'),
  ('short_text', 'Passport Issuing Country', 'Country that issued the member''s passport', 'e.g. Australia', NULL, NULL, 'Travel'),
  ('short_text', 'Nationality', 'Member''s nationality as shown in their passport', 'e.g. Australian', NULL, NULL, 'Travel'),
  ('short_text', 'Flying From (City / Airport)', 'City or airport the member is flying from', 'e.g. Sydney (SYD)', NULL, NULL, 'Travel'),
  ('date', 'Preferred Arrival Date', 'Date the member plans to arrive at the destination', NULL, NULL, NULL, 'Travel'),
  ('date', 'Preferred Departure Date', 'Date the member plans to depart from the destination', NULL, NULL, NULL, 'Travel'),
  ('yes_no', 'Do you require airport transfers?', 'Whether the member needs airport pickup/drop-off arranged', NULL, 'We can arrange shared transfers from Marrakech Menara Airport (RAK).', NULL, 'Travel'),
  ('short_text', 'Flight Arrival Details', 'Airline and flight number for arrival', 'e.g. QF31 arriving 14:35', NULL, NULL, 'Travel'),
  ('short_text', 'Flight Departure Details', 'Airline and flight number for departure', 'e.g. QF32 departing 16:50', NULL, NULL, 'Travel')
) AS v(field_type, label, description, placeholder, helper_text, options, category)
WHERE NOT EXISTS (
  SELECT 1 FROM form_field_library x WHERE lower(trim(x.label)) = lower(trim(v.label)) AND x.field_type = v.field_type
);

-- PERSONAL
INSERT INTO form_field_library (field_type, label, description, placeholder, helper_text, options, category)
SELECT field_type, label, description, placeholder, helper_text, options::jsonb, category FROM (VALUES
  ('multiple_choice', 'Dietary Requirements', 'Food preferences and restrictions', NULL, 'Select all that apply.', '["Vegetarian","Vegan","Gluten-free","Halal","Kosher","Lactose intolerant","Nut allergy","No pork","No seafood","No restrictions"]'::jsonb, 'Personal'),
  ('short_text', 'Other Dietary Requirements', 'Any dietary requirements not covered by the standard list', 'Describe any other requirements…', NULL, NULL, 'Personal'),
  ('single_choice', 'T-Shirt Size', 'Preferred shirt size for trip merchandise', NULL, NULL, '["XS","S","M","L","XL","2XL","3XL"]'::jsonb, 'Personal'),
  ('single_choice', 'Shorts Size', 'Preferred shorts size for trip merchandise', NULL, NULL, '["28","30","32","34","36","38","40"]'::jsonb, 'Personal'),
  ('short_text', 'Languages Spoken', 'Languages the member speaks', 'e.g. English, French, Arabic', NULL, NULL, 'Personal'),
  ('short_text', 'Mobile Number (While Travelling)', 'Phone number the member will have active during the trip', 'Include country code', 'Must be able to receive WhatsApp messages.', NULL, 'Personal')
) AS v(field_type, label, description, placeholder, helper_text, options, category)
WHERE NOT EXISTS (
  SELECT 1 FROM form_field_library x WHERE lower(trim(x.label)) = lower(trim(v.label)) AND x.field_type = v.field_type
);

-- TRIP
INSERT INTO form_field_library (field_type, label, description, placeholder, helper_text, options, category)
SELECT field_type, label, description, placeholder, helper_text, options::jsonb, category FROM (VALUES
  ('single_choice', 'Riding Experience Level', 'Self-assessed off-road motorcycling experience', NULL, 'Be honest — this helps us group riders appropriately.', '["Beginner (0–2 years off-road)","Intermediate (3–5 years)","Experienced (6–10 years)","Expert (10+ years)","Enduro racer"]'::jsonb, 'Trip'),
  ('single_choice', 'Physical Fitness Level', 'Self-assessed general fitness level for a demanding multi-day ride', NULL, 'The Atlas Mountains route involves long days, heat, and technical terrain.', '["Low — I will find this challenging","Moderate — reasonably active","Good — regular exercise","Excellent — very fit and active"]'::jsonb, 'Trip'),
  ('multiple_choice', 'Riding Style', 'The type of riding the member most enjoys', NULL, 'Select all that apply.', '["Enduro / technical trails","Desert / sand","Road / tarmac","Adventure touring","Trail riding","Motocross"]'::jsonb, 'Trip'),
  ('yes_no', 'Have you ridden in desert / sand conditions before?', 'Whether the member has experience riding in desert or sandy terrain', NULL, 'Morocco includes significant sand and desert sections.', NULL, 'Trip'),
  ('yes_no', 'Have you been on a previous Whiskey Riders trip?', 'Whether this is a returning Whiskey Riders member', NULL, NULL, NULL, 'Trip'),
  ('single_choice', 'Accommodation Preference', 'Preferred accommodation style during the trip', NULL, NULL, '["Standard — shared facilities","Comfort — en suite preferred","No preference"]'::jsonb, 'Trip'),
  ('single_choice', 'Room Sharing Preference', 'Whether the member prefers to share or have a private room', NULL, 'Shared rooms reduce the trip cost.', '["Happy to share","Prefer private room (surcharge applies)","No preference"]'::jsonb, 'Trip'),
  ('long_text', 'Any Physical Limitations or Injuries', 'Physical limitations, recent injuries, or surgeries relevant to riding', 'e.g. Recent knee surgery, lower back issues…', 'Write "None" if not applicable.', NULL, 'Trip'),
  ('long_text', 'Special Requirements or Requests', 'Any other special requirements, requests, or notes for the trip organisers', 'Anything else we should know…', NULL, NULL, 'Trip')
) AS v(field_type, label, description, placeholder, helper_text, options, category)
WHERE NOT EXISTS (
  SELECT 1 FROM form_field_library x WHERE lower(trim(x.label)) = lower(trim(v.label)) AND x.field_type = v.field_type
);

-- EQUIPMENT
INSERT INTO form_field_library (field_type, label, description, placeholder, helper_text, options, category)
SELECT field_type, label, description, placeholder, helper_text, options::jsonb, category FROM (VALUES
  ('yes_no', 'Do you own your own riding gear?', 'Whether the member brings full riding gear (helmet, boots, jacket, pants, gloves)', NULL, 'Full protective gear is mandatory. Rentals are available.', NULL, 'Equipment'),
  ('yes_no', 'Do you require a rental bike?', 'Whether the member needs a motorcycle provided for the trip', NULL, 'We can arrange rental bikes. Please confirm early to guarantee availability.', NULL, 'Equipment'),
  ('single_choice', 'Bike Size Preference (if renting)', 'Preferred engine size or bike model for rental', NULL, NULL, '["250cc","300cc","450cc","No preference"]'::jsonb, 'Equipment'),
  ('single_choice', 'Helmet Size', 'The member''s helmet size for rental purposes', NULL, NULL, '["XS (53-54cm)","S (55-56cm)","M (57-58cm)","L (59-60cm)","XL (61-62cm)","2XL (63-64cm)","Own helmet"]'::jsonb, 'Equipment'),
  ('short_text', 'Riding Boot Size (EU)', 'Boot size in EU sizing for rental purposes', 'e.g. 42', 'European sizing (EU). e.g. AU 9 = EU 43.', NULL, 'Equipment'),
  ('long_text', 'Equipment Notes', 'Any notes about equipment or gear the member is bringing', 'e.g. Bringing own helmet and boots, need jacket rental only…', NULL, NULL, 'Equipment')
) AS v(field_type, label, description, placeholder, helper_text, options, category)
WHERE NOT EXISTS (
  SELECT 1 FROM form_field_library x WHERE lower(trim(x.label)) = lower(trim(v.label)) AND x.field_type = v.field_type
);

-- LOGISTICS
INSERT INTO form_field_library (field_type, label, description, placeholder, helper_text, options, category)
SELECT field_type, label, description, placeholder, helper_text, options::jsonb, category FROM (VALUES
  ('single_choice', 'How did you hear about the trip?', 'Referral source for the trip', NULL, NULL, '["Friend / word of mouth","Previous Whiskey Riders trip","Social media","Website","Other"]'::jsonb, 'Logistics'),
  ('acknowledgement', 'Waiver & Liability Acknowledgement', 'Participant acknowledges the risks of off-road motorcycling', NULL, 'I acknowledge that off-road motorcycling involves inherent risks including injury or death. I confirm I am medically fit to participate, hold valid travel insurance, and release the trip organisers from liability for any injury, loss, or damage arising from participation in this trip.', NULL, 'Logistics'),
  ('acknowledgement', 'Medical Information Consent', 'Consent to share medical information with trip medical personnel', NULL, 'I consent to the trip organisers and any engaged medical personnel accessing the medical information I have provided, in the event of a medical emergency during the trip.', NULL, 'Logistics'),
  ('long_text', 'Anything Else We Should Know', 'Open field for any additional information the member wants to share', 'Any other information you''d like to share with the trip organisers…', NULL, NULL, 'Logistics')
) AS v(field_type, label, description, placeholder, helper_text, options, category)
WHERE NOT EXISTS (
  SELECT 1 FROM form_field_library x WHERE lower(trim(x.label)) = lower(trim(v.label)) AND x.field_type = v.field_type
);

-- ── 4. Recount use_count from actual form_fields links
UPDATE form_field_library lib
SET use_count = (SELECT COUNT(*) FROM form_fields ff WHERE ff.library_field_id = lib.id);
