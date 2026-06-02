// HHFC RELEASE CANDIDATE FINAL
import { supabase } from "./supabase";
import * as FileSystem from "expo-file-system/legacy";
import { Buffer } from "buffer";

// =====================================================
// HHFC PRE-LAUNCH FLAGS
// =====================================================

export const OPENING_MODE = true;
export const BETTING_ENABLED = false;
export const OFFICIAL_OPENING_DATE = "2026-05-26T18:00:00.000Z";

function isHiddenFront(row: any) {
  return !!row?.hidden_from_front;
}


function assertSupabase() {
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
}

function upper(value: any) {
  return String(value || "").trim().toUpperCase();
}

function maybeOne<T = any>(rows: T[] | T | null | undefined): T | null {
  return Array.isArray(rows) ? rows[0] || null : (rows as T | null);
}

function normalizeIdentityValue(value: any) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[-_.]/g, "");
}

function money(value: any) {
  return Math.max(0, Math.floor(Math.max(0, Number(value || 0))));
}

function currencyCents(value: any) {
  return Math.round(Math.max(0, Number(value || 0)));
}

function ratio(numerator: number, denominator: number, fallback: number) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return fallback;
  const raw = numerator / denominator;
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.max(1.01, Math.round(raw * 100) / 100);
}

export function normalizeVerificationStatus(value: any) {
  const status = upper(value || "PENDING");
  if (status === "APPROVED") return "VERIFIED";
  return status;
}

function normalizeBookmakerStatus(value: any) {
  const status = upper(value || "NONE");
  if (!status) return "NONE";
  if (status === "APPROVED") return "APPROVED";
  if (status === "PENDING") return "PENDING";
  if (status === "REJECTED") return "REJECTED";
  return status;
}

function normalizeUserProfile(row: any, bookmakerProfile?: any | null) {
  const role = String(row?.role || "fighter").toLowerCase();
  const bookmakerStatus = normalizeBookmakerStatus(
    bookmakerProfile?.status ?? row?.bookmaker_status ?? (role === "bookmaker" ? "APPROVED" : "NONE")
  );
  const bookmakerCode = String(
    bookmakerProfile?.referral_code || row?.bookmaker_code || ""
  )
    .trim()
    .toUpperCase();

  return {
    ...row,
    role,
    verification_status: normalizeVerificationStatus(row?.verification_status),
    bookmaker_status: bookmakerStatus,
    bookmaker_code: bookmakerCode || null,
    referred_by_bookmaker_code: String(row?.referred_by_bookmaker_code || "").trim().toUpperCase() || null,
  };
}

function createStorageFileName(folder: string, uri: string) {
  const extMatch = String(uri || "").match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  const ext = (extMatch?.[1] || "jpg").toLowerCase();
  return `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

function guessContentType(uri: string) {
  const lower = String(uri || "").toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

async function ensureReadableFileUri(uri: string) {
  if (!uri) throw new Error("IMAGE_URI_MISSING");
  if (String(uri).startsWith("file://")) return String(uri);

  const extMatch = String(uri || "").match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  const ext = (extMatch?.[1] || "jpg").toLowerCase();
  const target = `${FileSystem.cacheDirectory}hh_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  await FileSystem.copyAsync({ from: uri, to: target });
  return target;
}

async function uriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const safeUri = await ensureReadableFileUri(uri);
  const base64 = await FileSystem.readAsStringAsync(safeUri, {
    encoding: "base64" as any,
  });
  const buffer = Buffer.from(base64, "base64");
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
}

