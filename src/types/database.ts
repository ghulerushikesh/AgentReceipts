// =============================================================================
// Database types matching the Supabase PostgreSQL schema
// =============================================================================

export type UserRole = "customer" | "staff" | "owner";
export type TableStatus = "available" | "reserved" | "in_play" | "maintenance";
export type TableType = "snooker" | "pool";
export type BookingStatus = "confirmed" | "checked_in" | "in_play" | "completed" | "cancelled" | "no_show";
export type BookingType = "reservation" | "walk_in";
export type PaymentMode = "cash" | "upi" | "card";
export type PaymentStatus = "pending" | "partial" | "paid";
export type SessionStatus = "active" | "paused" | "completed";

export interface Profile {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  role: UserRole;
  visit_count: number;
  total_spend: number;
  total_playing_minutes: number;
  pending_dues: number;
  last_visit: string | null;
  no_show_count: number;
  created_at: string;
  updated_at: string;
}

export interface ClubSettings {
  id: string;
  club_name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  opening_time: string;
  closing_time: string;
  min_duration_minutes: number;
  max_duration_minutes: number;
  buffer_minutes: number;
  grace_period_minutes: number;
  deposit_percentage: number;
  deposit_policy: "refundable" | "non_refundable" | "partial";
  cancellation_policy: string | null;
  peak_hours: Array<{ start: string; end: string; days?: number[] }>;
  peak_rate_multiplier: number;
  created_at: string;
  updated_at: string;
}

export interface Table {
  id: string;
  name: string;
  table_type: TableType;
  status: TableStatus;
  hourly_rate: number;
  peak_hourly_rate: number | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  customer_id: string;
  table_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  status: BookingStatus;
  booking_type: BookingType;
  deposit_amount: number;
  estimated_price: number;
  grace_deadline: string | null;
  cancellation_reason: string | null;
  penalty_amount: number;
  refund_amount: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  table?: Table;
  customer?: Profile;
  session?: Session;
  payment?: Payment;
}

export interface Session {
  id: string;
  booking_id: string;
  table_id: string;
  customer_id: string;
  actual_start: string | null;
  actual_end: string | null;
  actual_minutes: number;
  extended_minutes: number;
  is_paused: boolean;
  pause_start: string | null;
  total_pause_minutes: number;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
  // Joined fields
  booking?: Booking;
  table?: Table;
  customer?: Profile;
}

export interface Payment {
  id: string;
  booking_id: string;
  customer_id: string;
  subtotal: number;
  discount_amount: number;
  discount_reason: string | null;
  addon_amount: number;
  addon_details: Record<string, unknown> | null;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  payment_mode: PaymentMode | null;
  payment_status: PaymentStatus;
  receipt_id: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  booking?: Booking;
  customer?: Profile;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

// =============================================================================
// Supabase Database type for typed client
// =============================================================================

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "visit_count" | "total_spend" | "total_playing_minutes" | "pending_dues" | "last_visit" | "no_show_count" | "created_at" | "updated_at"> & Partial<Pick<Profile, "visit_count" | "total_spend" | "total_playing_minutes" | "pending_dues" | "last_visit" | "no_show_count" | "created_at" | "updated_at">>;
        Update: Partial<Profile>;
      };
      club_settings: {
        Row: ClubSettings;
        Insert: Partial<ClubSettings>;
        Update: Partial<ClubSettings>;
      };
      tables: {
        Row: Table;
        Insert: Omit<Table, "id" | "status" | "is_active" | "created_at" | "updated_at"> & Partial<Pick<Table, "id" | "status" | "is_active" | "created_at" | "updated_at">>;
        Update: Partial<Table>;
      };
      bookings: {
        Row: Booking;
        Insert: Omit<Booking, "id" | "status" | "deposit_amount" | "penalty_amount" | "refund_amount" | "created_at" | "updated_at"> & Partial<Pick<Booking, "id" | "status" | "deposit_amount" | "penalty_amount" | "refund_amount" | "created_at" | "updated_at">>;
        Update: Partial<Booking>;
      };
      sessions: {
        Row: Session;
        Insert: Omit<Session, "id" | "actual_minutes" | "extended_minutes" | "is_paused" | "total_pause_minutes" | "status" | "created_at" | "updated_at"> & Partial<Pick<Session, "id" | "actual_minutes" | "extended_minutes" | "is_paused" | "total_pause_minutes" | "status" | "created_at" | "updated_at">>;
        Update: Partial<Session>;
      };
      payments: {
        Row: Payment;
        Insert: Omit<Payment, "id" | "discount_amount" | "addon_amount" | "tax_amount" | "paid_amount" | "due_amount" | "payment_status" | "created_at" | "updated_at"> & Partial<Pick<Payment, "id" | "discount_amount" | "addon_amount" | "tax_amount" | "paid_amount" | "due_amount" | "payment_status" | "created_at" | "updated_at">>;
        Update: Partial<Payment>;
      };
      activity_log: {
        Row: ActivityLog;
        Insert: Omit<ActivityLog, "id" | "created_at"> & Partial<Pick<ActivityLog, "id" | "created_at">>;
        Update: Partial<ActivityLog>;
      };
    };
    Functions: {
      create_booking: {
        Args: {
          p_customer_id: string;
          p_table_id: string;
          p_booking_date: string;
          p_start_time: string;
          p_end_time: string;
          p_duration_minutes: number;
          p_booking_type: BookingType;
          p_estimated_price: number;
          p_deposit_amount?: number;
          p_grace_period_minutes?: number;
          p_created_by?: string;
        };
        Returns: Booking;
      };
      process_no_shows: {
        Args: Record<string, never>;
        Returns: void;
      };
      check_in_booking: {
        Args: { p_booking_id: string };
        Returns: Session;
      };
      end_session: {
        Args: { p_session_id: string };
        Returns: Session;
      };
      extend_session: {
        Args: {
          p_booking_id: string;
          p_extra_minutes: number;
        };
        Returns: Booking;
      };
      get_user_role: {
        Args: { p_user_id: string };
        Returns: UserRole;
      };
      generate_receipt_id: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
  };
}
