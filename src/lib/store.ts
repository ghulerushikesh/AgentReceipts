import fs from "fs";
import path from "path";
import {
  Table,
  Booking,
  Session,
  Payment,
  Profile,
  ClubSettings,
  ActivityLog,
  BookingType,
  PaymentMode,
} from "@/types/database";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");

interface StoreData {
  settings: ClubSettings;
  tables: Table[];
  profiles: Profile[];
  bookings: Booking[];
  sessions: Session[];
  payments: Payment[];
  logs: ActivityLog[];
}

const DEFAULT_SETTINGS: ClubSettings = {
  id: "setting-default-001",
  club_name: "CueClub - Grand Snooker & Pool Lounge",
  description: "Premier snooker & pool arena featuring Riley tournament tables, digital session timing, and luxury cues.",
  address: "Shop 14-16, Metro Boulevard, City Center",
  phone: "+91 98765 43210",
  email: "contact@cueclub.com",
  opening_time: "10:00",
  closing_time: "23:30",
  min_duration_minutes: 30,
  max_duration_minutes: 240,
  buffer_minutes: 15,
  grace_period_minutes: 10,
  deposit_percentage: 25,
  deposit_policy: "non_refundable",
  cancellation_policy: "Cancellations allowed up to 1 hour before scheduled start. Deposit forfeited for no-shows.",
  peak_hours: [{ start: "18:00", end: "22:00" }],
  peak_rate_multiplier: 1.25,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const DEFAULT_TABLES: Table[] = [
  {
    id: "table-s1",
    name: "Tournament Arena 1",
    table_type: "snooker",
    status: "available",
    hourly_rate: 500,
    peak_hourly_rate: 650,
    description: "Riley Aristocrat 12ft full tournament snooker table with 6811 tournament cloth and Strachan rails.",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "table-s2",
    name: "Snooker Table 2",
    table_type: "snooker",
    status: "available",
    hourly_rate: 450,
    peak_hourly_rate: 550,
    description: "Full size 12ft championship table with heated slate and LED shadowless canopy.",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "table-s3",
    name: "Snooker Table 3 (Executive)",
    table_type: "snooker",
    status: "available",
    hourly_rate: 500,
    peak_hourly_rate: 600,
    description: "Private booth 12ft table with lounge seating and dedicated scoring monitor.",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "table-p1",
    name: "Pool Table 1 (Brunswick 9ft)",
    table_type: "pool",
    status: "available",
    hourly_rate: 350,
    peak_hourly_rate: 450,
    description: "Brunswick Gold Crown 9ft American pool table with Simonis 860 cloth and Aramith Pro balls.",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "table-p2",
    name: "Pool Table 2 (Diamond 9ft)",
    table_type: "pool",
    status: "available",
    hourly_rate: 350,
    peak_hourly_rate: 450,
    description: "Diamond Pro-Am 9ft table with blue tournament cloth and carbon fiber break cues available.",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "table-p3",
    name: "Pool Table 3 (English 7ft)",
    table_type: "pool",
    status: "available",
    hourly_rate: 300,
    peak_hourly_rate: 400,
    description: "Supreme Winner 7ft English 8-ball pool table with red speed cloth and micro pockets.",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const DEFAULT_PROFILES: Profile[] = [
  {
    id: "cust-001",
    full_name: "Rahul Verma",
    phone: "9820011223",
    email: "rahul.verma@example.com",
    role: "customer",
    visit_count: 5,
    total_spend: 2850,
    total_playing_minutes: 360,
    pending_dues: 0,
    last_visit: new Date(Date.now() - 86400000 * 2).toISOString(),
    no_show_count: 0,
    created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "cust-002",
    full_name: "Amitabh Sen",
    phone: "9819922334",
    email: "amitabh@example.com",
    role: "customer",
    visit_count: 2,
    total_spend: 950,
    total_playing_minutes: 120,
    pending_dues: 150,
    last_visit: new Date(Date.now() - 86400000 * 5).toISOString(),
    no_show_count: 1,
    created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "staff-001",
    full_name: "Vikram Mehta (Manager)",
    phone: "9988776655",
    email: "staff@cueclub.com",
    role: "owner",
    visit_count: 0,
    total_spend: 0,
    total_playing_minutes: 0,
    pending_dues: 0,
    last_visit: null,
    no_show_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

function ensureStore(): StoreData {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(STORE_FILE)) {
    // 1. Try seeding from data/store.example.json on fresh clone
    const exampleFile = path.join(DATA_DIR, "store.example.json");
    if (fs.existsSync(exampleFile)) {
      try {
        const exampleContent = fs.readFileSync(exampleFile, "utf-8");
        const exampleData = JSON.parse(exampleContent);
        fs.writeFileSync(STORE_FILE, JSON.stringify(exampleData, null, 2), "utf-8");
        return exampleData;
      } catch (err) {
        console.error("Failed to initialize from store.example.json:", err);
      }
    }

    const initial: StoreData = {
      settings: DEFAULT_SETTINGS,
      tables: DEFAULT_TABLES,
      profiles: DEFAULT_PROFILES,
      bookings: [],
      sessions: [],
      payments: [],
      logs: [],
    };
    fs.writeFileSync(STORE_FILE, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }

  try {
    const content = fs.readFileSync(STORE_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    const initial: StoreData = {
      settings: DEFAULT_SETTINGS,
      tables: DEFAULT_TABLES,
      profiles: DEFAULT_PROFILES,
      bookings: [],
      sessions: [],
      payments: [],
      logs: [],
    };
    fs.writeFileSync(STORE_FILE, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
}

function saveStore(data: StoreData) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export function generateReceiptId(): string {
  const d = new Date();
  const dateStr = d.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CC-${dateStr}-${rand}`;
}

export const CueClubStore = {
  getData(): StoreData {
    return ensureStore();
  },

  getSettings(): ClubSettings {
    const data = this.getData();
    return data.settings;
  },

  updateSettings(updates: Partial<ClubSettings>): ClubSettings {
    const data = ensureStore();
    data.settings = { ...data.settings, ...updates, updated_at: new Date().toISOString() };
    saveStore(data);
    return data.settings;
  },

  getTables(): Table[] {
    const data = this.getData();
    return data.tables;
  },

  updateTableStatus(tableId: string, status: Table["status"]): Table | null {
    const data = ensureStore();
    const table = data.tables.find((t) => t.id === tableId);
    if (!table) return null;
    table.status = status;
    table.updated_at = new Date().toISOString();
    saveStore(data);
    return table;
  },

  getProfiles(): Profile[] {
    const data = this.getData();
    return data.profiles;
  },

  findOrCreateCustomer(name: string, phone: string, email?: string): Profile {
    const data = ensureStore();
    const cleanPhone = phone.trim().replace(/\D/g, "").slice(-10);
    let customer = data.profiles.find((p) => p.phone.slice(-10) === cleanPhone);

    if (!customer) {
      customer = {
        id: `cust-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        full_name: name.trim(),
        phone: cleanPhone,
        email: email?.trim() || null,
        role: "customer",
        visit_count: 0,
        total_spend: 0,
        total_playing_minutes: 0,
        pending_dues: 0,
        last_visit: null,
        no_show_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      data.profiles.push(customer);
      saveStore(data);
    } else {
      // update name/email if provided
      if (name) customer.full_name = name.trim();
      if (email) customer.email = email.trim();
      customer.updated_at = new Date().toISOString();
      saveStore(data);
    }

    return customer;
  },

  getBookings(): Booking[] {
    const data = this.getData();
    // populate joins
    return data.bookings.map((b) => ({
      ...b,
      table: data.tables.find((t) => t.id === b.table_id),
      customer: data.profiles.find((p) => p.id === b.customer_id),
      session: data.sessions.find((s) => s.booking_id === b.id),
      payment: data.payments.find((p) => p.booking_id === b.id),
    }));
  },

  /**
   * CRITICAL HACKATHON REQUIREMENT:
   * Server-side booking conflict prevention with strict overlapping window check.
   */
  createBooking(params: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    tableId: string;
    startTime: string; // ISO
    durationMinutes: number;
    bookingType: BookingType;
    notes?: string;
  }): { success: boolean; booking?: Booking; error?: string } {
    const data = ensureStore();

    // 1. Table validation
    const table = data.tables.find((t) => t.id === params.tableId);
    if (!table) return { success: false, error: "Selected table not found." };
    if (!table.is_active) return { success: false, error: "This table is currently disabled." };
    if (table.status === "maintenance") return { success: false, error: "This table is under scheduled maintenance." };

    const start = new Date(params.startTime);
    const end = new Date(start.getTime() + params.durationMinutes * 60000);

    if (isNaN(start.getTime()) || params.durationMinutes <= 0) {
      return { success: false, error: "Invalid booking start time or duration." };
    }

    // 2. Strict overlapping check (startA < endB && endA > startB)
    const conflict = data.bookings.find((b) => {
      if (b.table_id !== params.tableId) return false;
      if (["cancelled", "no_show", "completed"].includes(b.status)) return false;

      const bStart = new Date(b.start_time);
      const bEnd = new Date(b.end_time);

      return start < bEnd && end > bStart;
    });

    if (conflict) {
      return {
        success: false,
        error: `Slot conflict: Table is already reserved from ${new Date(conflict.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} to ${new Date(conflict.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Please select another slot or table.`,
      };
    }

    // 3. Customer handling
    const cleanPhone = params.customerPhone.trim().replace(/\D/g, "").slice(-10);
    let customer = data.profiles.find((p) => p.phone.slice(-10) === cleanPhone);

    if (!customer) {
      customer = {
        id: `cust-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        full_name: params.customerName.trim(),
        phone: cleanPhone,
        email: params.customerEmail?.trim() || null,
        role: "customer",
        visit_count: 0,
        total_spend: 0,
        total_playing_minutes: 0,
        pending_dues: 0,
        last_visit: null,
        no_show_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      data.profiles.push(customer);
    } else {
      if (params.customerName) customer.full_name = params.customerName.trim();
      if (params.customerEmail) customer.email = params.customerEmail.trim();
      customer.updated_at = new Date().toISOString();
    }

    // 4. Rate & pricing calculation
    const hourlyRate = Number(table.hourly_rate);
    const estimatedPrice = Math.round((hourlyRate * params.durationMinutes) / 60);
    const depositAmount = Math.round((estimatedPrice * data.settings.deposit_percentage) / 100);

    // 5. Grace period deadline calculation: at least graceMinutes after start AND at least graceMinutes from booking creation
    const graceMinutes = data.settings.grace_period_minutes || 10;
    const graceDeadline = new Date(Math.max(start.getTime(), Date.now()) + graceMinutes * 60000).toISOString();

    const booking: Booking = {
      id: `book-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      customer_id: customer.id,
      table_id: table.id,
      booking_date: start.toISOString().slice(0, 10),
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      duration_minutes: params.durationMinutes,
      status: "confirmed",
      booking_type: params.bookingType,
      deposit_amount: depositAmount,
      estimated_price: estimatedPrice,
      grace_deadline: graceDeadline,
      cancellation_reason: null,
      penalty_amount: 0,
      refund_amount: 0,
      notes: params.notes || null,
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    data.bookings.push(booking);

    // Update table status to 'reserved' if currently available
    if (table.status === "available") {
      table.status = "reserved";
      table.updated_at = new Date().toISOString();
    }

    // Audit log
    data.logs.push({
      id: `log-${Date.now()}`,
      user_id: customer.id,
      action: "booking_created",
      entity_type: "booking",
      entity_id: booking.id,
      details: { table: table.name, start: booking.start_time, end: booking.end_time, price: estimatedPrice },
      created_at: new Date().toISOString(),
    });

    saveStore(data);

    return {
      success: true,
      booking: {
        ...booking,
        table,
        customer,
      },
    };
  },

  /**
   * Check in a booking (starts session & timer, marks table in_play)
   */
  checkInBooking(bookingId: string): { success: boolean; session?: Session; error?: string } {
    const data = ensureStore();
    const booking = data.bookings.find((b) => b.id === bookingId);
    if (!booking) return { success: false, error: "Booking not found." };

    if (booking.status === "cancelled" || booking.status === "no_show") {
      return { success: false, error: `Cannot check in a ${booking.status} booking.` };
    }

    const table = data.tables.find((t) => t.id === booking.table_id);
    if (!table) return { success: false, error: "Table not found." };

    // Check if session already exists
    let session = data.sessions.find((s) => s.booking_id === bookingId);
    if (!session) {
      session = {
        id: `sess-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        booking_id: booking.id,
        table_id: booking.table_id,
        customer_id: booking.customer_id,
        actual_start: new Date().toISOString(),
        actual_end: null,
        actual_minutes: 0,
        extended_minutes: 0,
        is_paused: false,
        pause_start: null,
        total_pause_minutes: 0,
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      data.sessions.push(session);
    } else {
      session.status = "active";
      session.is_paused = false;
      session.updated_at = new Date().toISOString();
    }

    booking.status = "in_play";
    booking.updated_at = new Date().toISOString();
    table.status = "in_play";
    table.updated_at = new Date().toISOString();

    data.logs.push({
      id: `log-${Date.now()}`,
      user_id: booking.customer_id,
      action: "check_in",
      entity_type: "session",
      entity_id: session.id,
      details: { table: table.name, actual_start: session.actual_start },
      created_at: new Date().toISOString(),
    });

    saveStore(data);
    return { success: true, session };
  },

  /**
   * Pause / Resume session timer
   */
  togglePauseSession(sessionId: string): { success: boolean; session?: Session; error?: string } {
    const data = ensureStore();
    const session = data.sessions.find((s) => s.id === sessionId);
    if (!session) return { success: false, error: "Session not found." };

    const now = new Date();
    if (!session.is_paused) {
      session.is_paused = true;
      session.pause_start = now.toISOString();
      session.status = "paused";
    } else {
      session.is_paused = false;
      if (session.pause_start) {
        const pauseMinutes = Math.round((now.getTime() - new Date(session.pause_start).getTime()) / 60000);
        session.total_pause_minutes += Math.max(0, pauseMinutes);
      }
      session.pause_start = null;
      session.status = "active";
    }
    session.updated_at = now.toISOString();
    saveStore(data);
    return { success: true, session };
  },

  /**
   * Extend an active session ONLY if the table is free for the extension window
   */
  extendSession(bookingId: string, additionalMinutes: number): { success: boolean; error?: string } {
    const data = ensureStore();
    const booking = data.bookings.find((b) => b.id === bookingId);
    if (!booking) return { success: false, error: "Booking not found." };

    const currentEnd = new Date(booking.end_time);
    const newEnd = new Date(currentEnd.getTime() + additionalMinutes * 60000);

    // Conflict check on future bookings for this table
    const conflict = data.bookings.find((b) => {
      if (b.id === booking.id || b.table_id !== booking.table_id) return false;
      if (["cancelled", "no_show", "completed"].includes(b.status)) return false;

      const bStart = new Date(b.start_time);
      const bEnd = new Date(b.end_time);
      return currentEnd < bEnd && newEnd > bStart;
    });

    if (conflict) {
      return {
        success: false,
        error: `Cannot extend: Table is booked next by another customer at ${new Date(conflict.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`,
      };
    }

    booking.end_time = newEnd.toISOString();
    booking.duration_minutes += additionalMinutes;
    const table = data.tables.find((t) => t.id === booking.table_id);
    const hourlyRate = table ? Number(table.hourly_rate) : 500;
    booking.estimated_price = Math.round((hourlyRate * booking.duration_minutes) / 60);
    booking.updated_at = new Date().toISOString();

    const session = data.sessions.find((s) => s.booking_id === booking.id);
    if (session) {
      session.extended_minutes += additionalMinutes;
      session.updated_at = new Date().toISOString();
    }

    data.logs.push({
      id: `log-${Date.now()}`,
      user_id: booking.customer_id,
      action: "session_extended",
      entity_type: "session",
      entity_id: session?.id || null,
      details: { added_minutes: additionalMinutes, new_end: newEnd.toISOString() },
      created_at: new Date().toISOString(),
    });

    saveStore(data);
    return { success: true };
  },

  /**
   * End session and prepare complete bill
   */
  endSession(sessionId: string): { success: boolean; session?: Session; payment?: Payment; error?: string } {
    const data = ensureStore();
    const session = data.sessions.find((s) => s.id === sessionId);
    if (!session) return { success: false, error: "Session not found." };

    const now = new Date();
    session.actual_end = now.toISOString();
    session.status = "completed";

    // Calculate actual elapsed minutes minus pauses
    const startTime = session.actual_start ? new Date(session.actual_start).getTime() : now.getTime();
    const rawElapsed = Math.round((now.getTime() - startTime) / 60000);
    session.actual_minutes = Math.max(1, rawElapsed - session.total_pause_minutes);
    session.updated_at = now.toISOString();

    const booking = data.bookings.find((b) => b.id === session.booking_id);
    const table = data.tables.find((t) => t.id === session.table_id);
    const customer = data.profiles.find((p) => p.id === session.customer_id);

    if (booking) {
      booking.status = "completed";
      booking.updated_at = now.toISOString();
    }

    if (table) {
      table.status = "available";
      table.updated_at = now.toISOString();
    }

    // Bill calculation based on actual minutes played (min 30 min billing rule or actual)
    const rate = table ? Number(table.hourly_rate) : 500;
    const billedMinutes = Math.max(session.actual_minutes, booking?.duration_minutes || 30);
    const subtotal = Math.round((rate * billedMinutes) / 60);

    let payment = data.payments.find((p) => p.booking_id === session.booking_id);
    if (!payment) {
      payment = {
        id: `pay-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        booking_id: session.booking_id,
        customer_id: session.customer_id,
        subtotal,
        discount_amount: 0,
        discount_reason: null,
        addon_amount: 0,
        addon_details: null,
        tax_amount: Math.round(subtotal * 0.05), // 5% GST
        total_amount: subtotal + Math.round(subtotal * 0.05),
        paid_amount: booking?.deposit_amount || 0,
        due_amount: (subtotal + Math.round(subtotal * 0.05)) - (booking?.deposit_amount || 0),
        payment_mode: null,
        payment_status: "pending",
        receipt_id: generateReceiptId(),
        paid_at: null,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };
      data.payments.push(payment);
    }

    // Customer aggregate statistics update
    if (customer) {
      customer.visit_count += 1;
      customer.total_playing_minutes += session.actual_minutes;
      customer.last_visit = now.toISOString();
      customer.pending_dues += payment.due_amount;
      customer.updated_at = now.toISOString();
    }

    data.logs.push({
      id: `log-${Date.now()}`,
      user_id: customer?.id || null,
      action: "session_ended",
      entity_type: "session",
      entity_id: session.id,
      details: { actual_minutes: session.actual_minutes, total_bill: payment.total_amount },
      created_at: now.toISOString(),
    });

    saveStore(data);
    return { success: true, session, payment };
  },

  /**
   * Record payment (Cash, UPI, Card, Partial)
   */
  recordPayment(params: {
    paymentId: string;
    paidAmount: number;
    paymentMode: PaymentMode;
    discountAmount?: number;
    discountReason?: string;
    addonAmount?: number;
    notes?: string;
  }): { success: boolean; payment?: Payment; error?: string } {
    const data = ensureStore();
    const payment = data.payments.find((p) => p.id === params.paymentId);
    if (!payment) return { success: false, error: "Payment record not found." };

    const discount = params.discountAmount || 0;
    const addon = params.addonAmount || 0;
    payment.discount_amount = discount;
    payment.discount_reason = params.discountReason || null;
    payment.addon_amount = addon;

    const baseAmount = payment.subtotal - discount + addon;
    payment.tax_amount = Math.round(baseAmount * 0.05);
    payment.total_amount = baseAmount + payment.tax_amount;

    payment.paid_amount += params.paidAmount;
    payment.due_amount = Math.max(0, payment.total_amount - payment.paid_amount);
    payment.payment_mode = params.paymentMode;
    payment.payment_status = payment.due_amount === 0 ? "paid" : "partial";
    payment.paid_at = new Date().toISOString();
    payment.updated_at = new Date().toISOString();

    // Update customer spend & dues
    const customer = data.profiles.find((p) => p.id === payment.customer_id);
    if (customer) {
      customer.total_spend += params.paidAmount;
      customer.pending_dues = Math.max(0, customer.pending_dues - params.paidAmount);
      customer.updated_at = new Date().toISOString();
    }

    data.logs.push({
      id: `log-${Date.now()}`,
      user_id: customer?.id || null,
      action: "payment_recorded",
      entity_type: "payment",
      entity_id: payment.id,
      details: { receipt: payment.receipt_id, amount: params.paidAmount, mode: params.paymentMode, status: payment.payment_status },
      created_at: new Date().toISOString(),
    });

    saveStore(data);
    return { success: true, payment };
  },

  /**
   * CRITICAL HACKATHON REQUIREMENT:
   * Automatic No-Show Processing based on Grace Deadline expiration.
   */
  processNoShows(): { count: number; processed: string[] } {
    const data = ensureStore();
    const now = new Date();
    const processed: string[] = [];

    data.bookings.forEach((booking) => {
      if (booking.status === "confirmed" && booking.grace_deadline) {
        const deadline = new Date(booking.grace_deadline);
        const createdAt = new Date(booking.created_at || 0);

        // Safety: Do not mark no-show if created within the last 15 minutes
        if ((now.getTime() - createdAt.getTime()) < 15 * 60000) {
          return;
        }

        if (now > deadline) {
          booking.status = "no_show";
          booking.cancellation_reason = "Automatic system expiration: Grace period exceeded without check-in.";
          booking.penalty_amount = booking.deposit_amount; // Deposit forfeited per club policy
          booking.updated_at = now.toISOString();

          // Release the table only if no other active/upcoming reservation exists
          const table = data.tables.find((t) => t.id === booking.table_id);
          if (table && table.status === "reserved") {
            const hasOtherUpcoming = data.bookings.some(
              (b) =>
                b.id !== booking.id &&
                b.table_id === table.id &&
                b.status === "confirmed" &&
                new Date(b.start_time).getTime() - now.getTime() <= 30 * 60000 &&
                new Date(b.end_time).getTime() > now.getTime()
            );
            if (!hasOtherUpcoming) {
              table.status = "available";
              table.updated_at = now.toISOString();
            }
          }

          // Increment customer no-show count
          const customer = data.profiles.find((p) => p.id === booking.customer_id);
          if (customer) {
            customer.no_show_count += 1;
            customer.updated_at = now.toISOString();
          }

          data.logs.push({
            id: `log-${Date.now()}`,
            user_id: customer?.id || null,
            action: "auto_no_show",
            entity_type: "booking",
            entity_id: booking.id,
            details: { deadline: booking.grace_deadline, table: table?.name, deposit_forfeited: booking.deposit_amount },
            created_at: now.toISOString(),
          });

          processed.push(booking.id);
        }
      }
    });

    if (processed.length > 0) {
      saveStore(data);
    }

    return { count: processed.length, processed };
  },

  /**
   * CRITICAL HACKATHON REQUIREMENT:
   * Restore a no-show or cancelled booking ONLY after strict server-side validation.
   * Rejects if slot is booked, active session exists, table is in maintenance, or slot has ended.
   */
  restoreBooking(bookingId: string): { success: boolean; booking?: Booking; error?: string } {
    const data = ensureStore();
    const booking = data.bookings.find((b) => b.id === bookingId);
    if (!booking) {
      return { success: false, error: "Booking record not found." };
    }

    // 1. Guard against repeated clicks / duplicate restoration
    if (booking.status === "confirmed" || booking.status === "in_play") {
      return { success: false, error: "This booking is already active and cannot be restored again." };
    }
    if (booking.status !== "no_show" && booking.status !== "cancelled") {
      return { success: false, error: `Cannot restore booking in '${booking.status}' status.` };
    }

    const now = new Date();
    const reqStart = new Date(booking.start_time);
    const reqEnd = new Date(booking.end_time);

    // 2. Validate that the reservation interval has not expired in the past
    if (reqEnd.getTime() <= now.getTime()) {
      return {
        success: false,
        error: "Cannot restore this booking because its scheduled time interval has already ended.",
      };
    }

    // 3. Validate Table status & maintenance
    const table = data.tables.find((t) => t.id === booking.table_id);
    if (!table) {
      return { success: false, error: "The table assigned to this booking does not exist." };
    }
    if (!table.is_active) {
      return { success: false, error: "Cannot restore this booking because the assigned table is currently disabled." };
    }
    if (table.status === "maintenance") {
      return {
        success: false,
        error: `Cannot restore this booking because ${table.name} is currently under maintenance.`,
      };
    }

    // 4. Validate Table Active Session (walk-in or other playing session currently in progress)
    const activeSession = data.sessions.find(
      (s) => s.table_id === booking.table_id && s.status === "active"
    );
    if (activeSession) {
      return {
        success: false,
        error: `Cannot restore this booking because ${table.name} currently has an active playing session.`,
      };
    }

    // 5. Strict conflict check against all other confirmed, checked_in, or in_play bookings on this table
    const bufferMinutes = data.settings.buffer_minutes || 0;
    const bufferMs = bufferMinutes * 60000;

    const conflict = data.bookings.find((b) => {
      if (b.id === booking.id) return false;
      if (b.table_id !== booking.table_id) return false;
      if (b.status === "cancelled" || b.status === "no_show" || b.status === "completed") return false;

      const otherStart = new Date(b.start_time).getTime();
      const otherEnd = new Date(b.end_time).getTime();

      // Check direct interval overlap or buffer overlap
      const hasDirectOverlap = reqStart.getTime() < otherEnd && reqEnd.getTime() > otherStart;
      const hasBufferOverlap =
        reqStart.getTime() < (otherEnd + bufferMs) && reqEnd.getTime() > (otherStart - bufferMs);

      return hasDirectOverlap || hasBufferOverlap;
    });

    if (conflict) {
      return {
        success: false,
        error: "Cannot restore this booking because the time slot has already been reserved.",
      };
    }

    // 6. Restoration Execution
    booking.status = "confirmed";
    booking.cancellation_reason = null;
    booking.penalty_amount = 0; // Clear penalty since booking is reinstated

    // Set new grace deadline: at least 10 minutes from now or original start grace
    const graceMinutes = data.settings.grace_period_minutes || 10;
    const computedDeadline = new Date(Math.max(reqStart.getTime(), now.getTime()) + graceMinutes * 60000);
    // Grace deadline cannot exceed booking end time
    booking.grace_deadline = new Date(Math.min(reqEnd.getTime(), computedDeadline.getTime())).toISOString();
    booking.updated_at = now.toISOString();

    // 7. Update table status if restored booking is starting soon
    const timeUntilStart = reqStart.getTime() - now.getTime();
    if (timeUntilStart <= 30 * 60000 && reqEnd.getTime() > now.getTime()) {
      table.status = "reserved";
      table.updated_at = now.toISOString();
    }

    // 8. Reconcile customer no_show_count without deleting history
    const customer = data.profiles.find((p) => p.id === booking.customer_id);
    if (customer && customer.no_show_count > 0) {
      customer.no_show_count -= 1;
      customer.updated_at = now.toISOString();
    }

    // 9. Append audit log entry preserving full event history
    data.logs.push({
      id: `log-${Date.now()}`,
      user_id: customer?.id || null,
      action: "booking_restored",
      entity_type: "booking",
      entity_id: booking.id,
      details: {
        table_id: table.id,
        table_name: table.name,
        slot_start: booking.start_time,
        slot_end: booking.end_time,
        deposit_preserved: booking.deposit_amount,
        grace_deadline: booking.grace_deadline,
      },
      created_at: now.toISOString(),
    });

    saveStore(data);
    return { success: true, booking };
  },

  reinstateBooking(bookingId: string): { success: boolean; booking?: Booking; error?: string } {
    return this.restoreBooking(bookingId);
  },

  /**
   * Customer complete visit history
   */
  getCustomerHistory(customerId: string): {
    customer: Profile | null;
    visits: Array<{
      booking: Booking;
      session?: Session;
      payment?: Payment;
      table?: Table;
    }>;
  } {
    const data = this.getData();
    const customer = data.profiles.find((p) => p.id === customerId) || null;
    if (!customer) return { customer: null, visits: [] };

    const customerBookings = data.bookings.filter((b) => b.customer_id === customerId);
    const visits = customerBookings.map((b) => ({
      booking: b,
      session: data.sessions.find((s) => s.booking_id === b.id),
      payment: data.payments.find((p) => p.booking_id === b.id),
      table: data.tables.find((t) => t.id === b.table_id),
    }));

    // Sort newest first
    visits.sort((a, b) => new Date(b.booking.start_time).getTime() - new Date(a.booking.start_time).getTime());

    return { customer, visits };
  },
};
