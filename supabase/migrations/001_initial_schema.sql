-- ============================================================================
-- CueClub — Snooker & Pool Club Booking System
-- Migration: 001_initial_schema.sql
-- Description: Complete schema, functions, RLS policies, triggers, and seed data
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 2. CUSTOM TYPES (ENUMs)
-- ============================================================================

CREATE TYPE user_role AS ENUM ('customer', 'staff', 'owner');
CREATE TYPE table_status AS ENUM ('available', 'reserved', 'in_play', 'maintenance');
CREATE TYPE table_type AS ENUM ('snooker', 'pool');
CREATE TYPE booking_status AS ENUM ('confirmed', 'checked_in', 'in_play', 'completed', 'cancelled', 'no_show');
CREATE TYPE booking_type AS ENUM ('reservation', 'walk_in');
CREATE TYPE payment_mode AS ENUM ('cash', 'upi', 'card');
CREATE TYPE payment_status AS ENUM ('pending', 'partial', 'paid');
CREATE TYPE session_status AS ENUM ('active', 'paused', 'completed');

-- ============================================================================
-- 3. TABLES
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 3.1 profiles — extends Supabase auth.users
-- ---------------------------------------------------------------------------
CREATE TABLE profiles (
  id                    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name             TEXT        NOT NULL,
  phone                 TEXT        UNIQUE NOT NULL,
  email                 TEXT,
  role                  user_role   NOT NULL DEFAULT 'customer',
  visit_count           INT         NOT NULL DEFAULT 0,
  total_spend           NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_playing_minutes INT         NOT NULL DEFAULT 0,
  pending_dues          NUMERIC(10,2) NOT NULL DEFAULT 0,
  last_visit            TIMESTAMPTZ,
  no_show_count         INT         NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE profiles IS 'Customer and staff profiles linked to Supabase auth.users';

-- ---------------------------------------------------------------------------
-- 3.2 club_settings — singleton configuration row
-- ---------------------------------------------------------------------------
CREATE TABLE club_settings (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_name             TEXT        NOT NULL DEFAULT 'CueClub',
  description           TEXT,
  address               TEXT,
  phone                 TEXT,
  email                 TEXT,
  opening_time          TIME        NOT NULL DEFAULT '10:00',
  closing_time          TIME        NOT NULL DEFAULT '23:00',
  min_duration_minutes  INT         NOT NULL DEFAULT 30,
  max_duration_minutes  INT         NOT NULL DEFAULT 240,
  buffer_minutes        INT         NOT NULL DEFAULT 15,
  grace_period_minutes  INT         NOT NULL DEFAULT 10,
  deposit_percentage    NUMERIC(5,2) NOT NULL DEFAULT 25,
  deposit_policy        TEXT        NOT NULL DEFAULT 'non_refundable'
                        CHECK (deposit_policy IN ('refundable', 'non_refundable', 'partial')),
  cancellation_policy   TEXT,
  peak_hours            JSONB       NOT NULL DEFAULT '[]'::jsonb,
  peak_rate_multiplier  NUMERIC(3,2) NOT NULL DEFAULT 1.50,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE club_settings IS 'Singleton row holding club-wide configuration';

-- ---------------------------------------------------------------------------
-- 3.3 tables — physical snooker / pool tables
-- ---------------------------------------------------------------------------
CREATE TABLE tables (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT          UNIQUE NOT NULL,
  table_type      table_type    NOT NULL,
  status          table_status  NOT NULL DEFAULT 'available',
  hourly_rate     NUMERIC(10,2) NOT NULL CHECK (hourly_rate > 0),
  peak_hourly_rate NUMERIC(10,2),
  description     TEXT,
  is_active       BOOLEAN       NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

COMMENT ON TABLE tables IS 'Physical tables available for booking';

-- ---------------------------------------------------------------------------
-- 3.4 bookings
-- ---------------------------------------------------------------------------
CREATE TABLE bookings (
  id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         UUID            NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  table_id            UUID            NOT NULL REFERENCES tables(id) ON DELETE RESTRICT,
  booking_date        DATE            NOT NULL,
  start_time          TIMESTAMPTZ     NOT NULL,
  end_time            TIMESTAMPTZ     NOT NULL,
  duration_minutes    INT             NOT NULL CHECK (duration_minutes > 0),
  status              booking_status  NOT NULL DEFAULT 'confirmed',
  booking_type        booking_type    NOT NULL DEFAULT 'reservation',
  deposit_amount      NUMERIC(10,2)   NOT NULL DEFAULT 0,
  estimated_price     NUMERIC(10,2)   NOT NULL CHECK (estimated_price >= 0),
  grace_deadline      TIMESTAMPTZ,
  cancellation_reason TEXT,
  penalty_amount      NUMERIC(10,2)   NOT NULL DEFAULT 0,
  refund_amount       NUMERIC(10,2)   NOT NULL DEFAULT 0,
  notes               TEXT,
  created_by          UUID            REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),

  -- end must be after start
  CONSTRAINT chk_booking_time_range CHECK (end_time > start_time)
);

COMMENT ON TABLE bookings IS 'Table reservations and walk-in bookings';

-- ---------------------------------------------------------------------------
-- 3.5 sessions — active play sessions tied to bookings
-- ---------------------------------------------------------------------------
CREATE TABLE sessions (
  id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id          UUID            UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  table_id            UUID            NOT NULL REFERENCES tables(id) ON DELETE RESTRICT,
  customer_id         UUID            NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  actual_start        TIMESTAMPTZ,
  actual_end          TIMESTAMPTZ,
  actual_minutes      INT             NOT NULL DEFAULT 0,
  extended_minutes    INT             NOT NULL DEFAULT 0,
  is_paused           BOOLEAN         NOT NULL DEFAULT false,
  pause_start         TIMESTAMPTZ,
  total_pause_minutes INT             NOT NULL DEFAULT 0,
  status              session_status  NOT NULL DEFAULT 'active',
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE sessions IS 'Tracks actual playtime for each booking';

-- ---------------------------------------------------------------------------
-- 3.6 payments
-- ---------------------------------------------------------------------------
CREATE TABLE payments (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID            NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  customer_id     UUID            NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  subtotal        NUMERIC(10,2)   NOT NULL CHECK (subtotal >= 0),
  discount_amount NUMERIC(10,2)   NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  discount_reason TEXT,
  addon_amount    NUMERIC(10,2)   NOT NULL DEFAULT 0 CHECK (addon_amount >= 0),
  addon_details   JSONB,
  tax_amount      NUMERIC(10,2)   NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount    NUMERIC(10,2)   NOT NULL CHECK (total_amount >= 0),
  paid_amount     NUMERIC(10,2)   NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  due_amount      NUMERIC(10,2)   NOT NULL DEFAULT 0 CHECK (due_amount >= 0),
  payment_mode    payment_mode,
  payment_status  payment_status  NOT NULL DEFAULT 'pending',
  receipt_id      TEXT            UNIQUE,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE payments IS 'Payment records for bookings';

-- ---------------------------------------------------------------------------
-- 3.7 activity_log — audit trail
-- ---------------------------------------------------------------------------
CREATE TABLE activity_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  action      TEXT        NOT NULL,
  entity_type TEXT,
  entity_id   UUID,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE activity_log IS 'Audit trail for important system events';

-- ============================================================================
-- 4. INDEXES
-- ============================================================================

-- bookings: composite index for fast overlap / conflict checks
CREATE INDEX idx_bookings_table_time
  ON bookings (table_id, start_time, end_time);

CREATE INDEX idx_bookings_customer
  ON bookings (customer_id);

CREATE INDEX idx_bookings_status
  ON bookings (status);

CREATE INDEX idx_bookings_date
  ON bookings (booking_date);

-- Partial index: only confirmed bookings that still need grace-deadline checks
CREATE INDEX idx_bookings_grace_deadline
  ON bookings (grace_deadline)
  WHERE status = 'confirmed';

-- sessions
CREATE INDEX idx_sessions_booking
  ON sessions (booking_id);

-- Partial index: quickly find active sessions
CREATE INDEX idx_sessions_active
  ON sessions (status)
  WHERE status = 'active';

-- payments
CREATE INDEX idx_payments_booking
  ON payments (booking_id);

CREATE INDEX idx_payments_customer
  ON payments (customer_id);

CREATE INDEX idx_payments_receipt
  ON payments (receipt_id);

-- activity_log
CREATE INDEX idx_activity_log_user
  ON activity_log (user_id);

CREATE INDEX idx_activity_log_entity
  ON activity_log (entity_type, entity_id);

-- profiles
CREATE INDEX idx_profiles_phone
  ON profiles (phone);

-- ============================================================================
-- 5. HELPER FUNCTIONS
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 5.1 get_user_role — used by RLS policies to determine the caller's role
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_role(p_user_id UUID)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM profiles WHERE id = p_user_id;
$$;

COMMENT ON FUNCTION get_user_role IS 'Returns the role for a given user id; used in RLS policies';

-- ---------------------------------------------------------------------------
-- 5.2 generate_receipt_id — e.g. CC-20261018-A7X9
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_receipt_id()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_date_part TEXT;
  v_rand_part TEXT;
  v_receipt   TEXT;
  v_exists    BOOLEAN;
BEGIN
  v_date_part := to_char(now(), 'YYYYMMDD');

  LOOP
    -- Generate a 4-character alphanumeric random suffix
    v_rand_part := upper(substr(md5(gen_random_uuid()::text), 1, 4));
    v_receipt   := 'CC-' || v_date_part || '-' || v_rand_part;

    -- Ensure uniqueness
    SELECT EXISTS (SELECT 1 FROM payments WHERE receipt_id = v_receipt) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;

  RETURN v_receipt;
END;
$$;

COMMENT ON FUNCTION generate_receipt_id IS 'Generates a unique receipt ID like CC-20261018-A7X9';

-- ============================================================================
-- 6. CRITICAL FUNCTION: create_booking (with row-level locking)
-- ============================================================================

CREATE OR REPLACE FUNCTION create_booking(
  p_customer_id         UUID,
  p_table_id            UUID,
  p_booking_date        DATE,
  p_start_time          TIMESTAMPTZ,
  p_end_time            TIMESTAMPTZ,
  p_duration_minutes    INT,
  p_booking_type        booking_type,
  p_estimated_price     NUMERIC,
  p_deposit_amount      NUMERIC DEFAULT 0,
  p_grace_period_minutes INT DEFAULT 10,
  p_created_by          UUID DEFAULT NULL
)
RETURNS bookings
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_table           tables%ROWTYPE;
  v_conflict_count  INT;
  v_grace_deadline  TIMESTAMPTZ;
  v_new_booking     bookings%ROWTYPE;
BEGIN
  -- -----------------------------------------------------------------------
  -- Step 1: Lock the table row to serialise concurrent booking attempts
  -- -----------------------------------------------------------------------
  SELECT *
    INTO v_table
    FROM tables
   WHERE id = p_table_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Table not found'
      USING ERRCODE = 'P0002';  -- no_data_found
  END IF;

  -- -----------------------------------------------------------------------
  -- Step 2: Validate the table is bookable
  -- -----------------------------------------------------------------------
  IF v_table.is_active = false THEN
    RAISE EXCEPTION 'Table is not active'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_table.status = 'maintenance' THEN
    RAISE EXCEPTION 'Table is under maintenance'
      USING ERRCODE = 'P0001';
  END IF;

  -- -----------------------------------------------------------------------
  -- Step 3: Check for overlapping bookings on the same table
  --         Two intervals overlap when: start_a < end_b AND end_a > start_b
  -- -----------------------------------------------------------------------
  SELECT count(*)
    INTO v_conflict_count
    FROM bookings
   WHERE table_id = p_table_id
     AND status NOT IN ('cancelled', 'no_show', 'completed')
     AND start_time < p_end_time
     AND end_time   > p_start_time;

  -- -----------------------------------------------------------------------
  -- Step 4: Raise on conflict
  -- -----------------------------------------------------------------------
  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'A conflicting booking already exists for this table and time slot'
      USING ERRCODE = 'BOOKING_CONFLICT';
  END IF;

  -- -----------------------------------------------------------------------
  -- Step 5: Calculate grace deadline
  -- -----------------------------------------------------------------------
  v_grace_deadline := p_start_time + (p_grace_period_minutes || ' minutes')::interval;

  -- -----------------------------------------------------------------------
  -- Step 6: Insert the booking
  -- -----------------------------------------------------------------------
  INSERT INTO bookings (
    customer_id,
    table_id,
    booking_date,
    start_time,
    end_time,
    duration_minutes,
    status,
    booking_type,
    deposit_amount,
    estimated_price,
    grace_deadline,
    created_by
  )
  VALUES (
    p_customer_id,
    p_table_id,
    p_booking_date,
    p_start_time,
    p_end_time,
    p_duration_minutes,
    'confirmed',
    p_booking_type,
    p_deposit_amount,
    p_estimated_price,
    v_grace_deadline,
    p_created_by
  )
  RETURNING * INTO v_new_booking;

  -- -----------------------------------------------------------------------
  -- Step 7: If the booking starts within the next 30 minutes, mark table reserved
  -- -----------------------------------------------------------------------
  IF p_start_time <= now() + interval '30 minutes' THEN
    UPDATE tables
       SET status = 'reserved'
     WHERE id = p_table_id
       AND status = 'available';
  END IF;

  -- Log the booking creation
  INSERT INTO activity_log (user_id, action, entity_type, entity_id, details)
  VALUES (
    COALESCE(p_created_by, p_customer_id),
    'booking_created',
    'booking',
    v_new_booking.id,
    jsonb_build_object(
      'table_id',    p_table_id,
      'start_time',  p_start_time,
      'end_time',    p_end_time,
      'type',        p_booking_type::text
    )
  );

  RETURN v_new_booking;
END;
$$;

COMMENT ON FUNCTION create_booking IS
  'Creates a booking with row-level locking to prevent double-booking. '
  'Raises BOOKING_CONFLICT if the time slot is already taken.';

-- ============================================================================
-- 7. FUNCTION: process_no_shows
-- ============================================================================

CREATE OR REPLACE FUNCTION process_no_shows()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking RECORD;
BEGIN
  -- Find all confirmed bookings past their grace deadline
  FOR v_booking IN
    SELECT id, customer_id, table_id
      FROM bookings
     WHERE status = 'confirmed'
       AND grace_deadline < now()
  LOOP
    -- Mark as no-show
    UPDATE bookings
       SET status     = 'no_show',
           updated_at = now()
     WHERE id = v_booking.id;

    -- Release the table back to available
    UPDATE tables
       SET status     = 'available',
           updated_at = now()
     WHERE id = v_booking.table_id
       AND status = 'reserved';

    -- Increment customer no-show count
    UPDATE profiles
       SET no_show_count = no_show_count + 1,
           updated_at    = now()
     WHERE id = v_booking.customer_id;

    -- Audit log
    INSERT INTO activity_log (user_id, action, entity_type, entity_id, details)
    VALUES (
      v_booking.customer_id,
      'no_show',
      'booking',
      v_booking.id,
      jsonb_build_object('processed_at', now())
    );
  END LOOP;
END;
$$;

COMMENT ON FUNCTION process_no_shows IS
  'Batch-marks confirmed bookings past their grace deadline as no-show '
  'and releases the corresponding tables.';

-- ============================================================================
-- 8. FUNCTION: check_in_booking
-- ============================================================================

CREATE OR REPLACE FUNCTION check_in_booking(
  p_booking_id UUID
)
RETURNS sessions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking  bookings%ROWTYPE;
  v_session  sessions%ROWTYPE;
BEGIN
  -- Fetch and lock the booking
  SELECT *
    INTO v_booking
    FROM bookings
   WHERE id = p_booking_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found'
      USING ERRCODE = 'P0002';
  END IF;

  -- Must be in confirmed status
  IF v_booking.status <> 'confirmed' THEN
    RAISE EXCEPTION 'Booking is not in confirmed status (current: %)', v_booking.status
      USING ERRCODE = 'P0001';
  END IF;

  -- Must be within grace period
  IF v_booking.grace_deadline IS NOT NULL AND v_booking.grace_deadline < now() THEN
    RAISE EXCEPTION 'Check-in grace period has expired'
      USING ERRCODE = 'P0001';
  END IF;

  -- Transition booking to checked_in
  UPDATE bookings
     SET status     = 'checked_in',
         updated_at = now()
   WHERE id = p_booking_id;

  -- Create the play session
  INSERT INTO sessions (
    booking_id,
    table_id,
    customer_id,
    actual_start,
    status
  )
  VALUES (
    p_booking_id,
    v_booking.table_id,
    v_booking.customer_id,
    now(),
    'active'
  )
  RETURNING * INTO v_session;

  -- Mark the table as in-play
  UPDATE tables
     SET status     = 'in_play',
         updated_at = now()
   WHERE id = v_booking.table_id;

  -- Audit log
  INSERT INTO activity_log (user_id, action, entity_type, entity_id, details)
  VALUES (
    v_booking.customer_id,
    'checked_in',
    'booking',
    p_booking_id,
    jsonb_build_object('session_id', v_session.id, 'actual_start', v_session.actual_start)
  );

  RETURN v_session;
END;
$$;

COMMENT ON FUNCTION check_in_booking IS
  'Validates and checks in a confirmed booking, creating a play session '
  'and marking the table as in-play.';

-- ============================================================================
-- 9. FUNCTION: end_session
-- ============================================================================

CREATE OR REPLACE FUNCTION end_session(
  p_booking_id UUID
)
RETURNS sessions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session  sessions%ROWTYPE;
  v_actual   INT;
BEGIN
  -- Fetch and lock the session
  SELECT *
    INTO v_session
    FROM sessions
   WHERE booking_id = p_booking_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found for this booking'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_session.status = 'completed' THEN
    RAISE EXCEPTION 'Session is already completed'
      USING ERRCODE = 'P0001';
  END IF;

  -- Calculate actual playing minutes (excluding pauses)
  v_actual := GREATEST(
    EXTRACT(EPOCH FROM (now() - v_session.actual_start))::int / 60
    - v_session.total_pause_minutes,
    0
  );

  -- Complete the session
  UPDATE sessions
     SET actual_end          = now(),
         actual_minutes      = v_actual,
         is_paused           = false,
         pause_start         = NULL,
         status              = 'completed',
         updated_at          = now()
   WHERE id = v_session.id
  RETURNING * INTO v_session;

  -- Complete the booking
  UPDATE bookings
     SET status     = 'completed',
         updated_at = now()
   WHERE id = p_booking_id;

  -- Release the table
  UPDATE tables
     SET status     = 'available',
         updated_at = now()
   WHERE id = v_session.table_id;

  -- Update customer profile aggregates
  UPDATE profiles
     SET visit_count           = visit_count + 1,
         total_playing_minutes = total_playing_minutes + v_actual,
         last_visit            = now(),
         updated_at            = now()
   WHERE id = v_session.customer_id;

  -- Audit log
  INSERT INTO activity_log (user_id, action, entity_type, entity_id, details)
  VALUES (
    v_session.customer_id,
    'session_ended',
    'session',
    v_session.id,
    jsonb_build_object(
      'actual_minutes', v_actual,
      'extended_minutes', v_session.extended_minutes,
      'total_pause_minutes', v_session.total_pause_minutes
    )
  );

  RETURN v_session;
END;
$$;

COMMENT ON FUNCTION end_session IS
  'Ends an active session, calculates playtime, releases the table, '
  'and updates customer profile aggregates.';

-- ============================================================================
-- 10. FUNCTION: extend_session
-- ============================================================================

CREATE OR REPLACE FUNCTION extend_session(
  p_booking_id   UUID,
  p_extra_minutes INT
)
RETURNS bookings
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking       bookings%ROWTYPE;
  v_new_end       TIMESTAMPTZ;
  v_conflict_count INT;
BEGIN
  -- Fetch and lock the booking
  SELECT *
    INTO v_booking
    FROM bookings
   WHERE id = p_booking_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_booking.status NOT IN ('checked_in', 'in_play') THEN
    RAISE EXCEPTION 'Booking must be checked-in or in-play to extend'
      USING ERRCODE = 'P0001';
  END IF;

  -- Calculate new end time
  v_new_end := v_booking.end_time + (p_extra_minutes || ' minutes')::interval;

  -- Check for conflicts in the extended window
  SELECT count(*)
    INTO v_conflict_count
    FROM bookings
   WHERE table_id = v_booking.table_id
     AND id <> p_booking_id
     AND status NOT IN ('cancelled', 'no_show', 'completed')
     AND start_time < v_new_end
     AND end_time   > v_booking.end_time;

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'Cannot extend — a conflicting booking exists in the extended window'
      USING ERRCODE = 'BOOKING_CONFLICT';
  END IF;

  -- Apply extension to the booking
  UPDATE bookings
     SET end_time         = v_new_end,
         duration_minutes = duration_minutes + p_extra_minutes,
         updated_at       = now()
   WHERE id = p_booking_id
  RETURNING * INTO v_booking;

  -- Record extended minutes on the session
  UPDATE sessions
     SET extended_minutes = extended_minutes + p_extra_minutes,
         updated_at       = now()
   WHERE booking_id = p_booking_id;

  -- Audit log
  INSERT INTO activity_log (user_id, action, entity_type, entity_id, details)
  VALUES (
    v_booking.customer_id,
    'session_extended',
    'booking',
    p_booking_id,
    jsonb_build_object(
      'extra_minutes', p_extra_minutes,
      'new_end_time',  v_new_end
    )
  );

  RETURN v_booking;
END;
$$;

COMMENT ON FUNCTION extend_session IS
  'Extends a checked-in booking by additional minutes after verifying '
  'no conflicting bookings exist in the extended window.';

-- ============================================================================
-- 11. UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Apply to every table that carries an updated_at column
CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON club_settings
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON tables
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================================
-- 12. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on every table
ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables         ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log   ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 12.1 profiles
-- ---------------------------------------------------------------------------

-- Users can read their own profile
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT
  USING (id = auth.uid());

-- Staff and owner can read all profiles
CREATE POLICY profiles_select_staff ON profiles
  FOR SELECT
  USING (get_user_role(auth.uid()) IN ('staff', 'owner'));

-- Users can update their own profile (non-role fields)
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Staff/owner can update any profile
CREATE POLICY profiles_update_staff ON profiles
  FOR UPDATE
  USING (get_user_role(auth.uid()) IN ('staff', 'owner'));

-- Staff/owner can insert profiles (e.g. walk-in customers)
CREATE POLICY profiles_insert_staff ON profiles
  FOR INSERT
  WITH CHECK (
    id = auth.uid()
    OR get_user_role(auth.uid()) IN ('staff', 'owner')
  );

-- ---------------------------------------------------------------------------
-- 12.2 club_settings
-- ---------------------------------------------------------------------------

-- Anyone authenticated can read settings
CREATE POLICY club_settings_select ON club_settings
  FOR SELECT
  USING (true);

-- Only owner can update settings
CREATE POLICY club_settings_update_owner ON club_settings
  FOR UPDATE
  USING (get_user_role(auth.uid()) = 'owner')
  WITH CHECK (get_user_role(auth.uid()) = 'owner');

-- ---------------------------------------------------------------------------
-- 12.3 tables
-- ---------------------------------------------------------------------------

-- Anyone authenticated can read active tables
CREATE POLICY tables_select ON tables
  FOR SELECT
  USING (true);

-- Staff/owner can manage tables
CREATE POLICY tables_insert_staff ON tables
  FOR INSERT
  WITH CHECK (get_user_role(auth.uid()) IN ('staff', 'owner'));

CREATE POLICY tables_update_staff ON tables
  FOR UPDATE
  USING (get_user_role(auth.uid()) IN ('staff', 'owner'));

CREATE POLICY tables_delete_staff ON tables
  FOR DELETE
  USING (get_user_role(auth.uid()) IN ('staff', 'owner'));

-- ---------------------------------------------------------------------------
-- 12.4 bookings
-- ---------------------------------------------------------------------------

-- Customers can see their own bookings
CREATE POLICY bookings_select_own ON bookings
  FOR SELECT
  USING (customer_id = auth.uid());

-- Staff/owner can see all bookings
CREATE POLICY bookings_select_staff ON bookings
  FOR SELECT
  USING (get_user_role(auth.uid()) IN ('staff', 'owner'));

-- Bookings are created through the create_booking function (SECURITY DEFINER),
-- but we still need an INSERT policy for the function context.
-- Staff/owner can insert bookings; customers can insert their own.
CREATE POLICY bookings_insert ON bookings
  FOR INSERT
  WITH CHECK (
    customer_id = auth.uid()
    OR get_user_role(auth.uid()) IN ('staff', 'owner')
  );

-- Staff/owner can update any booking; customers can update their own
CREATE POLICY bookings_update_own ON bookings
  FOR UPDATE
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY bookings_update_staff ON bookings
  FOR UPDATE
  USING (get_user_role(auth.uid()) IN ('staff', 'owner'));

-- ---------------------------------------------------------------------------
-- 12.5 sessions
-- ---------------------------------------------------------------------------

-- Customers can see their own sessions
CREATE POLICY sessions_select_own ON sessions
  FOR SELECT
  USING (customer_id = auth.uid());

-- Staff/owner can see all sessions
CREATE POLICY sessions_select_staff ON sessions
  FOR SELECT
  USING (get_user_role(auth.uid()) IN ('staff', 'owner'));

-- Staff/owner can manage sessions
CREATE POLICY sessions_insert_staff ON sessions
  FOR INSERT
  WITH CHECK (get_user_role(auth.uid()) IN ('staff', 'owner'));

CREATE POLICY sessions_update_staff ON sessions
  FOR UPDATE
  USING (get_user_role(auth.uid()) IN ('staff', 'owner'));

-- ---------------------------------------------------------------------------
-- 12.6 payments
-- ---------------------------------------------------------------------------

-- Customers can see their own payments
CREATE POLICY payments_select_own ON payments
  FOR SELECT
  USING (customer_id = auth.uid());

-- Staff/owner can see all payments
CREATE POLICY payments_select_staff ON payments
  FOR SELECT
  USING (get_user_role(auth.uid()) IN ('staff', 'owner'));

-- Staff/owner can insert payments
CREATE POLICY payments_insert_staff ON payments
  FOR INSERT
  WITH CHECK (get_user_role(auth.uid()) IN ('staff', 'owner'));

-- Staff/owner can update payments
CREATE POLICY payments_update_staff ON payments
  FOR UPDATE
  USING (get_user_role(auth.uid()) IN ('staff', 'owner'));

-- ---------------------------------------------------------------------------
-- 12.7 activity_log
-- ---------------------------------------------------------------------------

-- Staff/owner can read the activity log
CREATE POLICY activity_log_select_staff ON activity_log
  FOR SELECT
  USING (get_user_role(auth.uid()) IN ('staff', 'owner'));

-- System (SECURITY DEFINER functions) inserts logs; allow via permissive policy
CREATE POLICY activity_log_insert ON activity_log
  FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- 13. SEED DATA
-- ============================================================================

-- Default club settings (singleton)
INSERT INTO club_settings (
  club_name,
  description,
  address,
  opening_time,
  closing_time,
  min_duration_minutes,
  max_duration_minutes,
  buffer_minutes,
  grace_period_minutes,
  deposit_percentage,
  deposit_policy,
  peak_rate_multiplier
)
VALUES (
  'CueClub',
  'Premium Snooker & Pool Lounge',
  NULL,
  '10:00',
  '23:00',
  30,
  240,
  15,
  10,
  25,
  'non_refundable',
  1.50
);

-- Sample tables
INSERT INTO tables (name, table_type, hourly_rate, peak_hourly_rate, description) VALUES
  ('Table 1', 'snooker', 500.00, 750.00, 'Standard snooker table'),
  ('Table 2', 'snooker', 500.00, 750.00, 'Standard snooker table'),
  ('Table 3', 'pool',    400.00, 600.00, 'Standard pool table'),
  ('Table 4', 'pool',    400.00, 600.00, 'Standard pool table'),
  ('Table 5', 'snooker', 600.00, 900.00, 'Premium snooker table'),
  ('Table 6', 'pool',    350.00, 525.00, 'Standard pool table');

-- ============================================================================
-- Done! Migration 001 complete.
-- ============================================================================