async function addWalletTransaction(params: {
  userId: string;
  direction: "IN" | "OUT";
  category: string;
  subcategory: string;
  amountTotal: number;
  status: string;
  sourceTable?: string | null;
  sourceId?: string | null;
  note?: string | null;
  createdByStaffId?: string | null;
}) {
  const { data, error } = await supabase
    .from("wallet_transactions")
    .insert({
      user_id: params.userId,
      direction: params.direction,
      category: params.category,
      subcategory: params.subcategory,
      amount_total: money(params.amountTotal),
      status: params.status,
      source_table: params.sourceTable || null,
      source_id: params.sourceId || null,
      note: params.note || null,
      created_by_staff_id: params.createdByStaffId || null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return normalizeFinanceEntry(data);
}

async function loadUserWallet(userId: string) {
  const { data, error } = await supabase
    .from("users")
    .select("wallet_balance,wallet_bonus_balance,wallet_locked_balance,role,verification_status,bookmaker_code,referred_by_bookmaker_code")
      .eq("hidden_from_front", false)
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

async function spendWalletBalances(params: {
  userId: string;
  amount: number;
  amountCents?: number;
  category: string;
  subcategoryCash: string;
  subcategoryBonus: string;
  status: string;
  sourceTable?: string | null;
  sourceId?: string | null;
  note?: string | null;
}) {
  const amount = money(params.amountCents ?? params.amount);
  const user = await loadUserWallet(params.userId);
  const cash = Number(user.wallet_balance || 0);
  const bonus = Number(user.wallet_bonus_balance || 0);
  const totalAvailable = cash + bonus;

  if (totalAvailable < amount) {
    throw new Error("INSUFFICIENT_WALLET_BALANCE");
  }

  const bonusUsed = Math.min(bonus, amount);
  const cashUsed = Math.max(0, amount - bonusUsed);

  const { error: updateError } = await supabase
    .from("users")
    .update({
      wallet_balance: cash - cashUsed,
      wallet_bonus_balance: bonus - bonusUsed,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.userId);
  if (updateError) throw updateError;

  if (bonusUsed > 0) {
    await addWalletTransaction({
      userId: params.userId,
      direction: "OUT",
      category: params.category,
      subcategory: params.subcategoryBonus,
      amountTotal: bonusUsed,
      status: params.status,
      sourceTable: params.sourceTable || null,
      sourceId: params.sourceId || null,
      note: params.note ? `${params.note} | bonus wallet` : "Bonus wallet used",
    });
  }

  if (cashUsed > 0) {
    await addWalletTransaction({
      userId: params.userId,
      direction: "OUT",
      category: params.category,
      subcategory: params.subcategoryCash,
      amountTotal: cashUsed,
      status: params.status,
      sourceTable: params.sourceTable || null,
      sourceId: params.sourceId || null,
      note: params.note ? `${params.note} | cash wallet` : "Cash wallet used",
    });
  }

  return {
    bonusUsed,
    cashUsed,
    remainingCash: cash - cashUsed,
    remainingBonus: bonus - bonusUsed,
  };
}

function mapFight(row: any) {
  const fightType = upper(row?.fight_type || row?.fight_tier || row?.league || "STANDARD");
  const uiTier = fightType === "TITLE" ? "TITLE" : fightType === "MAIN_EVENT" ? "MAIN_EVENT" : "STANDARD";
  return {
    id: row?.id,
    status: normalizeFightStatusForUi(row?.status || "SCHEDULED"),
    scheduled_at: row?.scheduled_at,
    fight_type: fightType,
    fight_tier: uiTier,
    league: row?.league || null,
    is_title: !!row?.is_title || fightType === "TITLE",
    stake_cents: money(row?.stake_cents ?? row?.stake_amount ?? row?.stake ?? row?.stack_cents ?? 0),
    stake: money(row?.stake_cents ?? row?.stake_amount ?? row?.stake ?? row?.stack_cents ?? 0),
    prize_pool_cents: money(row?.prize_pool_cents ?? row?.prize_pool ?? 0),
    prize_pool: money(row?.prize_pool_cents ?? row?.prize_pool ?? 0),
    winner_payout_cents: money(row?.winner_payout_cents ?? row?.winner_payout ?? row?.prize_pool_cents ?? row?.prize_pool ?? 0),
    winner_id: row?.winner_id || null,
    result_method: row?.result_method || null,
    fighter_a: row?.fighter_a,
    fighter_b: row?.fighter_b,
    fighter_a_id: row?.fighter_a,
    fighter_b_id: row?.fighter_b,
    fighter_a_name: row?.fighter_a_profile?.rp_name || "FIGHTER A",
    fighter_b_name: row?.fighter_b_profile?.rp_name || "FIGHTER B",
    fighter_a_mmr: row?.fighter_a_profile?.mmr ?? 1000,
    fighter_b_mmr: row?.fighter_b_profile?.mmr ?? 1000,
    fighter_a_avatar_url: null,
    fighter_b_avatar_url: null,
    fighter_a_wins: row?.fighter_a_profile?.wins ?? 0,
    fighter_a_losses: row?.fighter_a_profile?.losses ?? 0,
    fighter_b_wins: row?.fighter_b_profile?.wins ?? 0,
    fighter_b_losses: row?.fighter_b_profile?.losses ?? 0,
    fighter_a_odds: Number(row?.odds_current_a ?? row?.odds_open_a ?? row?.fighter_a_odds ?? row?.odds_a ?? 0) || null,
    fighter_b_odds: Number(row?.odds_current_b ?? row?.odds_open_b ?? row?.fighter_b_odds ?? row?.odds_b ?? 0) || null,
    odds_a: Number(row?.odds_current_a ?? row?.odds_open_a ?? row?.fighter_a_odds ?? row?.odds_a ?? 0) || null,
    odds_b: Number(row?.odds_current_b ?? row?.odds_open_b ?? row?.fighter_b_odds ?? row?.odds_b ?? 0) || null,
    odds_open_a: Number(row?.odds_open_a ?? 0) || null,
    odds_open_b: Number(row?.odds_open_b ?? 0) || null,
    odds_current_a: Number(row?.odds_current_a ?? 0) || null,
    odds_current_b: Number(row?.odds_current_b ?? 0) || null,
    bet_pool_a: money(row?.bet_pool_a ?? 0),
    bet_pool_b: money(row?.bet_pool_b ?? 0),
  };
}

const OFFICIAL_LEAGUE_START_DATE = "2026-04-28";
const MAIN_EVENT_START_DATE = "2026-04-28";

function getArenaNightDateKey(row: any) {
  const raw = String(row?.night_date || row?.starts_at || "").trim();
  return raw ? raw.slice(0, 10) : "";
}

function isDateOnOrAfter(dateKey: string, minDate: string) {
  return !!dateKey && dateKey >= minDate;
}

function isOfficialMainEvent(row: any) {
  const dateKey = getArenaNightDateKey(row);
  return upper(row?.night_type) === "MAIN_EVENT" && isDateOnOrAfter(dateKey, MAIN_EVENT_START_DATE);
}

function shouldExposeArenaNight(row: any) {
  const dateKey = getArenaNightDateKey(row);
  if (!isDateOnOrAfter(dateKey, OFFICIAL_LEAGUE_START_DATE)) return false;
  const nightType = upper(row?.night_type || "FIGHT_NIGHT");
  if (nightType === "MAIN_EVENT") return isOfficialMainEvent(row);
  return nightType === "FIGHT_NIGHT" || nightType === "LEAGUE" || nightType === "";
}

function normalizeArenaNight(row: any) {
  const dateKey = getArenaNightDateKey(row);
  const isMainEvent = isOfficialMainEvent(row);
  const note = String(row?.note || "").trim();
  const nightType = upper(row?.night_type || "FIGHT_NIGHT");
  const fallbackTitle = isMainEvent ? "Main Event Dimanche" : "League Night";

  return {
    ...row,
    event_id: row?.id,
    arena_night_id: row?.id,
    title: note || fallbackTitle,
    event_date: row?.night_date || row?.starts_at || null,
    standard_price: Number(row?.standard_ticket_price_cents || (isMainEvent ? 15000 : 2500)),
    vip_price: Number(row?.vip_ticket_price_cents || (isMainEvent ? 20000 : 5000)),
    is_event: isMainEvent,
    is_main_event: isMainEvent,
    is_league_night: !isMainEvent,
    ui_type_label: isMainEvent ? "SUNDAY EVENT" : "LEAGUE NIGHT",
    date_key: dateKey,
    raw_night_type: nightType,
  };
}

function normalizeArenaTicket(row: any, nightsById?: Map<string, any>) {
  const night = nightsById?.get(String(row?.arena_night_id || ""));
  return {
    ...row,
    event_id: row?.arena_night_id || null,
    user_id: row?.buyer_user_id || null,
    buyer_user_id: row?.buyer_user_id || null,
    access_type: upper(row?.ticket_type || "STANDARD"),
    ticket_type: upper(row?.ticket_type || "STANDARD"),
    amount: Number(row?.price_cents ?? row?.amount ?? 0),
    price_cents: Number(row?.price_cents ?? row?.amount ?? 0),
    used_at: row?.checked_in_at || null,
    checked_in_at: row?.checked_in_at || null,
    checked_in_by_staff_id: row?.checked_in_by_staff_id || null,
    event_date: night?.event_date || null,
    title: night?.title || null,
    standard_price: night?.standard_price ?? null,
    vip_price: night?.vip_price ?? null,
  };
}

function normalizeFinanceEntry(row: any) {
  const createdAt = row?.created_at || null;
  return {
    ...row,
    amount_cents: Number(row?.amount_cents ?? row?.amount_total ?? 0),
    amount_total: Number(row?.amount_total ?? row?.amount_cents ?? 0),
    business_date:
      row?.business_date ||
      (createdAt ? new Date(createdAt).toISOString().slice(0, 10) : null),
    source_type: row?.source_type || row?.source_table || null,
    direction: upper(row?.direction || ""),
    category: String(row?.category || ""),
    subcategory: String(row?.subcategory || ""),
    status: upper(row?.status || "OPEN"),
  };
}

function normalizeFightStatusForUi(status: any) {
  const s = upper(status || "SCHEDULED");
  if (s === "STARTED") return "LIVE";
  return s;
}

function normalizeWalletRequest(row: any) {
  return {
    ...row,
    amount_cents: money(row?.amount_cents ?? row?.amount ?? 0),
    amount: money(row?.amount_cents ?? row?.amount ?? 0),
    status: upper(row?.status || "PENDING"),
    user: row?.user || null,
  };
}

function normalizeWalletSnapshot(row: any) {
  return {
    wallet_balance: money(row?.wallet_balance),
    wallet_bonus_balance: money(row?.wallet_bonus_balance),
    wallet_locked_balance: money(row?.wallet_locked_balance),
  };
}

/* =========================
   AUTH / STAFF
========================= */

export async function staffLogin(params: {
  staffName: string;
  pin: string;
  deviceLabel?: string | null;
}) {
  assertSupabase();

  const username = String(params.staffName || "").trim();
  const pin = String(params.pin || "").trim();
  const deviceLabel = params.deviceLabel || "MOBILE_APP";

  if (!username || !pin) {
    throw new Error("STAFF_ACCESS_DENIED");
  }

  const startedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

  const rpcAttempts: Array<{ name: string; payload: Record<string, any> }> = [
    {
      name: "staff_login",
      payload: {
        p_username: username,
        p_pin: pin,
        p_device_label: deviceLabel,
      },
    },
    {
      name: "staff_login",
      payload: {
        p_staff_name: username,
        p_pin: pin,
        p_device_label: deviceLabel,
      },
    },
    {
      name: "staff_login",
      payload: {
        p_username: username,
        p_pin: pin,
      },
    },
    {
      name: "staff_login",
      payload: {
        p_staff_name: username,
        p_pin: pin,
      },
    },
  ];

  for (const attempt of rpcAttempts) {
    try {
      const { data, error } = await supabase.rpc(attempt.name as any, attempt.payload);
      if (error) continue;
      const payload = Array.isArray(data) ? data[0] : data;
      if (!payload) continue;

      const safeToken = String(payload?.token || "").trim();
      const safeStaffId = String(payload?.staffId || payload?.staff_id || payload?.id || "").trim();
      const safeRole = upper(payload?.role || "STAFF");
      const safeStaffName = String(payload?.staffName || payload?.staff_name || payload?.username || username).trim();

      if (safeToken && safeStaffId) {
        return {
          token: safeToken,
          staffId: safeStaffId,
          id: safeStaffId,
          role: safeRole,
          staffName: upper(safeStaffName),
          deviceLabel,
          startedAt: String(payload?.startedAt || payload?.started_at || startedAt),
          expiresAt: String(payload?.expiresAt || payload?.expires_at || expiresAt),
        };
      }
    } catch {
      // fall through to next attempt
    }
  }

  const normalized = normalizeIdentityValue(username);

  const { data, error } = await supabase
    .from("staff_accounts")
    .select("id,username,role,is_active,pin_hash")
    .eq("is_active", true);

  if (error) throw error;

  const match = (data || []).find((row: any) => {
    const sameName = normalizeIdentityValue(row?.username) === normalized;
    const plainPinMatch = String(row?.pin_hash || "").trim() === pin;
    return sameName && plainPinMatch;
  });

  if (!match?.id) throw new Error("STAFF_ACCESS_DENIED");

  const sessionToken = `${match.id}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;

  return {
    token: sessionToken,
    staffId: match.id,
    id: match.id,
    role: upper(match.role || "STAFF"),
    staffName: upper(match.username || username),
    deviceLabel,
    startedAt,
    expiresAt,
  };
}

/* =========================
   PROFILE / USERS
========================= */

export async function fetchMyProfile(userId: string) {
  assertSupabase();
  const [{ data, error }, bookmakerProfileRes] = await Promise.all([
    supabase.from("users").select("*")
      .eq("hidden_from_front", false).eq("id", userId).maybeSingle(),
    supabase
      .from("bookmaker_profiles")
      .select("user_id,status,referral_code,commission_fighters_bps,commission_bettors_bps,commission_tickets_bps,approved_at")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (error) throw error;
  if (bookmakerProfileRes?.error) throw bookmakerProfileRes.error;
  return normalizeUserProfile(data, bookmakerProfileRes?.data || null);
}

export async function findUserByRpName(rpName: string) {
  assertSupabase();
  const clean = upper(rpName);
  if (!clean) return null;
  const { data, error } = await supabase
    .from("users")
    .select("*")
      .eq("hidden_from_front", false)
    .eq("rp_name", clean)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function loginWithProfileCode(rpName: string, code: string) {
  assertSupabase();

  const cleanRpName = upper(rpName);
  const cleanCode = String(code || "").trim();

  if (!cleanRpName) {
    throw new Error("ACCOUNT_RECOVERY_RP_NAME_REQUIRED");
  }

  if (!cleanCode) {
    throw new Error("ACCOUNT_RECOVERY_CODE_REQUIRED");
  }

  const { data, error } = await supabase.rpc("login_with_access_code", {
    p_rp_name: cleanRpName,
    p_code: cleanCode,
  });

  if (error) throw error;

  const row = maybeOne<any>(data);
  if (!row?.id) {
    throw new Error("ACCOUNT_RECOVERY_CODE_INVALID");
  }

  return fetchMyProfile(String(row.id));
}

export async function findBookmakerByCode(bookmakerCode: string, currentUserId?: string | null) {
  assertSupabase();
  const clean = upper(bookmakerCode);
  if (!clean) return null;

  let owner: any = null;

  const usersLookup = await supabase
    .from("users")
    .select("id,rp_name,role,bookmaker_code,bookmaker_status,verification_status")
      .eq("hidden_from_front", false)
    .eq("bookmaker_code", clean)
    .eq("role", "bookmaker")
    .maybeSingle();

  if (!usersLookup.error && usersLookup.data?.id) owner = usersLookup.data;

  if (!owner) {
    const profileLookup = await supabase
      .from("bookmaker_profiles")
      .select("user_id,referral_code,status")
      .eq("referral_code", clean)
      .maybeSingle();

    if (!profileLookup.error && profileLookup.data?.user_id) {
      const { data: profileUser, error: profileUserError } = await supabase
        .from("users")
        .select("id,rp_name,role,verification_status")
      .eq("hidden_from_front", false)
        .eq("id", profileLookup.data.user_id)
        .maybeSingle();
      if (profileUserError) throw profileUserError;
      owner = {
        ...(profileUser || {}),
        id: profileLookup.data.user_id,
        bookmaker_code: clean,
        bookmaker_status: profileLookup.data.status || "APPROVED",
      };
    }
  }

  if (!owner?.id) return null;
  if (currentUserId && String(owner.id) === String(currentUserId)) {
    throw new Error("BOOKMAKER_SELF_REFERRAL_FORBIDDEN");
  }
  return owner;
}

export async function recoverUserAccountByIdentity(params: {
  rpName: string;
  phone?: string | null;
}) {
  const user = await findUserByRpName(params.rpName);
  if (!user?.id) throw new Error("ACCOUNT_NOT_FOUND");

  const askedPhone = normalizeIdentityValue(params.phone);
  const existingPhone = normalizeIdentityValue(user.phone);
  if (askedPhone && existingPhone && askedPhone !== existingPhone) {
    throw new Error("ACCOUNT_RECOVERY_IDENTITY_MISMATCH");
  }
  return user;
}

export async function rotateAccountRecoveryCode(userId: string) {
  assertSupabase();
  const { data, error } = await supabase.rpc("rotate_account_recovery_code", {
    p_user_id: userId,
  });
  if (error) throw error;
  const code = String(data || "").trim().toUpperCase();
  if (!code) throw new Error("RECOVERY_CODE_GENERATION_FAILED");
  return code;
}

export async function recoverUserAccountByCode(params: {
  rpName: string;
  recoveryCode: string;
}) {
  assertSupabase();
  const rpName = upper(params.rpName);
  const recoveryCode = String(params.recoveryCode || "").trim().toUpperCase();

  if (!rpName) throw new Error("ACCOUNT_RECOVERY_RP_NAME_REQUIRED");
  if (!recoveryCode) throw new Error("ACCOUNT_RECOVERY_CODE_REQUIRED");

  const { data, error } = await supabase.rpc("recover_user_with_code", {
    p_rp_name: rpName,
    p_recovery_code: recoveryCode,
  });
  if (error) throw error;

  const recovered = maybeOne(data);
  if (!recovered?.id) throw new Error("ACCOUNT_RECOVERY_CODE_INVALID");

  return fetchMyProfile(String(recovered.id));
}

export async function upsertUser(params: {
  userId?: string | null;
  rpName: string;
  role: "fighter" | "bettor" | "bookmaker";
  realName?: string | null;
  phone?: string | null;
  idCardImageUrl?: string | null;
  publicAvatarUrl?: string | null;
  bookmakerCode?: string | null;
  referredByBookmakerCode?: string | null;
}) {
  assertSupabase();

  const payload: any = {
    rp_name: upper(params.rpName),
    role: params.role,
    phone: params.phone || null,
  };

  if (params.bookmakerCode !== undefined) {
    if (params.role !== "bookmaker") {
      throw new Error("BOOKMAKER_CODE_ROLE_NOT_ALLOWED");
    }
    payload.bookmaker_code = String(params.bookmakerCode || "").trim().toUpperCase() || null;
  }

  if (params.referredByBookmakerCode !== undefined) {
    const cleanReferral = String(params.referredByBookmakerCode || "").trim().toUpperCase() || null;
    if (!cleanReferral) {
      payload.referred_by_bookmaker_code = null;
    } else {
      const bookmakerOwner = await findBookmakerByCode(cleanReferral, params.userId || null);
      if (!bookmakerOwner?.id) {
        throw new Error("BOOKMAKER_CODE_INVALID");
      }
      payload.referred_by_bookmaker_code = cleanReferral;
    }
  }

  if (params.idCardImageUrl) payload.id_card_image_url = params.idCardImageUrl;
  if (params.publicAvatarUrl) payload.public_avatar_url = params.publicAvatarUrl;

  if (params.userId) {
    const currentProfile = await fetchMyProfile(params.userId);
    if (!currentProfile?.id) {
      throw new Error("PROFILE_NOT_FOUND");
    }

    if (params.referredByBookmakerCode !== undefined) {
      const currentReferral = String(currentProfile?.referred_by_bookmaker_code || "").trim().toUpperCase();
      const nextReferral = String(payload.referred_by_bookmaker_code || "").trim().toUpperCase();
      if (currentReferral && nextReferral !== currentReferral) {
        throw new Error("BOOKMAKER_REFERRAL_LOCKED");
      }
      if (currentReferral && !nextReferral) {
        payload.referred_by_bookmaker_code = currentReferral;
      }
    }

    if (upper(currentProfile?.role) === "BOOKMAKER") {
      payload.role = "bookmaker";
    }

    const { data, error } = await supabase
      .from("users")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", params.userId)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  const existing = await findUserByRpName(payload.rp_name);
  if (existing?.id) {
    const existingPhone = normalizeIdentityValue(existing.phone);
    const nextPhone = normalizeIdentityValue(params.phone);
    if (existingPhone && nextPhone && existingPhone !== nextPhone) {
      throw new Error("ACCOUNT_ALREADY_EXISTS_USE_RECOVERY");
    }
    return existing;
  }

  const { data, error } = await supabase
    .from("users")
    .insert({
      ...payload,
      verification_status: "PENDING",
      wallet_balance: 0,
      wallet_bonus_balance: 0,
      wallet_locked_balance: 0,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function uploadImageToStorage(params: {
  bucket?: string;
  folder: string;
  userId: string;
  uri: string;
}) {
  assertSupabase();
  const bucket = params.bucket || "hh_proofs";
  const folder = String(params.folder || "profiles").replace(/^\/+|\/+$/g, "");
  const filePath = createStorageFileName(`${folder}/${params.userId}`, params.uri);
  const body = await uriToArrayBuffer(params.uri);

  const { error } = await supabase.storage.from(bucket).upload(filePath, body, {
    upsert: true,
    contentType: guessContentType(params.uri),
  });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}

export async function submitProfileVerification(params: {
  userId: string;
  proofImageUrl: string;
}) {
  assertSupabase();

  const { data, error } = await supabase
    .from("profile_verifications")
    .insert({
      user_id: params.userId,
      proof_image_url: params.proofImageUrl,
      status: "PENDING",
    })
    .select("*")
    .single();
  if (error) throw error;

  await supabase
    .from("users")
    .update({
      verification_status: "PENDING",
      id_card_image_url: params.proofImageUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.userId);

  return data;
}

export async function fetchLatestProfileVerification(userId: string) {
  assertSupabase();
  const { data, error } = await supabase
    .from("profile_verifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateUserRoleWithReset(
  userId: string,
  nextRole: "fighter" | "bettor"
) {
  assertSupabase();
  const { data, error } = await supabase
    .from("users")
    .update({ role: nextRole, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function staffListPendingProfileVerifications() {
  assertSupabase();
  const { data, error } = await supabase
    .from("profile_verifications")
    .select(`
      *,
      user:users(id,rp_name,role,verification_status,id_card_image_url,phone)
    `)
    .eq("status", "PENDING")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(normalizeWalletRequest);
}

export async function staffApproveProfileVerification(params: {
  verificationId: string;
  staffId?: string | null;
  note?: string | null;
}) {
  assertSupabase();
  const { data: verification, error: readError } = await supabase
    .from("profile_verifications")
    .select("*")
    .eq("id", params.verificationId)
    .single();
  if (readError) throw readError;

  const { data: updatedVerification, error: verificationError } = await supabase
    .from("profile_verifications")
    .update({
      status: "APPROVED",
      note: params.note || "KYC validé",
      reviewed_by_staff_id: params.staffId || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", params.verificationId)
    .select("*")
    .single();
  if (verificationError) throw verificationError;

  const { data: updatedUser, error: userError } = await supabase
    .from("users")
    .update({
      verification_status: "VERIFIED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", verification.user_id)
    .select("*")
    .single();
  if (userError) throw userError;

  return { verification: updatedVerification, user: updatedUser };
}

export async function staffRejectProfileVerification(params: {
  verificationId: string;
  staffId?: string | null;
  note?: string | null;
}) {
  assertSupabase();
  const { data: verification, error: readError } = await supabase
    .from("profile_verifications")
    .select("*")
    .eq("id", params.verificationId)
    .single();
  if (readError) throw readError;

  const { data: updatedVerification, error: verificationError } = await supabase
    .from("profile_verifications")
    .update({
      status: "REJECTED",
      note: params.note || "KYC refusé",
      reviewed_by_staff_id: params.staffId || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", params.verificationId)
    .select("*")
    .single();
  if (verificationError) throw verificationError;

  const { data: updatedUser, error: userError } = await supabase
    .from("users")
    .update({
      verification_status: "REJECTED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", verification.user_id)
    .select("*")
    .single();
  if (userError) throw userError;

  return { verification: updatedVerification, user: updatedUser };
}

/* =========================
   LEADERBOARD
========================= */

export async function fetchTop50() {
  assertSupabase();
  const { data, error } = await supabase
    .from("leaderboard")
    .select(`
      user_id,
      mmr,
      wins,
      losses,
      ko_wins,
      updated_at,
      user:users!leaderboard_user_id_fkey(id,rp_name,role,public_avatar_url)
    `)
    .order("mmr", { ascending: false })
    .limit(50);
  if (error) throw error;

  return (data || []).map((row: any, index: number) => ({
    user_id: row.user_id,
    rank: index + 1,
    rp_name: row.user?.rp_name || null,
    mmr: row.mmr ?? 1000,
    wins: row.wins ?? 0,
    losses: row.losses ?? 0,
    ko_wins: row.ko_wins ?? 0,
    public_avatar_url: row.user?.public_avatar_url || null,
    prestige_title: null,
    prestige_badge: null,
    prestige_score: 0,
    current_win_streak: 0,
    best_win_streak: 0,
  }));
}

/* =========================
   WALLET
========================= */

export async function fetchMyWallet(userId: string) {
  assertSupabase();
  const { data, error } = await supabase
    .from("users")
    .select("wallet_balance,wallet_bonus_balance,wallet_locked_balance")
      .eq("hidden_from_front", false)
    .eq("id", userId)
    .single();
  if (error) throw error;
  return normalizeWalletSnapshot(data || {});
}

export async function walletCreateDepositRequest(params: {
  userId: string;
  amount?: number;
  amountCents?: number;
  sourceMethod?: string | null;
  note?: string | null;
}) {
  assertSupabase();
  const { data, error } = await supabase
    .from("wallet_deposit_requests")
    .insert({
      user_id: params.userId,
      amount_cents: money(params.amountCents ?? params.amount),
      status: "PENDING",
      note: params.note || params.sourceMethod || "Recharge demandée via application par virement",
    })
    .select("*")
    .single();
  if (error) throw error;
  return normalizeWalletRequest(data);
}

export async function walletSubmitDepositProof(params: {
  userId: string;
  depositRequestId: string;
  proofImageUrl: string;
}) {
  assertSupabase();
  const { data: requestRow, error: requestError } = await supabase
    .from("wallet_deposit_requests")
    .select("*")
    .eq("id", params.depositRequestId)
    .eq("user_id", params.userId)
    .single();
  if (requestError) throw requestError;

  const nextNote = `${requestRow.note || ""}\nPROOF: ${params.proofImageUrl}`.trim();
  const { data, error } = await supabase
    .from("wallet_deposit_requests")
    .update({ note: nextNote })
    .eq("id", params.depositRequestId)
    .select("*")
    .single();
  if (error) throw error;
  return normalizeWalletRequest(data);
}

export async function fetchMyDepositRequests(userId: string) {
  assertSupabase();
  const { data, error } = await supabase
    .from("wallet_deposit_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(normalizeWalletRequest);
}

export async function walletRequestWithdraw(params: {
  userId: string;
  amount?: number;
  amountCents?: number;
  payoutMethod?: string | null;
  note?: string | null;
}) {
  assertSupabase();
  const amount = money(params.amountCents ?? params.amount);

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("wallet_balance")
      .eq("hidden_from_front", false)
    .eq("id", params.userId)
    .single();
  if (userError) throw userError;
  if (Number(user.wallet_balance || 0) < amount) throw new Error("INSUFFICIENT_WALLET_BALANCE");

  const { data, error } = await supabase
    .from("wallet_withdraw_requests")
    .insert({
      user_id: params.userId,
      amount_cents: amount,
      status: "PENDING",
      note: params.note || params.payoutMethod || "Retrait demandé via application par virement",
    })
    .select("*")
    .single();
  if (error) throw error;
  return normalizeWalletRequest(data);
}

export async function fetchMyWithdrawRequests(userId: string) {
  assertSupabase();
  const { data, error } = await supabase
    .from("wallet_withdraw_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(normalizeWalletRequest);
}

export async function staffApproveWalletDeposit(params: {
  staffId: string;
  depositRequestId: string;
  bonusAmount?: number;
  note?: string | null;
}) {
  assertSupabase();
  const { data: requestRow, error: requestError } = await supabase
    .from("wallet_deposit_requests")
    .select("*")
    .eq("id", params.depositRequestId)
    .single();
  if (requestError) throw requestError;
  if (upper(requestRow.status) === "APPROVED") return normalizeWalletRequest(requestRow);

  const amount = money(requestRow.amount_cents);

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("wallet_balance,wallet_bonus_balance,referred_by_bookmaker_code")
      .eq("hidden_from_front", false)
    .eq("id", requestRow.user_id)
    .single();
  if (userError) throw userError;

  const { count: priorApprovedCount, error: countError } = await supabase
    .from("wallet_deposit_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", requestRow.user_id)
    .eq("status", "APPROVED")
    .neq("id", requestRow.id);
  if (countError) throw countError;

  const referredByBookmakerCode = String(user.referred_by_bookmaker_code || "").trim().toUpperCase();
  const isAffiliateUser = referredByBookmakerCode.length > 0;
  const isFirstApprovedDeposit = Number(priorApprovedCount || 0) === 0;
  const computedAffiliateBonus = isAffiliateUser && isFirstApprovedDeposit
    ? Math.floor(amount * 0.2)
    : 0;
  const bonus = money(
    params.bonusAmount != null ? params.bonusAmount : computedAffiliateBonus
  );

  const { error: updateUserError } = await supabase
    .from("users")
    .update({
      wallet_balance: Number(user.wallet_balance || 0) + amount,
      wallet_bonus_balance: Number(user.wallet_bonus_balance || 0) + bonus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestRow.user_id);
  if (updateUserError) throw updateUserError;

  const reviewNoteParts = [params.note || "Recharge validée sur place"];
  if (bonus > 0) reviewNoteParts.push(`BONUS_FIRST_DEPOSIT:${bonus}`);
  if (isAffiliateUser) reviewNoteParts.push(`REFERRED_BY_BOOKMAKER:${referredByBookmakerCode}`);
  const reviewNote = reviewNoteParts.join(" | ");

  const { data, error } = await supabase
    .from("wallet_deposit_requests")
    .update({
      status: "APPROVED",
      reviewed_by_staff_id: params.staffId,
      reviewed_at: new Date().toISOString(),
      note: reviewNote,
    })
    .eq("id", params.depositRequestId)
    .select("*")
    .single();
  if (error) throw error;

  await addWalletTransaction({
    userId: requestRow.user_id,
    direction: "IN",
    category: "WALLET",
    subcategory: "deposit_approved",
    amountTotal: amount,
    status: "APPROVED",
    sourceTable: "wallet_deposit_requests",
    sourceId: requestRow.id,
    note: reviewNote,
    createdByStaffId: params.staffId,
  });

  if (bonus > 0) {
    await addWalletTransaction({
      userId: requestRow.user_id,
      direction: "IN",
      category: "WALLET",
      subcategory: "first_deposit_bonus",
      amountTotal: bonus,
      status: "APPROVED",
      sourceTable: "wallet_deposit_requests",
      sourceId: requestRow.id,
      note: `Bonus affilié premier dépôt (${referredByBookmakerCode || "BOOKMAKER"})`,
      createdByStaffId: params.staffId,
    });
  }

  return normalizeWalletRequest(data);
}

export async function staffRejectWalletDeposit(params: {
  staffId: string;
  depositRequestId: string;
  note?: string | null;
}) {
  assertSupabase();
  const { data, error } = await supabase
    .from("wallet_deposit_requests")
    .update({
      status: "REJECTED",
      reviewed_by_staff_id: params.staffId,
      reviewed_at: new Date().toISOString(),
      note: params.note || "Recharge refusée",
    })
    .eq("id", params.depositRequestId)
    .select("*")
    .single();
  if (error) throw error;
  return normalizeWalletRequest(data);
}

export async function staffMarkWithdrawProcessing(params: {
  staffId: string;
  withdrawRequestId: string;
  note?: string | null;
}) {
  assertSupabase();
  const { data, error } = await supabase
    .from("wallet_withdraw_requests")
    .update({
      status: "PROCESSING",
      processed_by_staff_id: params.staffId,
      processed_at: new Date().toISOString(),
      note: params.note || "Retrait en cours de traitement",
    })
    .eq("id", params.withdrawRequestId)
    .select("*")
    .single();
  if (error) throw error;
  return normalizeWalletRequest(data);
}

export async function staffMarkWithdrawPaid(params: {
  staffId: string;
  withdrawRequestId: string;
  fee?: number;
  reference?: string | null;
  note?: string | null;
}) {
  assertSupabase();
  const { data: requestRow, error: requestError } = await supabase
    .from("wallet_withdraw_requests")
    .select("*")
    .eq("id", params.withdrawRequestId)
    .single();
  if (requestError) throw requestError;

  const fee = money(params.fee || 0);
  const amount = Math.max(0, money(requestRow.amount_cents) + fee);

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("wallet_balance")
      .eq("hidden_from_front", false)
    .eq("id", requestRow.user_id)
    .single();
  if (userError) throw userError;
  if (Number(user.wallet_balance || 0) < amount) throw new Error("INSUFFICIENT_WALLET_BALANCE");

  const { error: updateUserError } = await supabase
    .from("users")
    .update({
      wallet_balance: Number(user.wallet_balance || 0) - amount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestRow.user_id);
  if (updateUserError) throw updateUserError;

  const note = [params.note || "Retrait payé sur place", params.reference ? `REF:${params.reference}` : null]
    .filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter(Boolean)
    .join(" | ");

  const { data, error } = await supabase
    .from("wallet_withdraw_requests")
    .update({
      status: "PAID",
      paid_by_staff_id: params.staffId,
      paid_at: new Date().toISOString(),
      note,
    })
    .eq("id", params.withdrawRequestId)
    .select("*")
    .single();
  if (error) throw error;

  await addWalletTransaction({
    userId: requestRow.user_id,
    direction: "OUT",
    category: "WALLET",
    subcategory: "withdraw_paid",
    amountTotal: amount,
    status: "PAID",
    sourceTable: "wallet_withdraw_requests",
    sourceId: requestRow.id,
    note,
    createdByStaffId: params.staffId,
  });

  return normalizeWalletRequest(data);
}

export async function staffRejectWithdraw(params: {
  staffId: string;
  withdrawRequestId: string;
  note?: string | null;
}) {
  assertSupabase();
  const { data, error } = await supabase
    .from("wallet_withdraw_requests")
    .update({
      status: "REJECTED",
      processed_by_staff_id: params.staffId,
      processed_at: new Date().toISOString(),
      note: params.note || "Retrait refusé",
    })
    .eq("id", params.withdrawRequestId)
    .select("*")
    .single();
  if (error) throw error;
  return normalizeWalletRequest(data);
}

/* =========================
   STAFF FINANCE DASHBOARD
========================= */

export async function fetchFinanceDashboardDeposits() {
  assertSupabase();
  const { data, error } = await supabase
    .from("wallet_deposit_requests")
    .select(`
      *,
      user:users(id,rp_name,phone,role)
    `)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(normalizeWalletRequest);
}

export async function fetchFinanceDashboardWithdraws() {
  assertSupabase();
  const { data, error } = await supabase
    .from("wallet_withdraw_requests")
    .select(`
      *,
      user:users(id,rp_name,phone,role)
    `)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(normalizeWalletRequest);
}

/* =========================
   FIGHTS / BETS
========================= */

export async function fetchOpenFights() {
  assertSupabase();
  const { data, error } = await supabase
    .from("fights")
    .select(`
      *,
      fighter_a_profile:users!fights_fighter_a_fkey(id,rp_name)
      .eq("hidden_from_front", false),
      fighter_b_profile:users!fights_fighter_b_fkey(id,rp_name)
    `)
    .in("status", ["SCHEDULED", "STARTED", "LIVE"])
    .order("scheduled_at", { ascending: true });
  if (error) throw error;

  const now = Date.now();
  const sixHoursAgo = now - 6 * 60 * 60 * 1000;
  return (data || [])
    .filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter((row: any) => {
      const ms = new Date(String(row?.scheduled_at || "")).getTime();
      if (!Number.isFinite(ms)) return false;
      return ms >= sixHoursAgo;
    })
    .map(mapFight);
}

export async function fetchRingFights() {
  return fetchOpenFights();
}

export async function fetchMyFights(userId: string) {
  assertSupabase();
  const { data, error } = await supabase
    .from("fights")
    .select(`
      *,
      fighter_a_profile:users!fights_fighter_a_fkey(id,rp_name,public_avatar_url)
      .eq("hidden_from_front", false),
      fighter_b_profile:users!fights_fighter_b_fkey(id,rp_name,public_avatar_url)
    `)
    .or(`fighter_a.eq.${userId},fighter_b.eq.${userId}`)
    .order("scheduled_at", { ascending: false });
  if (error) throw error;

  const rows = data || [];
  const fighterIds = Array.from(new Set(rows.flatMap((row: any) => [String(row?.fighter_a || ""), String(row?.fighter_b || "")]).filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter(Boolean)));
  let boardMap: Record<string, any> = {};
  if (fighterIds.length > 0) {
    const { data: boardRows, error: boardError } = await supabase
      .from("leaderboard")
      .select("user_id,mmr,wins,losses,ko_wins")
      .in("user_id", fighterIds);
    if (boardError) throw boardError;
    boardMap = Object.fromEntries((boardRows || []).map((row: any) => [String(row?.user_id || ""), row]));
  }

  return rows.map((row: any) => {
    const mapped = mapFight(row);
    const a = boardMap[String(row?.fighter_a || "")] || {};
    const b = boardMap[String(row?.fighter_b || "")] || {};
    return {
      ...mapped,
      fighter_a_mmr: Number(a?.mmr ?? mapped.fighter_a_mmr ?? 1000),
      fighter_b_mmr: Number(b?.mmr ?? mapped.fighter_b_mmr ?? 1000),
      fighter_a_wins: Number(a?.wins ?? mapped.fighter_a_wins ?? 0),
      fighter_a_losses: Number(a?.losses ?? mapped.fighter_a_losses ?? 0),
      fighter_a_ko_wins: Number(a?.ko_wins ?? row?.fighter_a_ko_wins ?? 0),
      fighter_b_wins: Number(b?.wins ?? mapped.fighter_b_wins ?? 0),
      fighter_b_losses: Number(b?.losses ?? mapped.fighter_b_losses ?? 0),
      fighter_b_ko_wins: Number(b?.ko_wins ?? row?.fighter_b_ko_wins ?? 0),
      fighter_a_avatar_url: row?.fighter_a_profile?.public_avatar_url || null,
      fighter_b_avatar_url: row?.fighter_b_profile?.public_avatar_url || null,
    };
  });
}

export async function fetchMyBets(userId: string) {

  if (!BETTING_ENABLED) {
    return {
      ok: false,
      error: "BETTING_DISABLED_PRELAUNCH",
      message:
        "Les paris ouvriront mardi avec la première card officielle.",
    };
  }

  assertSupabase();
  const { data, error } = await supabase
    .from("bets")
    .select(`
      *,
      fight:fights(*),
      bet_on_profile:users!bets_bet_on_fkey(id,rp_name)
    `)
    .eq("bettor_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data || []).map((bet: any) => {
    const fight = maybeOne(bet.fight);
    return {
      ...bet,
      fight_status: fight?.status || null,
      fight_scheduled_at: fight?.scheduled_at || null,
      fighter_a_name: null,
      fighter_b_name: null,
      bet_on_name: bet?.bet_on_profile?.rp_name || null,
    };
  });
}

export async function fetchUpcomingFights() {
  return fetchOpenFights();
}

function computeDisplayedFightOdds(fight: any, selectedFighterId: string) {
  const sideA = String(fight?.fighter_a || fight?.fighter_a_id || "");
  const sideB = String(fight?.fighter_b || fight?.fighter_b_id || "");
  const oddsA = Number(fight?.odds_current_a ?? fight?.fighter_a_odds ?? fight?.odds_a ?? 0);
  const oddsB = Number(fight?.odds_current_b ?? fight?.fighter_b_odds ?? fight?.odds_b ?? 0);
  if (String(selectedFighterId) === sideA) {
    if (!Number.isFinite(oddsA) || oddsA <= 1) throw new Error("FIGHT_ODDS_UNAVAILABLE");
    return Math.round(oddsA * 10000) / 10000;
  }
  if (String(selectedFighterId) === sideB) {
    if (!Number.isFinite(oddsB) || oddsB <= 1) throw new Error("FIGHT_ODDS_UNAVAILABLE");
    return Math.round(oddsB * 10000) / 10000;
  }
  throw new Error("BET_TARGET_INVALID");
}

function normalizeBetSlip(row: any) {
  const selections = Array.isArray(row?.selections) ? row.selections : [];
  return {
    ...row,
    bet_type: upper(row?.bet_type || "SINGLE"),
    status: upper(row?.status || "OPEN"),
    total_stake: money(row?.total_stake),
    potential_payout: money(row?.potential_payout),
    total_odds: Number(row?.total_odds || 1),
    selections: selections.map((selection: any) => ({
      ...selection,
      odds: Number(selection?.odds || 1),
      result: upper(selection?.result || "PENDING"),
      selected_fighter_name: selection?.selected_fighter?.rp_name || null,
      fight_label: selection?.fight
        ? `${String(selection?.fight?.fighter_a_profile?.rp_name || "FIGHTER A").toUpperCase()} VS ${String(selection?.fight?.fighter_b_profile?.rp_name || "FIGHTER B").toUpperCase()}`
        : null,
      fight_scheduled_at: selection?.fight?.scheduled_at || null,
      fighter_a_name: selection?.fight?.fighter_a_profile?.rp_name || null,
      fighter_b_name: selection?.fight?.fighter_b_profile?.rp_name || null,
    })),
  };
}

async function createBookmakerCommissionFromBet(params: {
  sourceUserId: string;
  sourceType: "BET_SLIP" | "BET_SLIP_CASHOUT";
  sourceRefId: string;
  amountBaseCents: number;
}) {
  const amountBaseCents = money(params.amountBaseCents);
  if (amountBaseCents <= 0) return null;

  const { data: sourceUser, error: sourceUserError } = await supabase
    .from("users")
    .select("id,referred_by_bookmaker_code")
      .eq("hidden_from_front", false)
    .eq("id", params.sourceUserId)
    .maybeSingle();
  if (sourceUserError) throw sourceUserError;

  const referralCode = String(sourceUser?.referred_by_bookmaker_code || "").trim().toUpperCase();
  if (!referralCode) return null;

  const { data: bookmakerProfile, error: bookmakerProfileError } = await supabase
    .from("bookmaker_profiles")
    .select("user_id,status,commission_bettors_bps")
    .eq("referral_code", referralCode)
    .maybeSingle();
  if (bookmakerProfileError) throw bookmakerProfileError;
  if (!bookmakerProfile?.user_id) return null;
  if (upper(bookmakerProfile?.status || "PENDING") !== "APPROVED") return null;

  const commissionBps = Math.max(0, Number(bookmakerProfile?.commission_bettors_bps || 0));
  if (commissionBps <= 0) return null;

  const amountCents = Math.floor((amountBaseCents * commissionBps) / 10000);
  if (amountCents <= 0) return null;

  const { data, error } = await supabase
    .from("bookmaker_commissions")
    .insert({
      bookmaker_user_id: bookmakerProfile.user_id,
      source_user_id: params.sourceUserId,
      source_type: params.sourceType,
      source_ref_id: params.sourceRefId,
      amount_cents: amountCents,
      status: "PENDING",
    })
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

function getBetSlipCashoutQuote(row: any) {
  const slip = normalizeBetSlip(row);
  const selections = Array.isArray(slip?.selections) ? slip.selections : [];
  const slipStatus = upper(slip?.status || "OPEN");
  if (slipStatus !== "OPEN") return { eligible: false, amount: 0, ratio: 0, reason: "SLIP_NOT_OPEN" };
  if (selections.length === 0) return { eligible: false, amount: 0, ratio: 0, reason: "SLIP_EMPTY" };

  const wonCount = selections.filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter((selection: any) => upper(selection?.result || "PENDING") === "WON").length;
  const pendingCount = selections.filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter((selection: any) => upper(selection?.result || "PENDING") === "PENDING").length;
  const lostCount = selections.filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter((selection: any) => upper(selection?.result || "PENDING") === "LOST").length;
  const cancelledCount = selections.filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter((selection: any) => upper(selection?.result || "PENDING") === "CANCELLED").length;

  if (lostCount > 0 || cancelledCount > 0) return { eligible: false, amount: 0, ratio: 0, reason: "SLIP_ALREADY_BROKEN" };
  if (wonCount === 0 || pendingCount === 0) return { eligible: false, amount: 0, ratio: 0, reason: "SLIP_NOT_IN_MIDDLE" };

  const progress = wonCount / selections.length;
  const ratioValue = Math.max(0.45, Math.min(0.88, 0.45 + progress * 0.35));
  const potential = money(slip?.potential_payout);
  const floorValue = Math.round(money(slip?.total_stake) * 0.9);
  const amount = Math.max(floorValue, Math.round(potential * ratioValue));

  return {
    eligible: amount > 0,
    amount,
    ratio: Number(ratioValue.toFixed(2)),
    wonCount,
    pendingCount,
    reason: amount > 0 ? null : "ZERO_QUOTE",
  };
}

export async function fetchMyBetSlips(userId: string) {
  assertSupabase();
  const { data, error } = await supabase
    .from("bet_slips")
    .select(`
      *,
      selections:bet_selections(
        *,
        selected_fighter:users!bet_selections_selected_fighter_id_fkey(id,rp_name),
        fight:fights(
          id,
          status,
          scheduled_at,
          fighter_a,
          fighter_b,
          fighter_a_profile:users!fights_fighter_a_fkey(id,rp_name),
          fighter_b_profile:users!fights_fighter_b_fkey(id,rp_name)
        )
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    if (String(error?.message || "").toLowerCase().includes("bet_slips")) return [];
    throw error;
  }
  return (data || []).map((row: any) => {
    const normalized = normalizeBetSlip(row);
    return {
      ...normalized,
      cashout_quote: getBetSlipCashoutQuote(normalized),
    };
  });
}

export async function createBetSlip(params: {
  userId: string;
  betType: "SINGLE" | "MULTIPLE" | "COMBO" | string;
  stakeAmount: number;
  selections: Array<{ fightId: string; selectedFighterId: string }>;
}) {
  assertSupabase();
  const userId = String(params.userId || "").trim();
  const betType = upper(params.betType || "SINGLE");
  const stakeAmount = money(params.stakeAmount);
  const rawSelections = Array.isArray(params.selections) ? params.selections : [];
  const selections = rawSelections
    .map((row) => ({
      fightId: String(row?.fightId || "").trim(),
      selectedFighterId: String(row?.selectedFighterId || "").trim(),
    }))
    .filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter((row) => row.fightId && row.selectedFighterId);

  if (!userId) throw new Error("USER_REQUIRED");
  if (!["SINGLE", "MULTIPLE", "COMBO"].includes(betType)) throw new Error("BET_TYPE_INVALID");
  if (stakeAmount <= 0) throw new Error("BET_STAKE_INVALID");
  if (betType === "SINGLE" && selections.length !== 1) throw new Error("SINGLE_REQUIRES_ONE_SELECTION");
  if (["MULTIPLE", "COMBO"].includes(betType) && selections.length < 2) throw new Error("MULTI_REQUIRES_MIN_TWO_SELECTIONS");

  const deduped: Array<{ fightId: string; selectedFighterId: string }> = [];
  const seenFightIds = new Set<string>();
  for (const row of selections) {
    if (seenFightIds.has(row.fightId)) throw new Error("DUPLICATE_FIGHT_IN_SLIP");
    seenFightIds.add(row.fightId);
    deduped.push(row);
  }

  const user = await loadUserWallet(userId);
  if (upper(user.role) !== "BETTOR") throw new Error("ROLE_NOT_ALLOWED");
  if (upper(user.verification_status) !== "VERIFIED") throw new Error("KYC_REQUIRED");

  const totalDebit = betType === "MULTIPLE" ? stakeAmount * deduped.length : stakeAmount;
  const available = money(user.wallet_balance) + money(user.wallet_bonus_balance);
  if (available < totalDebit) throw new Error("INSUFFICIENT_WALLET_BALANCE");

  const fightIds = deduped.map((row) => row.fightId);
  const { data: fights, error: fightsError } = await supabase
    .from("fights")
    .select(`
      *,
      slot:fight_slots(id,close_bets_at)
      .eq("hidden_from_front", false)
    `)
    .in("id", fightIds);
  if (fightsError) throw fightsError;
  const fightsById = new Map((fights || []).map((row: any) => [String(row?.id), row]));

  const selectionRows: any[] = [];
  let combinedOdds = 1;
  let potentialPayout = 0;
  const multipleUnitStake = betType === "MULTIPLE" ? stakeAmount : 0;

  for (const selection of deduped) {
    const fight = fightsById.get(selection.fightId);
    if (!fight?.id) throw new Error("FIGHT_NOT_FOUND");
    const fightStatus = upper(fight?.status || "SCHEDULED");
    if (!["SCHEDULED", "OPEN", "LIVE", "STARTED"].includes(fightStatus)) throw new Error("FIGHT_NOT_OPEN_FOR_BETTING");
    const closeBetsAt = fight?.slot?.close_bets_at || null;
    if (closeBetsAt && new Date(closeBetsAt).getTime() <= Date.now()) throw new Error("BETTING_CLOSED_FOR_FIGHT");

    const sideA = String(fight?.fighter_a || "");
    const sideB = String(fight?.fighter_b || "");
    if (![sideA, sideB].includes(selection.selectedFighterId)) throw new Error("BET_TARGET_INVALID");

    const odds = computeDisplayedFightOdds(fight, selection.selectedFighterId);
    combinedOdds *= odds;
    if (betType === "MULTIPLE") potentialPayout += Math.round(multipleUnitStake * odds);

    selectionRows.push({
      fight_id: selection.fightId,
      selected_fighter_id: selection.selectedFighterId,
      odds,
      result: "PENDING",
    });
  }

  if (betType !== "MULTIPLE") {
    potentialPayout = Math.round(stakeAmount * combinedOdds);
  }

  const { data: slip, error: slipError } = await supabase
    .from("bet_slips")
    .insert({
      user_id: userId,
      bet_type: betType,
      total_stake: totalDebit,
      total_odds: Number(betType === "MULTIPLE" ? 0 : combinedOdds.toFixed(4)),
      potential_payout: potentialPayout,
      status: "OPEN",
      note: betType === "MULTIPLE" ? `MULTIPLE | unit_stake=${stakeAmount}` : null,
    })
    .select("*")
    .single();
  if (slipError) throw slipError;

  const { error: selectionsError } = await supabase
    .from("bet_selections")
    .insert(selectionRows.map((row: any) => ({ ...row, bet_slip_id: slip.id })));
  if (selectionsError) throw selectionsError;

  await spendWalletBalances({
    userId,
    amount: totalDebit,
    category: "BET",
    subcategoryCash: betType === "COMBO" ? "bet_combo_cash" : betType === "MULTIPLE" ? "bet_multiple_cash" : "bet_single_cash",
    subcategoryBonus: betType === "COMBO" ? "bet_combo_bonus" : betType === "MULTIPLE" ? "bet_multiple_bonus" : "bet_single_bonus",
    status: "OPEN",
    sourceTable: "bet_slips",
    sourceId: slip.id,
    note: `Ticket ${betType} placé`,
  });

  await createBookmakerCommissionFromBet({
    sourceUserId: userId,
    sourceType: "BET_SLIP",
    sourceRefId: slip.id,
    amountBaseCents: totalDebit,
  });

  const rows = await fetchMyBetSlips(userId);
  return rows.find((row: any) => String(row?.id) === String(slip.id)) || { ...slip, selections: selectionRows };
}

async function settleOpenBetSlipsForFight(fightId: string, winnerId: string | null, mode: "SETTLE" | "REFUND") {
  const { data: selectionRows, error: selectionError } = await supabase
    .from("bet_selections")
    .select(`
      id,
      bet_slip_id,
      selected_fighter_id,
      odds,
      result,
      fight_id,
      slip:bet_slips(*)
    `)
    .eq("fight_id", fightId);
  if (selectionError) {
    if (String(selectionError?.message || "").toLowerCase().includes("bet_selections")) return;
    throw selectionError;
  }

  const rows = Array.isArray(selectionRows) ? selectionRows : [];
  if (rows.length === 0) return;

  for (const row of rows) {
    const slip = maybeOne((row as any)?.slip);
    if (!slip?.id || upper(slip?.status) !== "OPEN") continue;
    if (upper((row as any)?.result || "PENDING") !== "PENDING") continue;

    const nextResult = mode === "REFUND"
      ? "CANCELLED"
      : String((row as any)?.selected_fighter_id) === String(winnerId)
        ? "WON"
        : "LOST";

    const { error: updateSelectionError } = await supabase
      .from("bet_selections")
      .update({ result: nextResult })
      .eq("id", row.id)
      .eq("result", "PENDING");
    if (updateSelectionError) throw updateSelectionError;
  }

  const impactedSlipIds = [...new Set(rows.map((row: any) => String(row?.bet_slip_id || "")).filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter(Boolean))];
  for (const slipId of impactedSlipIds) {
    const { data: slip, error: slipError } = await supabase
      .from("bet_slips")
      .select(`*, selections:bet_selections(*)`)
      .eq("id", slipId)
      .single();
    if (slipError) throw slipError;
    if (upper(slip?.status) !== "OPEN") continue;

    const selections = Array.isArray(slip?.selections) ? slip.selections : [];
    const pendingCount = selections.filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter((selection: any) => upper(selection?.result || "PENDING") === "PENDING").length;
    const lostCount = selections.filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter((selection: any) => upper(selection?.result || "PENDING") === "LOST").length;
    const cancelledCount = selections.filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter((selection: any) => upper(selection?.result || "PENDING") === "CANCELLED").length;
    const wonSelections = selections.filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter((selection: any) => upper(selection?.result || "PENDING") === "WON");
    const slipType = upper(slip?.bet_type || "SINGLE");

    if (mode === "REFUND") {
      const refund = money(slip?.total_stake);
      const { error: closeSlipError } = await supabase
        .from("bet_slips")
        .update({
          status: "CANCELLED",
          potential_payout: refund,
          settled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", slipId)
        .eq("status", "OPEN");
      if (closeSlipError) throw closeSlipError;

      const { data: user } = await supabase.from("users").select("wallet_balance")
      .eq("hidden_from_front", false).eq("id", slip.user_id).single();
      await supabase.from("users").update({ wallet_balance: money(user?.wallet_balance) + refund, updated_at: new Date().toISOString() }).eq("id", slip.user_id);
      await addWalletTransaction({
        userId: slip.user_id,
        direction: "IN",
        category: "BET",
        subcategory: "bet_slip_refund",
        amountTotal: refund,
        status: "REFUNDED",
        sourceTable: "bet_slips",
        sourceId: slipId,
        note: "Remboursement ticket pari",
      });
      continue;
    }

    if (slipType === "MULTIPLE") {
      if (pendingCount > 0) continue;
      const unitStake = Math.floor(money(slip?.total_stake) / Math.max(1, selections.length));
      const payout = wonSelections.reduce((sum: number, selection: any) => sum + Math.round(unitStake * Number(selection?.odds || 1)), 0);
      const finalStatus = payout > 0 ? "WON" : "LOST";
      const { error: updateSlipError } = await supabase
        .from("bet_slips")
        .update({
          status: finalStatus,
          potential_payout: payout,
          total_odds: 0,
          settled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", slipId)
        .eq("status", "OPEN");
      if (updateSlipError) throw updateSlipError;
      if (payout > 0) {
        const { data: user } = await supabase.from("users").select("wallet_balance")
      .eq("hidden_from_front", false).eq("id", slip.user_id).single();
        await supabase.from("users").update({ wallet_balance: money(user?.wallet_balance) + payout, updated_at: new Date().toISOString() }).eq("id", slip.user_id);
        await addWalletTransaction({
          userId: slip.user_id,
          direction: "IN",
          category: "BET",
          subcategory: "bet_multiple_win",
          amountTotal: payout,
          status: "WON",
          sourceTable: "bet_slips",
          sourceId: slipId,
          note: "Gain ticket multiple",
        });
      }
      continue;
    }

    if (lostCount > 0) {
      const { error: updateSlipError } = await supabase
        .from("bet_slips")
        .update({
          status: "LOST",
          potential_payout: 0,
          settled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", slipId)
        .eq("status", "OPEN");
      if (updateSlipError) throw updateSlipError;
      continue;
    }

    if (pendingCount === 0 && cancelledCount === 0 && wonSelections.length === selections.length) {
      const payout = money(slip?.potential_payout);
      const { error: updateSlipError } = await supabase
        .from("bet_slips")
        .update({
          status: "WON",
          settled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", slipId)
        .eq("status", "OPEN");
      if (updateSlipError) throw updateSlipError;
      if (payout > 0) {
        const { data: user } = await supabase.from("users").select("wallet_balance")
      .eq("hidden_from_front", false).eq("id", slip.user_id).single();
        await supabase.from("users").update({ wallet_balance: money(user?.wallet_balance) + payout, updated_at: new Date().toISOString() }).eq("id", slip.user_id);
        await addWalletTransaction({
          userId: slip.user_id,
          direction: "IN",
          category: "BET",
          subcategory: slipType === "COMBO" ? "bet_combo_win" : "bet_single_win",
          amountTotal: payout,
          status: "WON",
          sourceTable: "bet_slips",
          sourceId: slipId,
          note: slipType === "COMBO" ? "Gain ticket combiné" : "Gain ticket simple",
        });
      }
    }
  }
}

export async function cashoutBetSlip(params: {
  userId: string;
  betSlipId: string;
}) {
  assertSupabase();
  const { data: slip, error } = await supabase
    .from("bet_slips")
    .select(`
      *,
      selections:bet_selections(
        *,
        selected_fighter:users!bet_selections_selected_fighter_id_fkey(id,rp_name),
        fight:fights(
          id,
          status,
          scheduled_at,
          fighter_a,
          fighter_b,
          fighter_a_profile:users!fights_fighter_a_fkey(id,rp_name),
          fighter_b_profile:users!fights_fighter_b_fkey(id,rp_name)
        )
      )
    `)
    .eq("id", params.betSlipId)
    .eq("user_id", params.userId)
    .single();
  if (error) throw error;

  const normalized = normalizeBetSlip(slip);
  const quote = getBetSlipCashoutQuote(normalized);
  if (!quote.eligible) throw new Error("CASHOUT_NOT_AVAILABLE");

  const { error: updateError } = await supabase
    .from("bet_slips")
    .update({
      status: "PAID",
      paid_at: new Date().toISOString(),
      settled_at: new Date().toISOString(),
      potential_payout: quote.amount,
      note: `${String(normalized?.note || "").trim()} | CASHOUT:${quote.amount}`.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.betSlipId)
    .eq("user_id", params.userId)
    .eq("status", "OPEN");
  if (updateError) throw updateError;

  const { data: user } = await supabase.from("users").select("wallet_balance")
      .eq("hidden_from_front", false).eq("id", params.userId).single();
  await supabase
    .from("users")
    .update({
      wallet_balance: money(user?.wallet_balance) + quote.amount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.userId);

  await addWalletTransaction({
    userId: params.userId,
    direction: "IN",
    category: "BET",
    subcategory: "bet_slip_cashout",
    amountTotal: quote.amount,
    status: "PAID",
    sourceTable: "bet_slips",
    sourceId: params.betSlipId,
    note: `Cashout ticket pari (${Math.round(quote.ratio * 100)}%)`,
  });

  await createBookmakerCommissionFromBet({
    sourceUserId: params.userId,
    sourceType: "BET_SLIP_CASHOUT",
    sourceRefId: params.betSlipId,
    amountBaseCents: quote.amount,
  });

  const rows = await fetchMyBetSlips(params.userId);
  return rows.find((row: any) => String(row?.id) === String(params.betSlipId)) || null;
}

export async function walletSpendForBet(params: {

  fightId: string;
  bettorId: string;
  betOn: string;
  amount: number;
}) {
  assertSupabase();
  const amount = money((params as any).amountCents ?? params.amount);

  const user = await loadUserWallet(params.bettorId);
  if (upper(user.role) !== "BETTOR") throw new Error("ROLE_NOT_ALLOWED");
  if (upper(user.verification_status) !== "VERIFIED") throw new Error("KYC_REQUIRED");
  if (Number(user.wallet_balance || 0) + Number(user.wallet_bonus_balance || 0) < amount) {
    throw new Error("INSUFFICIENT_WALLET_BALANCE");
  }

  const { data: fight, error: fightError } = await supabase
    .from("fights")
    .select("id,status,fighter_a,fighter_b,odds_current_a,odds_current_b,bet_pool_a,bet_pool_b")
      .eq("hidden_from_front", false)
    .eq("id", params.fightId)
    .single();
  if (fightError) throw fightError;

  const fightStatus = upper(fight?.status || "SCHEDULED");
  if (fightStatus !== "SCHEDULED") {
    throw new Error("BETS_CLOSED_FOR_FIGHT");
  }

  const betOn = String(params.betOn || "");
  const sideA = String(fight?.fighter_a || "");
  const sideB = String(fight?.fighter_b || "");
  if (betOn !== sideA && betOn !== sideB) throw new Error("BET_TARGET_INVALID");

  const odds = betOn === sideA
    ? Number(fight?.odds_current_a || 0)
    : Number(fight?.odds_current_b || 0);
  if (!Number.isFinite(odds) || odds <= 1) throw new Error("FIGHT_ODDS_UNAVAILABLE");

  const payoutAmount = Math.max(0, Math.floor(amount * odds));

  const { data: bet, error: betError } = await supabase
    .from("bets")
    .insert({
      fight_id: params.fightId,
      bettor_id: params.bettorId,
      bet_on: params.betOn,
      amount_cents: amount,
      odds,
      status: "OPEN",
      payout_amount: payoutAmount,
    })
    .select("*")
    .single();
  if (betError) throw betError;

  await spendWalletBalances({
    userId: params.bettorId,
    amount,
    category: "BET",
    subcategoryCash: "bet_stake_cash",
    subcategoryBonus: "bet_stake_bonus",
    status: "OPEN",
    sourceTable: "bets",
    sourceId: bet.id,
    note: "Mise placée sur combat",
  });

  const { data: refreshedFight } = await supabase
    .from("fights")
    .select("id,bet_pool_a,bet_pool_b,odds_current_a,odds_current_b")
      .eq("hidden_from_front", false)
    .eq("id", params.fightId)
    .single();

  return {
    ...bet,
    amount_cents: money((bet as any)?.amount_cents ?? amount),
    odds,
    payout_amount: payoutAmount,
    implied_pool_a_cents: money(refreshedFight?.bet_pool_a ?? fight?.bet_pool_a ?? 0),
    implied_pool_b_cents: money(refreshedFight?.bet_pool_b ?? fight?.bet_pool_b ?? 0),
    odds_current_a: Number(refreshedFight?.odds_current_a ?? fight?.odds_current_a ?? 0) || null,
    odds_current_b: Number(refreshedFight?.odds_current_b ?? fight?.odds_current_b ?? 0) || null,
  };
}

/* =========================
   RING STAFF
========================= */

export async function ringStartFight(params: { token?: string; fightId: string }) {
  assertSupabase();
  const { data: rpcData, error: rpcError } = await supabase.rpc("ring_start_fight_v2", {
    p_fight_id: params.fightId,
  });
  if (rpcError) throw rpcError;

  const { data, error } = await supabase
    .from("fights")
    .select("*")
      .eq("hidden_from_front", false)
    .eq("id", params.fightId)
    .single();
  if (error) throw error;

  return {
    ...mapFight(data),
    start: rpcData ?? null,
  };
}

export async function ringSettleFight(params: {
  token?: string;
  fightId: string;
  winnerId?: string;
  method?: "KO" | "DECISION" | "FORFEIT" | "DOUBLE_ABSENT";
  round1Winner?: string | null;
  round1Method?: "KO" | "DECISION" | null;
  round2Winner?: string | null;
  round2Method?: "KO" | "DECISION" | null;
  round3Winner?: string | null;
  round3Method?: "KO" | "DECISION" | null;
  koRound?: number | null;
  note?: string | null;
}) {
  assertSupabase();

  const { data: existingFight, error: existingError } = await supabase
    .from("fights")
    .select("*")
      .eq("hidden_from_front", false)
    .eq("id", params.fightId)
    .single();
  if (existingError) throw existingError;

  const currentStatus = upper(existingFight?.status || "SCHEDULED");
  if (currentStatus === "FINISHED" || currentStatus === "CANCELLED") {
    throw new Error("FIGHT_ALREADY_SETTLED");
  }

  const fighterA = String(existingFight?.fighter_a || "");
  const fighterB = String(existingFight?.fighter_b || "");

  // Legacy compatibility for forfait / double absence now routed to SQL v2 RPCs.
  if (upper(params.method) === "FORFEIT") {
    if (!params.winnerId) throw new Error("WINNER_REQUIRED_FOR_FORFEIT");
    const absentFighterId = params.winnerId === fighterA ? fighterB : fighterA;
    const { error: rpcError } = await supabase.rpc("ring_forfeit_absent_fighter_v2", {
      p_fight_id: params.fightId,
      p_absent_fighter_id: absentFighterId,
    });
    if (rpcError) throw rpcError;

    const { data: refreshedFight, error: refreshedFightError } = await supabase
      .from("fights")
      .select("*")
      .eq("hidden_from_front", false)
      .eq("id", params.fightId)
      .single();
    if (refreshedFightError) throw refreshedFightError;
    return mapFight(refreshedFight);
  }

  if (upper(params.method) === "DOUBLE_ABSENT") {
    const { error: rpcError } = await supabase.rpc("ring_forfeit_both_absent_v2", {
      p_fight_id: params.fightId,
    });
    if (rpcError) throw rpcError;

    const { data: refreshedFight, error: refreshedFightError } = await supabase
      .from("fights")
      .select("*")
      .eq("hidden_from_front", false)
      .eq("id", params.fightId)
      .single();
    if (refreshedFightError) throw refreshedFightError;
    return mapFight(refreshedFight);
  }

  // New round-by-round settlement path using SQL RPC ring_settle_fight_v2
  let round1Winner = params.round1Winner ?? null;
  let round1Method = params.round1Method ?? null;
  let round2Winner = params.round2Winner ?? null;
  let round2Method = params.round2Method ?? null;
  let round3Winner = params.round3Winner ?? null;
  let round3Method = params.round3Method ?? null;

  // Backward compatibility with old payload: winnerId/method/koRound
  if (!round1Winner && params.winnerId && params.method) {
    const method = upper(params.method);
    const winnerId = params.winnerId;
    const loserId = winnerId === fighterA ? fighterB : fighterA;

    if (method === "KO") {
      const koRound = Number(params.koRound || 1);
      if (koRound === 1) {
        round1Winner = winnerId;
        round1Method = "KO";
      } else if (koRound === 2) {
        round1Winner = loserId;
        round1Method = "DECISION";
        round2Winner = winnerId;
        round2Method = "KO";
      } else {
        round1Winner = winnerId;
        round1Method = "DECISION";
        round2Winner = loserId;
        round2Method = "DECISION";
        round3Winner = winnerId;
        round3Method = "KO";
      }
    } else {
      round1Winner = params.round1Winner ?? winnerId;
      round1Method = "DECISION";
      round2Winner = params.round2Winner ?? loserId;
      round2Method = "DECISION";
      round3Winner = params.round3Winner ?? winnerId;
      round3Method = "DECISION";
    }
  }

  if (!round1Winner || !round1Method) {
    throw new Error("ROUND1_REQUIRED");
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc("ring_settle_fight_v2", {
    p_fight_id: params.fightId,
    p_round1_winner_id: round1Winner,
    p_round1_method: round1Method,
    p_round2_winner_id: round2Winner ?? null,
    p_round2_method: round2Method ?? null,
    p_round3_winner_id: round3Winner ?? null,
    p_round3_method: round3Method ?? null,
  });
  if (rpcError) throw rpcError;

  const { data: refreshedFight, error: refreshedFightError } = await supabase
    .from("fights")
    .select("*")
      .eq("hidden_from_front", false)
    .eq("id", params.fightId)
    .single();
  if (refreshedFightError) throw refreshedFightError;

  return {
    ...mapFight(refreshedFight),
    settlement: rpcData ?? null,
  };
}

export async function ringForfeitAbsentFighter(params: {
  token?: string;
  fightId: string;
  absentUserId?: string;
  absentFighterId?: string;
  note?: string | null;
}) {
  assertSupabase();
  const absentId = params.absentFighterId || params.absentUserId;
  if (!absentId) throw new Error("ABSENT_FIGHTER_REQUIRED");

  const { data: rpcData, error: rpcError } = await supabase.rpc("ring_forfeit_absent_fighter_v2", {
    p_fight_id: params.fightId,
    p_absent_fighter_id: absentId,
  });
  if (rpcError) throw rpcError;

  const { data: fight, error: fightError } = await supabase
    .from("fights")
    .select("*")
      .eq("hidden_from_front", false)
    .eq("id", params.fightId)
    .single();
  if (fightError) throw fightError;

  return {
    ...mapFight(fight),
    settlement: rpcData ?? null,
  };
}

export async function ringForfeitBothAbsent(params: {
  token?: string;
  fightId: string;
  note?: string | null;
}) {
  assertSupabase();
  const { data: rpcData, error: rpcError } = await supabase.rpc("ring_forfeit_both_absent_v2", {
    p_fight_id: params.fightId,
  });
  if (rpcError) throw rpcError;

  const { data: fight, error: fightError } = await supabase
    .from("fights")
    .select("*")
      .eq("hidden_from_front", false)
    .eq("id", params.fightId)
    .single();
  if (fightError) throw fightError;

  return {
    ...mapFight(fight),
    settlement: rpcData ?? null,
  };
}

/* =========================
   FIGHT PLANNER
========================= */

function normalizeFightPlannerRequest(row: any) {
  return {
    ...row,
    status: upper(row?.status || "PENDING"),
    requested_stack_cents: money(row?.requested_stack_cents ?? row?.stake_amount ?? 0),
    slot: row?.slot || null,
  };
}

function getFightTypeFromSlot(slot: any) {
  const tier = upper(slot?.fight_tier || slot?.league || "STANDARD");
  if (!!slot?.is_title || tier === "TITLE") return "TITLE";
  if (tier === "MAIN_EVENT" || tier === "SUNDAY") return "MAIN_EVENT";
  return "STANDARD";
}

async function tryAutoMatchFightForSlot(slot: any) {
  const slotId = String(slot?.id || "");
  if (!slotId) return null;

  const { data: candidates, error: candidatesError } = await supabase
    .from("fight_match_requests")
    .select("*")
    .eq("preferred_slot_id", slotId)
    .in("status", ["PENDING", "APPROVED", "LOCKED"])
    .order("created_at", { ascending: true })
    .limit(2);
  if (candidatesError) throw candidatesError;

  const ready = (candidates || []).filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter((row: any) => !!row?.fighter_user_id);
  if (ready.length < 2) return null;

  const first = ready[0];
  const second = ready[1];
  if (String(first.fighter_user_id) === String(second.fighter_user_id)) return null;

  const stack = money(slot?.stake_amount ?? first?.requested_stack_cents ?? second?.requested_stack_cents ?? 0);
  const prizePool = stack * 2;
  const fightType = getFightTypeFromSlot(slot);

  const { data: fight, error: fightError } = await supabase
    .from("fights")
    .insert({
      fighter_a: first.fighter_user_id,
      fighter_b: second.fighter_user_id,
      scheduled_at: slot?.scheduled_at,
      fight_slot_id: slotId,
      league: String(slot?.fight_tier || first?.requested_league || "standard").toLowerCase(),
      fight_type: fightType,
      stack_cents: stack,
      prize_pool_cents: prizePool,
      status: "SCHEDULED",
    })
    .select("*")
    .single();
  if (fightError) throw fightError;

  const nowIso = new Date().toISOString();
  const { error: updateRequestsError } = await supabase
    .from("fight_match_requests")
    .update({
      status: "MATCHED",
      matched_fight_id: fight.id,
      note: `AUTO_MATCHED:${fight.id}`,
    })
    .in("id", [first.id, second.id]);
  if (updateRequestsError) throw updateRequestsError;

  await supabase
    .from("fight_slots")
    .update({ status: "FULL", updated_at: nowIso } as any)
    .eq("id", slotId);

  return fight;
}

function dateKeyLocal(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function weekdayLocal(dateKey: string) {
  const dt = new Date(`${dateKey}T12:00:00`);
  return dt.getDay();
}

function isEligibleFightDay(dateKey: string) {
  const day = weekdayLocal(dateKey);
  return [2, 3, 4, 5, 6].includes(day);
}

function buildAutomatic100kSlots(dateValue: string) {
  return Array.from({ length: 12 }).map((_, index) => {
    const scheduled = new Date(`${dateValue}T20:00:00`);
    scheduled.setMinutes(index * 20, 0, 0);
    const closeBetsAt = new Date(scheduled.getTime() - 10 * 60 * 1000);
    return {
      fight_date: dateValue,
      scheduled_at: scheduled.toISOString(),
      close_bets_at: closeBetsAt.toISOString(),
      is_title: false,
      status: "OPEN",
      fight_tier: "LEAGUE",
      stake_amount: 100000,
      max_fighters: 2,
    };
  });
}

async function rpcPrepareNextFightSlots(daysAhead = 7) {
  try {
    const { error } = await supabase.rpc("hhfc_prepare_next_fight_slots", { p_days_ahead: daysAhead });
    if (error) throw error;
    return true;
  } catch {
    return false;
  }
}

async function rpcGenerate100kSlotsForDate(dateValue: string) {
  try {
    const { error } = await supabase.rpc("hhfc_generate_100k_slots_for_date", { p_date: dateValue });
    if (error) throw error;
    return true;
  } catch {
    return false;
  }
}

async function ensureAutomaticFightSlots(dateKeys: string[]) {
  const uniqueDates = Array.from(new Set((dateKeys || []).map((x) => String(x || "").slice(0, 10)).filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter(Boolean)));
  if (!uniqueDates.length) return;

  const prepared = await rpcPrepareNextFightSlots(35);
  if (prepared) return;

  for (const dateValue of uniqueDates) {
    if (!isEligibleFightDay(dateValue)) continue;
    const  = await rpcGenerate100kSlotsForDate(dateValue);
    if (!) {
      await ownerGenerateSlotsForDate("auto", dateValue);
    }
  }
}

function isSlotStillOpenRealtime(row: any) {
  const status = upper(row?.status || "OPEN");
  if (status !== "OPEN") return false;
  const scheduledAt = String(row?.scheduled_at || "");
  if (!scheduledAt) return false;
  const scheduledMs = new Date(scheduledAt).getTime();
  if (!Number.isFinite(scheduledMs)) return false;
  const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;
  return scheduledMs >= twelveHoursAgo;
}

export async function fetchFightSlots(params?: { date?: string; onlyOpen?: boolean }) {
  assertSupabase();

  if (params?.date) {
    const safeDate = String(params.date || "").slice(0, 10);
    if (safeDate && safeDate >= OFFICIAL_LEAGUE_START_DATE) {
      await ensureAutomaticFightSlots([safeDate]);
    }
  } else {
    const seedStart = new Date(`${OFFICIAL_LEAGUE_START_DATE}T12:00:00`);
    const today = new Date();
    const anchor = today.getTime() > seedStart.getTime() ? today : seedStart;
    const nextDates: string[] = [];
    for (let i = 0; i < 35; i += 1) {
      const d = new Date(anchor);
      d.setDate(anchor.getDate() + i);
      const key = dateKeyLocal(d);
      if (key >= OFFICIAL_LEAGUE_START_DATE && isEligibleFightDay(key)) nextDates.push(key);
    }
    await ensureAutomaticFightSlots(nextDates);
  }

  let query = supabase.from("fight_slots").select("*").order("scheduled_at", { ascending: true }).gte("fight_date", OFFICIAL_LEAGUE_START_DATE);
  if (params?.date) query = query.eq("fight_date", params.date);
  if (params?.onlyOpen !== false) query = query.eq("status", "OPEN");
  const { data, error } = await query;
  if (error) throw error;

  const rows = (data || []).map((row: any) => ({
    ...row,
    slot_start: row?.scheduled_at || null,
    stake_cents: money(row?.stake_amount ?? row?.stake_cents ?? row?.stack_cents ?? 0),
    fight_tier: upper(row?.fight_tier || "LEAGUE"),
    status: upper(row?.status || "OPEN"),
  }));

  return params?.onlyOpen === false ? rows : rows.filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter((row: any) => upper(row?.status || "OPEN") === "OPEN");
}

export async function fetchUpcomingArenaEvents() {
  return fetchArenaTicketCatalog();
}

export async function fetchMyFightPlannerRequests(userId: string) {
  assertSupabase();
  const { data, error } = await supabase
    .from("fight_match_requests")
    .select(`
      *,
      slot:fight_slots!fight_match_requests_preferred_slot_id_fkey(*)
    `)
    .eq("fighter_user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(normalizeFightPlannerRequest);
}

export async function cancelFightBooking(requestId: string) {
  assertSupabase();

  const cleanId = String(requestId || "").trim();
  if (!cleanId) throw new Error("REQUEST_ID_REQUIRED");

  const { data: rpcData, error: rpcError } = await supabase.rpc("hhfc_cancel_match_request_v2", {
    p_request_id: cleanId,
  });
  if (rpcError) throw rpcError;

  const { data, error } = await supabase
    .from("fight_match_requests")
    .select(`
      *,
      slot:fight_slots!fight_match_requests_preferred_slot_id_fkey(*)
    `)
    .eq("id", cleanId)
    .single();
  if (error) throw error;

  return {
    ok: true,
    cancellation: rpcData ?? null,
    request: normalizeFightPlannerRequest(data),
  };
}

export async function fetchFightPlannerSlotLoads(slotIds: string[]) {
  assertSupabase();
  const uniqueIds = Array.from(new Set((slotIds || []).map((x) => String(x || "").trim()).filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter(Boolean)));
  if (uniqueIds.length === 0) return {} as Record<string, number>;

  const { data, error } = await supabase
    .from("fight_match_requests")
    .select("preferred_slot_id,status")
    .in("preferred_slot_id", uniqueIds)
    .in("status", ["PENDING", "APPROVED", "LOCKED", "MATCHED"]);
  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of data || []) {
    const key = String((row as any)?.preferred_slot_id || "");
    if (!key) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function getParisHourFromIso(value?: string | null) {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return -1;
  return (d.getUTCHours() + 2) % 24;
}

async function loadUserMmr(userId?: string | null) {
  const cleanId = String(userId || "").trim();
  if (!cleanId) return 1000;
  const { data, error } = await supabase
    .from("leaderboard")
    .select("mmr")
    .eq("user_id", cleanId)
    .maybeSingle();
  if (error) throw error;
  return Number(data?.mmr || 1000);
}

async function pickBestFightSlotInWindow(params: {
  anchorSlot?: any | null;
  fightDate?: string | null;
  fightHour?: number | null;
  stake: number;
  userId?: string | null;
}) {
  const targetDate = String(params.fightDate || params.anchorSlot?.fight_date || params.anchorSlot?.scheduled_at || "").slice(0, 10);
  const targetStake = money(params.stake);
  const targetHour = Number.isFinite(Number(params.fightHour))
    ? Number(params.fightHour)
    : getParisHourFromIso(params.anchorSlot?.scheduled_at || null);

  if (!targetDate) throw new Error("FIGHT_DATE_REQUIRED");
  if (targetStake <= 0) throw new Error("FIGHT_STAKE_REQUIRED");
  if (targetHour < 0) throw new Error("FIGHT_WINDOW_REQUIRED");

  const slots = await fetchFightSlots({ date: targetDate, onlyOpen: true });
  const windowSlots = (slots || [])
    .filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter((slot: any) => money(slot?.stake_amount ?? slot?.stake_cents ?? slot?.stack_cents ?? 0) === targetStake)
    .filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter((slot: any) => getParisHourFromIso(slot?.scheduled_at || null) === targetHour)
    .sort((a: any, b: any) => String(a?.scheduled_at || "").localeCompare(String(b?.scheduled_at || "")));

  if (windowSlots.length === 0) throw new Error("FIGHT_SLOT_NOT_OPEN");

  const slotIds = windowSlots.map((slot: any) => String(slot?.id || "")).filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter(Boolean);
  const [loadMap, currentUserMmr] = await Promise.all([
    fetchFightPlannerSlotLoads(slotIds),
    loadUserMmr(params.userId),
  ]);

  const { data: activeRows, error: activeError } = await supabase
    .from("fight_match_requests")
    .select("id,fighter_user_id,preferred_slot_id,status,created_at")
    .in("preferred_slot_id", slotIds)
    .in("status", ["PENDING", "APPROVED", "LOCKED"])
    .order("created_at", { ascending: true });
  if (activeError) throw activeError;

  const fighterIds = Array.from(new Set((activeRows || []).map((row: any) => String(row?.fighter_user_id || "")).filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter(Boolean)));
  let mmrMap: Record<string, number> = {};
  if (fighterIds.length > 0) {
    const { data: mmrRows, error: mmrError } = await supabase
      .from("leaderboard")
      .select("user_id,mmr")
      .in("user_id", fighterIds);
    if (mmrError) throw mmrError;
    mmrMap = Object.fromEntries((mmrRows || []).map((row: any) => [String(row?.user_id || ""), Number(row?.mmr || 1000)]));
  }

  const joinableCandidates = windowSlots
    .map((slot: any) => {
      const slotId = String(slot?.id || "");
      const currentLoad = Number(loadMap[slotId] || 0);
      const maxFighters = Math.max(1, Number(slot?.max_fighters || 2));
      const pendingRows = (activeRows || []).filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter((row: any) => String(row?.preferred_slot_id || "") === slotId);
      if (currentLoad >= maxFighters) return null;
      if (pendingRows.length !== 1) return null;
      const rivalId = String(pendingRows[0]?.fighter_user_id || "");
      if (!rivalId || rivalId === String(params.userId || "")) return null;
      const rivalMmr = Number(mmrMap[rivalId] || 1000);
      return {
        slot,
        gap: Math.abs(rivalMmr - currentUserMmr),
        created_at: String(pendingRows[0]?.created_at || ""),
      };
    })
    .filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter(Boolean)
    .sort((a: any, b: any) => {
      if (a.gap !== b.gap) return a.gap - b.gap;
      return String(a.created_at).localeCompare(String(b.created_at));
    });

  if (joinableCandidates.length > 0) {
    return joinableCandidates[0].slot;
  }

  const picked = windowSlots.find((slot: any) => {
    const currentLoad = Number(loadMap[String(slot.id)] || 0);
    const maxFighters = Math.max(1, Number(slot?.max_fighters || 2));
    return currentLoad < maxFighters;
  });

  if (!picked?.id) throw new Error("FIGHT_DAY_FULL");
  return picked;
}

async function pickFightSlotForPreference(params: { fightDate: string; stake: number; userId?: string | null; fightHour?: number | null }) {
  return pickBestFightSlotInWindow({
    fightDate: params.fightDate,
    fightHour: params.fightHour ?? null,
    stake: params.stake,
    userId: params.userId,
  });
}

export async function createFightBooking(params: {
  userId: string;
  slotId?: string | null;
  stake: number;
  fightDate?: string | null;
}) {
  assertSupabase();

  const amount = money(params.stake);
  const user = await loadUserWallet(params.userId);
  if (upper(user.role) !== "FIGHTER") throw new Error("ROLE_NOT_ALLOWED");
  if (upper(user.verification_status) !== "VERIFIED") throw new Error("KYC_REQUIRED");
  if (Number(user.wallet_balance || 0) + Number(user.wallet_bonus_balance || 0) < amount) {
    throw new Error("INSUFFICIENT_WALLET_BALANCE");
  }

  let slot: any = null;
  if (params.slotId) {
    const { data: slotRow, error: slotError } = await supabase
      .from("fight_slots")
      .select("*")
      .eq("id", params.slotId)
      .single();
    if (slotError) throw slotError;
    if (upper(slotRow?.status) !== "OPEN") throw new Error("FIGHT_SLOT_NOT_OPEN");
    slot = await pickBestFightSlotInWindow({
      anchorSlot: slotRow,
      stake: amount,
      userId: params.userId,
    });
  } else {
    slot = await pickFightSlotForPreference({
      fightDate: String(params.fightDate || ""),
      stake: amount,
      userId: params.userId,
    });
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc("hhfc_request_and_match_slot_v2", {
    p_user_id: params.userId,
    p_slot_id: String(slot.id),
    p_stake: amount,
  });
  if (rpcError) throw rpcError;

  const requestId = String((rpcData as any)?.request_id || "").trim();
  if (!requestId) {
    return {
      ...(rpcData || {}),
      slot,
    };
  }

  const { data, error } = await supabase
    .from("fight_match_requests")
    .select(`
      *,
      slot:fight_slots!fight_match_requests_preferred_slot_id_fkey(*)
    `)
    .eq("id", requestId)
    .single();
  if (error) throw error;

  return {
    ...normalizeFightPlannerRequest(data),
    rpc: rpcData,
  };
}

/* =========================
   ARENA / TICKETS
========================= */

export async function fetchArenaTicketCatalog() {
  assertSupabase();
  const { data, error } = await supabase
    .from("arena_nights")
    .select("*")
    .eq("is_closed", false)
    .gte("night_date", OFFICIAL_LEAGUE_START_DATE)
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return (data || [])
    .filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter((row: any) => shouldExposeArenaNight(row))
    .map(normalizeArenaNight);
}

export async function buyArenaTicket(params: {
  userId: string;
  eventId?: string;
  arenaNightId?: string;
  accessType?: "STANDARD" | "VIP";
  ticketType?: "STANDARD" | "VIP";
}) {
  assertSupabase();
  const ticketType = upper(params.accessType || params.ticketType) === "VIP" ? "VIP" : "STANDARD";
  const targetEventId = String(params.eventId || params.arenaNightId || "").trim();
  if (!targetEventId) throw new Error("ARENA_NIGHT_REQUIRED");

  const user = await loadUserWallet(params.userId);
  if (upper(user.verification_status) !== "VERIFIED") throw new Error("KYC_REQUIRED");

  const { data: ticket, error: ticketError } = await supabase.rpc("buy_arena_ticket", {
    p_user_id: params.userId,
    p_arena_night_id: targetEventId,
    p_ticket_type: ticketType,
  });
  if (ticketError) throw ticketError;
  return maybeOne(ticket) || ticket;
}

export async function fetchMyTickets(userId: string) {
  assertSupabase();
  const { data: rawNights } = await supabase
    .from("arena_nights")
    .select("*");
  const nightsById = new Map<string, any>(((rawNights || []) as any[]).map((row: any) => [String(row.id), normalizeArenaNight(row)]));

  const { data, error } = await supabase
    .from("arena_tickets")
    .select("*")
    .eq("buyer_user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row: any) => normalizeArenaTicket(row, nightsById));
}

/* =========================
   DOOR / TICKETS
========================= */

export async function fetchDoorTickets(limit = 100) {
  assertSupabase();
  const { data: rawNights } = await supabase
    .from("arena_nights")
    .select("*");
  const nightsById = new Map<string, any>(((rawNights || []) as any[]).map((row: any) => [String(row.id), normalizeArenaNight(row)]));

  const { data, error } = await supabase
    .from("arena_tickets")
    .select(`
      *,
      buyer:users!arena_tickets_buyer_user_id_fkey(id,rp_name,phone)
    `)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map((row: any) => ({ ...normalizeArenaTicket(row, nightsById), buyer: row.buyer }));
}

export async function staffValidateArenaTicket(params: {
  ticketId: string;
  staffId?: string | null;
}) {
  assertSupabase();
  const { data: ticket, error: readError } = await supabase
    .from("arena_tickets")
    .select("*")
    .eq("id", params.ticketId)
    .single();
  if (readError) throw readError;
  if (!ticket?.id) throw new Error("TICKET_NOT_FOUND");
  if (ticket?.checked_in_at) throw new Error("TICKET_ALREADY_USED");

  const { data, error } = await supabase
    .from("arena_tickets")
    .update({
      status: "USED",
      checked_in_at: new Date().toISOString(),
      checked_in_by_staff_id: params.staffId || null,
      note: "Entrée validée à la porte",
    })
    .eq("id", params.ticketId)
    .is("checked_in_at", null)
    .select("*")
    .single();
  if (error) throw error;
  return normalizeArenaTicket(data);
}

/* =========================
   NOTIFICATIONS
========================= */

function normalizeNotificationRow(row: any) {
  const payload = row?.payload && typeof row.payload === "object" ? row.payload : {};
  return {
    ...row,
    type: upper(row?.type || row?.event_type || row?.category || "GENERAL"),
    title: row?.title || row?.label || row?.type || "Notification",
    body: row?.body || row?.message || row?.content || row?.note || "",
    is_read: !!row?.is_read,
    payload,
    ticket_id: row?.ticket_id || payload?.ticket_id || null,
    fight_id: row?.fight_id || payload?.fight_id || null,
    created_at: row?.created_at || null,
  };
}

export async function fetchAllNotifications(userId: string, limit = 50) {
  assertSupabase();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(normalizeNotificationRow);
}

export async function fetchStaffFinanceNotifications(limit = 20) {
  assertSupabase();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .or("type.ilike.%FINANCE%,type.ilike.%WALLET%,title.ilike.%deposit%,title.ilike.%withdraw%,body.ilike.%deposit%,body.ilike.%withdraw%")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(normalizeNotificationRow);
}

export async function markNotificationRead(notificationId: string, userId: string) {
  assertSupabase();
  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return normalizeNotificationRow(data);
}

export async function markAllNotificationsRead(userId: string) {
  assertSupabase();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) throw error;
  return true;
}

/* =========================
   FINANCE
========================= */

export async function fetchFinanceDay(businessDate: string) {
  assertSupabase();
  const { data: report, error: reportError } = await supabase
    .from("daily_finance_reports")
    .select("*")
    .eq("business_date", businessDate)
    .maybeSingle();
  if (reportError) throw reportError;

  const { data: entries, error: entriesError } = await supabase
    .from("finance_journal_entries")
    .select("*")
    .order("created_at", { ascending: false });
  if (entriesError) throw entriesError;

  const rows = (entries || []).map(normalizeFinanceEntry).filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter((row: any) => row.business_date === businessDate);
  const totals = rows.reduce(
    (acc: any, row: any) => {
      const amount = currencyCents(row.amount_cents);
      const direction = upper(row.direction);
      const category = upper(row.category);
      const subcategory = upper(row.subcategory);
      const note = upper(row.note || "");

      if (direction === "IN") acc.total_in_cents += amount;
      if (direction === "OUT") acc.total_out_cents += amount;

      if (category === "TICKET") {
        if (direction === "IN") acc.tickets_total_cents += amount;
        if (subcategory.includes("REFUND") || note.includes("REFUND")) acc.ticket_refunds_total_cents += amount;
      }

      if (category === "BET") {
        if (direction === "IN") acc.bets_total_cents += amount;
        if (direction === "OUT" || subcategory.includes("PAYOUT") || note.includes("PAYOUT")) acc.bet_payouts_total_cents += amount;
      }

      if (category === "WALLET") {
        if (direction === "IN" && subcategory.includes("DEPOSIT")) acc.wallet_deposits_total_cents += amount;
        if (direction === "OUT" && subcategory.includes("WITHDRAW")) acc.wallet_withdraws_total_cents += amount;
        if (subcategory.includes("ADJUST") || note.includes("ADJUST")) acc.adjustments_total_cents += amount;
      }

      if (category === "FIGHT") {
        if (subcategory.includes("STAKE") || note.includes("STAKE")) acc.fight_stakes_total_cents += amount;
        if (direction === "OUT" || subcategory.includes("PAYOUT") || note.includes("PAYOUT")) acc.fight_payouts_total_cents += amount;
      }

      if (category === "AFFILIATE" || category === "BOOKMAKER") {
        acc.affiliate_commissions_total_cents += amount;
      }

      return acc;
    },
    {
      total_in_cents: 0,
      total_out_cents: 0,
      tickets_total_cents: 0,
      bets_total_cents: 0,
      wallet_deposits_total_cents: 0,
      wallet_withdraws_total_cents: 0,
      fight_stakes_total_cents: 0,
      bet_payouts_total_cents: 0,
      fight_payouts_total_cents: 0,
      affiliate_commissions_total_cents: 0,
      ticket_refunds_total_cents: 0,
      adjustments_total_cents: 0,
    }
  );

  const safeReport = {
    business_date: businessDate,
    total_in_cents: currencyCents(report?.total_in_cents ?? totals.total_in_cents),
    total_out_cents: currencyCents(report?.total_out_cents ?? totals.total_out_cents),
    tickets_total_cents: currencyCents(report?.tickets_total_cents ?? totals.tickets_total_cents),
    bets_total_cents: currencyCents(report?.bets_total_cents ?? totals.bets_total_cents),
    wallet_deposits_total_cents: currencyCents(report?.wallet_deposits_total_cents ?? totals.wallet_deposits_total_cents),
    wallet_withdraws_total_cents: currencyCents(report?.wallet_withdraws_total_cents ?? totals.wallet_withdraws_total_cents),
    fight_stakes_total_cents: currencyCents(report?.fight_stakes_total_cents ?? totals.fight_stakes_total_cents),
    bet_payouts_total_cents: currencyCents(report?.bet_payouts_total_cents ?? totals.bet_payouts_total_cents),
    fight_payouts_total_cents: currencyCents(report?.fight_payouts_total_cents ?? totals.fight_payouts_total_cents),
    affiliate_commissions_total_cents: currencyCents(report?.affiliate_commissions_total_cents ?? totals.affiliate_commissions_total_cents),
    ticket_refunds_total_cents: currencyCents(report?.ticket_refunds_total_cents ?? totals.ticket_refunds_total_cents),
    adjustments_total_cents: currencyCents(report?.adjustments_total_cents ?? totals.adjustments_total_cents),
    transaction_count: rows.length,
    net_cents: currencyCents((report?.total_in_cents ?? totals.total_in_cents) - (report?.total_out_cents ?? totals.total_out_cents)),
    status: upper(report?.status || "OPEN"),
    created_at: report?.created_at || new Date().toISOString(),
    closed_at: report?.closed_at || null,
    closed_by_staff_id: report?.closed_by_staff_id || null,
  };

  return { report: safeReport, entries: rows };
}

export async function fetchFinanceJournal(params?: {
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  direction?: "IN" | "OUT";
  status?: string;
  limit?: number;
}) {
  assertSupabase();
  const { data, error } = await supabase
    .from("finance_journal_entries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(params?.limit || 200);
  if (error) throw error;

  let rows = (data || []).map(normalizeFinanceEntry);
  if (params?.dateFrom) rows = rows.filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter((row: any) => String(row.business_date || "") >= params.dateFrom!);
  if (params?.dateTo) rows = rows.filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter((row: any) => String(row.business_date || "") <= params.dateTo!);
  if (params?.category) {
    const needle = upper(params.category);
    rows = rows.filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter((row: any) => upper(row.category) === needle || upper(row.subcategory) === needle);
  }
  if (params?.direction) rows = rows.filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter((row: any) => upper(row.direction) === upper(params.direction));
  if (params?.status) rows = rows.filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter((row: any) => upper(row.status) === upper(params.status));

  const userIds = Array.from(new Set(rows.map((row: any) => String(row?.user_id || "")).filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter(Boolean)));
  let usersById = new Map<string, any>();
  if (userIds.length > 0) {
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id,rp_name,phone")
      .eq("hidden_from_front", false)
      .in("id", userIds);
    if (usersError) throw usersError;
    usersById = new Map((users || []).map((row: any) => [String(row.id), row]));
  }

  return rows.map((row: any) => {
    const user = usersById.get(String(row?.user_id || ""));
    const direction = upper(row?.direction);
    const label = upper(row?.subcategory || row?.category || "ENTRY");
    return {
      ...row,
      client_name: String(user?.rp_name || "").trim() || null,
      client_phone: String(user?.phone || "").trim() || null,
      simple_label: label,
      simple_kind:
        direction === "IN"
          ? (label.includes("DEPOSIT") ? "DÉPÔT" : "ENTRÉE")
          : direction === "OUT"
          ? (label.includes("WITHDRAW") ? "RETRAIT" : "DÉPENSE")
          : "MOUVEMENT",
    };
  });
}

export async function financeGenerateDailyReport(params: {
  token: string;
  businessDate: string;
}) {
  assertSupabase();
  const { report } = await fetchFinanceDay(params.businessDate);

  const payload = {
    business_date: params.businessDate,
    total_in_cents: Number(report.total_in_cents || 0),
    total_out_cents: Number(report.total_out_cents || 0),
    tickets_total_cents: Number(report.tickets_total_cents || 0),
    bets_total_cents: Number(report.bets_total_cents || 0),
    wallet_deposits_total_cents: Number(report.wallet_deposits_total_cents || 0),
    wallet_withdraws_total_cents: Number(report.wallet_withdraws_total_cents || 0),
    fight_stakes_total_cents: Number(report.fight_stakes_total_cents || 0),
    bet_payouts_total_cents: Number(report.bet_payouts_total_cents || 0),
    fight_payouts_total_cents: Number(report.fight_payouts_total_cents || 0),
    affiliate_commissions_total_cents: Number(report.affiliate_commissions_total_cents || 0),
    ticket_refunds_total_cents: Number(report.ticket_refunds_total_cents || 0),
    adjustments_total_cents: Number(report.adjustments_total_cents || 0),
    transaction_count: Number(report.transaction_count || 0),
    net_cents: Number(report.net_cents || 0),
    status: upper(report.status || "OPEN"),
  };

  const { data, error } = await supabase
    .from("daily_finance_reports")
    .upsert(payload, { onConflict: "business_date" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function financeBuildExport(params: {
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  direction?: "IN" | "OUT";
  status?: string;
  limit?: number;
}) {
  const rows = await fetchFinanceJournal({
    dateFrom: params?.dateFrom,
    dateTo: params?.dateTo,
    category: params?.category,
    direction: params?.direction,
    status: params?.status,
    limit: params?.limit || 1000,
  });

  const header = [
    "business_date",
    "created_at",
    "direction",
    "category",
    "subcategory",
    "amount_cents",
    "status",
    "source_type",
    "source_table",
    "source_id",
    "user_id",
    "note",
  ];

  const escapeCsv = (value: any) => {
    const raw = String(value ?? "");
    if (!raw.includes(",") && !raw.includes('"') && !raw.includes("\n")) return raw;
    return `"${raw.replace(/"/g, '""')}"`;
  };

  const lines = rows.map((row: any) => [
    row?.business_date || "",
    row?.created_at || "",
    row?.direction || "",
    row?.category || "",
    row?.subcategory || "",
    money(row?.amount_cents),
    row?.status || "",
    row?.source_type || "",
    row?.source_table || "",
    row?.source_id || "",
    row?.user_id || row?.actor_user_id || "",
    row?.note || "",
  ].map(escapeCsv).join(","));

  return {
    row_count: rows.length,
    csv: [header.join(","), ...lines].join("\n"),
    rows,
  };
}

export async function financeCloseDay(params: {
  token?: string;
  staffId?: string;
  businessDate: string;
}) {
  assertSupabase();
  const actorStaffId = String(params.staffId || params.token || "").trim().split(":")[0];
  if (!actorStaffId) throw new Error("STAFF_SESSION_REQUIRED");

  await financeGenerateDailyReport({ token: actorStaffId, businessDate: params.businessDate });

  const { data, error } = await supabase
    .from("daily_finance_reports")
    .upsert({
      business_date: params.businessDate,
      status: "CLOSED",
      closed_by_staff_id: actorStaffId,
      closed_at: new Date().toISOString(),
    }, { onConflict: "business_date" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/* =========================
   SCHEDULE ADMIN
========================= */

const DEFAULT_RULES = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  is_open: true,
  is_24h: false,
  window_start: "18:00",
  window_end: "23:00",
  interval_minutes: 30,
}));

export async function fetchScheduleRules() {
  assertSupabase();
  const { data, error } = await supabase
    .from("schedule_rules")
    .select("*")
    .order("weekday", { ascending: true });

  if (error) {
    return DEFAULT_RULES;
  }

  return (data || []).length > 0 ? data : DEFAULT_RULES;
}

export async function ownerUpdateScheduleRule(
  token: string,
  weekday: number,
  isOpen: boolean,
  is24h: boolean,
  windowStart: string,
  windowEnd: string,
  intervalMinutes: number
) {
  assertSupabase();
  const payload = {
    weekday,
    is_open: isOpen,
    is_24h: is24h,
    window_start: windowStart,
    window_end: windowEnd,
    interval_minutes: intervalMinutes,
  };

  const { data, error } = await supabase
    .from("schedule_rules")
    .upsert(payload, { onConflict: "weekday" })
    .select("*")
    .maybeSingle();

  if (error) {
    return payload;
  }

  return data || payload;
}

export async function ownerGenerateSlotsForDate(token: string, dateValue: string) {
  assertSupabase();

  const templates = buildAutomatic100kSlots(dateValue);

  const scheduledAtValues = templates.map((row) => row.scheduled_at);
  const { data: existing, error: existingError } = await supabase
    .from("fight_slots")
    .select("scheduled_at")
    .eq("fight_date", dateValue)
    .in("scheduled_at", scheduledAtValues);
  if (existingError) throw existingError;

  const existingSet = new Set((existing || []).map((row: any) => String(row?.scheduled_at)));
  const slotsToInsert = templates.filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter((row) => !existingSet.has(String(row.scheduled_at)));
  if (!slotsToInsert.length) return [];

  const { data, error } = await supabase
    .from("fight_slots")
    .insert(slotsToInsert)
    .select("*");
  if (error) throw error;
  return data || [];
}

export async function requestBookmakerApplication(params: {
  userId: string;
  bookmakerCode?: string | null;
  city?: string | null;
  networkSize?: string | null;
  experience?: string | null;
  why?: string | null;
}) {
  assertSupabase();

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id,role,bookmaker_status,bookmaker_code,rp_name")
      .eq("hidden_from_front", false)
    .eq("id", params.userId)
    .single();
  if (userError) throw userError;

  const currentStatus = normalizeBookmakerStatus(user?.bookmaker_status || "NONE");
  if (currentStatus === "APPROVED") throw new Error("BOOKMAKER_ALREADY_APPROVED");
  if (currentStatus === "PENDING") throw new Error("BOOKMAKER_APPLICATION_ALREADY_PENDING");

  const pendingCode = String(params.bookmakerCode || user?.bookmaker_code || "").trim().toUpperCase() || generateOfficialBookmakerCode(user?.rp_name || "BOOK", params.userId);

  const { data, error } = await supabase
    .from("users")
    .update({
      bookmaker_status: "PENDING",
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.userId)
    .select("*")
    .single();
  if (error) throw error;

  await supabase.from("bookmaker_profiles").upsert({
    user_id: params.userId,
    status: "PENDING",
    referral_code: pendingCode,
  }, { onConflict: "user_id" });

  await supabase.from("notifications").insert({
    user_id: params.userId,
    title: "Bookmaker application sent",
    body: "Ta candidature bookmaker a été envoyée au staff.",
    type: "BOOKMAKER_APPLICATION",
    is_read: false,
  });

  return normalizeUserProfile(data, { status: "PENDING", referral_code: pendingCode });
}

export async function fetchPendingBookmakerApplications() {
  assertSupabase();
  const { data, error } = await supabase
    .from("users")
    .select("*")
      .eq("hidden_from_front", false)
    .eq("bookmaker_status", "PENDING")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchApprovedBookmakers(limit = 20) {
  assertSupabase();
  const { data, error } = await supabase
    .from("users")
    .select("*")
      .eq("hidden_from_front", false)
    .eq("role", "bookmaker")
    .eq("bookmaker_status", "APPROVED")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function countApprovedBookmakers() {
  assertSupabase();
  const { count, error } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
      .eq("hidden_from_front", false)
    .eq("role", "bookmaker")
    .eq("bookmaker_status", "APPROVED");
  if (error) throw error;
  return Number(count || 0);
}

function generateOfficialBookmakerCode(rpName: string, userId: string) {
  const base = upper(rpName).replace(/[^A-Z0-9]/g, "").slice(0, 6) || "BOOK";
  const suffix = String(userId || "").replace(/-/g, "").slice(0, 4).toUpperCase() || "0000";
  return `${base}-${suffix}`;
}

export async function staffApproveBookmakerApplication(params: {
  staffId: string;
  userId: string;
  bookmakerCode?: string | null;
}) {
  assertSupabase();

  const officialCode = upper(String(params.bookmakerCode || "").trim()) || null;
  const { data, error } = await supabase.rpc("staff_approve_bookmaker_application_v1", {
    p_staff_id: params.staffId,
    p_user_id: params.userId,
    p_bookmaker_code: officialCode,
  });
  if (error) throw error;

  const result = data as any;
  if (result?.ok === false) throw new Error(result?.reason || "BOOKMAKER_APPROVAL_FAILED");
  return fetchMyProfile(params.userId);
}

export async function staffRejectBookmakerApplication(params: {
  staffId: string;
  userId: string;
  note?: string | null;
}) {
  assertSupabase();

  const { data, error } = await supabase.rpc("staff_reject_bookmaker_application_v1", {
    p_staff_id: params.staffId,
    p_user_id: params.userId,
    p_note: params.note || null,
  });
  if (error) throw error;

  const result = data as any;
  if (result?.ok === false) throw new Error(result?.reason || "BOOKMAKER_REJECTION_FAILED");
  return fetchMyProfile(params.userId);
}

export async function fetchBookmakerOverview(userId: string) {
  assertSupabase();

  const profile = await fetchMyProfile(userId);
  const code = String(profile?.bookmaker_code || "").trim().toUpperCase();
  const kpis = await fetchBookmakerKpis(userId);

  const [referredUsersRes, commissionsRes] = await Promise.all([
    code
      ? supabase
          .from("users")
          .select("id,rp_name,role,created_at")
      .eq("hidden_from_front", false)
          .eq("referred_by_bookmaker_code", code)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("bookmaker_commissions")
      .select("*")
      .eq("bookmaker_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (referredUsersRes?.error) throw referredUsersRes.error;
  if (commissionsRes?.error) throw commissionsRes.error;

  return {
    status: normalizeBookmakerStatus(profile?.bookmaker_status || "NONE"),
    referral_code: code || null,
    kpis,
    referred_users: Array.isArray(referredUsersRes?.data) ? referredUsersRes.data : [],
    commissions: Array.isArray(commissionsRes?.data) ? commissionsRes.data : [],
  };
}

export async function fetchBookmakerKpis(userId: string) {
  assertSupabase();

  const profile = await fetchMyProfile(userId);
  const code = String(profile?.bookmaker_code || "").trim().toUpperCase();
  if (!code) {
    return {
      referred_users: 0,
      approved_deposit_requests: 0,
      commission_total_cents: 0,
      commission_pending_cents: 0,
      commission_paid_cents: 0,
      referral_code: null,
      status: normalizeBookmakerStatus(profile?.bookmaker_status || "NONE"),
    };
  }

  const [{ count: referredUsersCount, error: referredError }, { data: referredRows, error: referredRowsError }, commissionsRes] = await Promise.all([
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("hidden_from_front", false)
      .eq("referred_by_bookmaker_code", code),
    supabase
      .from("users")
      .select("id")
      .eq("hidden_from_front", false)
      .eq("referred_by_bookmaker_code", code),
    supabase
      .from("bookmaker_commissions")
      .select("amount_cents,status")
      .eq("bookmaker_user_id", userId),
  ]);
  if (referredError) throw referredError;
  if (referredRowsError) throw referredRowsError;

  const referredIds = (referredRows || []).map((x: any) => x.id);
  let approvedDeposits = 0;
  if (referredIds.length > 0) {
    const { count: referredDepositorsCount, error: depositorsError } = await supabase
      .from("wallet_deposit_requests")
      .select("id", { count: "exact", head: true })
      .in("user_id", referredIds)
      .eq("status", "APPROVED");
    if (depositorsError) throw depositorsError;
    approvedDeposits = Number(referredDepositorsCount || 0);
  }

  if (commissionsRes?.error) throw commissionsRes.error;
  const commissions = Array.isArray(commissionsRes?.data) ? commissionsRes.data : [];
  const commissionTotal = commissions.reduce((sum: number, row: any) => sum + money(row?.amount_cents), 0);
  const commissionPending = commissions
    .filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter((row: any) => upper(row?.status || "PENDING") !== "PAID")
    .reduce((sum: number, row: any) => sum + money(row?.amount_cents), 0);
  const commissionPaid = commissions
    .filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter((row: any) => upper(row?.status || "") === "PAID")
    .reduce((sum: number, row: any) => sum + money(row?.amount_cents), 0);

  return {
    referred_users: Number(referredUsersCount || 0),
    approved_deposit_requests: approvedDeposits,
    commission_total_cents: commissionTotal,
    commission_pending_cents: commissionPending,
    commission_paid_cents: commissionPaid,
    referral_code: code,
    status: normalizeBookmakerStatus(profile?.bookmaker_status || "NONE"),
  };
}

export async function applyFighterCapacityForUser(userId: string) {
  assertSupabase();
  const { data, error } = await supabase.rpc("apply_fighter_capacity_for_user", {
    p_user_id: userId,
  });
  if (error) throw error;
  return data;
}

export async function runFighterCapacityMaintenance() {
  assertSupabase();
  const { data, error } = await supabase.rpc("run_fighter_capacity_maintenance");
  if (error) throw error;
  return data;
}

export async function getUserProfile(userId: string) {
  return fetchMyProfile(userId);
}

export async function getWallet(userId: string) {
  return fetchMyWallet(userId);
}

const MISSION_CODES = {
  viewedArena: { code: "view_arena", target: 1 },
  viewedFight: { code: "view_fight", target: 1 },
  viewedWallet: { code: "view_wallet", target: 1 },
  openedBookmaker: { code: "open_bookmaker", target: 1 },
  bookmakerApplied: { code: "apply_bookmaker", target: 1 },
  placedBetCount: { code: "place_bet", target: 1 },
  bookedFightCount: { code: "book_fight", target: 1 },
  boughtTicketCount: { code: "buy_ticket", target: 1 },
};

function missionFlagFromRows(rows: any[]) {
  const flags: any = {};
  for (const [key, meta] of Object.entries(MISSION_CODES)) {
    const row = (rows || []).find((item: any) => String(item?.mission_code || "") === (meta as any).code);
    if (!row) continue;
    const progress = Number(row?.progress || 0);
    flags[key] = key.endsWith("Count") ? progress : progress > 0;
  }
  return flags;
}

export async function fetchMissionFlags(userId: string) {
  assertSupabase();
  if (!userId) return {};
  const { data, error } = await supabase
    .from("user_missions")
    .select("mission_code,progress,target,completed,updated_at")
    .eq("user_id", userId);
  if (error) throw error;
  return missionFlagFromRows(Array.isArray(data) ? data : []);
}

export async function syncMissionFlags(userId: string, flags: any) {
  assertSupabase();
  if (!userId || !flags) return null;
  const now = new Date().toISOString();
  const rows = Object.entries(MISSION_CODES).map(([key, meta]) => {
    const raw = (flags as any)?.[key];
    const progress = key.endsWith("Count") ? Math.max(0, Number(raw || 0)) : raw ? 1 : 0;
    return {
      user_id: userId,
      mission_code: (meta as any).code,
      progress,
      target: (meta as any).target,
      completed: progress >= Number((meta as any).target || 1),
      updated_at: now,
    };
  });
  const { error } = await supabase.from("user_missions").upsert(rows, { onConflict: "user_id,mission_code" });
  if (error) throw error;
  return true;
}

// HHFC FINAL RULES
// Canonical matchmaking flow:
// - fighter_request_match_slot_v3
// - hhfc_matchmake_slot_v2
// - hhfc_request_and_match_slot_v2
//
// Legacy V1 flows should no longer be used in production.
