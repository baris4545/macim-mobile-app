import * as SecureStore from "expo-secure-store";

export const API_BASE = "http://192.168.1.11:3000";

/* ===================== HELPERS ===================== */

async function getToken() {
  return SecureStore.getItemAsync("token");
}

async function clearToken() {
  try {
    await SecureStore.deleteItemAsync("token");
  } catch {}
}

async function authHeaders(extra?: Record<string, string>) {
  const token = await getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extra ?? {}),
  };

  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * JSON bekler. HTML gelirse (Unexpected "<") body'nin başını gösterir.
 * res.ok değilse backend error'ünü fırlatır.
 * 401 / invalid_token gelirse token'ı temizler.
 */
async function safeJson(res: Response) {
  const text = await res.text();

  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`JSON değil! status=${res.status} body=${text.slice(0, 200)}`);
  }

  if (res.status === 401 && (data?.error === "unauthorized" || data?.error === "invalid_token")) {
    await clearToken();
  }

  if (!res.ok) {
    throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  }

  return data;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: any;
  auth?: boolean; // default true
  headers?: Record<string, string>;
};

async function request(path: string, options: RequestOptions = {}) {
  const method = options.method ?? "GET";
  const auth = options.auth ?? true;

  const headers = auth
    ? await authHeaders(options.headers)
    : { "Content-Type": "application/json", ...(options.headers ?? {}) };

  const url = `${API_BASE}${path}`;

  const res = await fetch(url, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  return safeJson(res);
}

/* ===================== AUTH ===================== */

export async function login(email: string, password: string) {
  return request("/auth/login", {
    method: "POST",
    auth: false,
    body: { email, password },
  });
}

export async function register(email: string, password: string) {
  return request("/auth/register", {
    method: "POST",
    auth: false,
    body: { email, password },
  });
}

/* ===================== PROFILE ===================== */

export async function getMe() {
  return request("/me");
}

export async function updateMe(payload: any) {
  return request("/me", {
    method: "PUT",
    body: payload,
  });
}

/* ===================== RESERVATIONS ===================== */

/**
 * ✅ Rezervasyon oluşturma
 * Server.js tarafında bunun karşılığı: POST /reservations olmalı.
 */
export async function createReservation(payload: any) {
  return request("/reservations", { method: "POST", body: payload });
}

export async function getAvailability(fieldId: string, date: string) {
  const q = `?field_id=${encodeURIComponent(fieldId)}&date=${encodeURIComponent(date)}`;
  return request(`/reservations/availability${q}`);
}

export async function myReservations() {
  return request("/my/reservations");
}

export async function deleteReservation(id: number) {
  return request(`/reservations/${id}`, { method: "DELETE" });
}

/* ===================== PLAYERS ===================== */

export async function listPlayers() {
  return request("/players");
}

export async function createPlayerPost(payload: any) {
  return request("/players", { method: "POST", body: payload });
}

export async function myPlayerPosts() {
  return request("/my/player-posts");
}

/* ===================== MATCHES ===================== */

export async function listMatches() {
  return request("/matches");
}

export async function createMatch(payload: any) {
  return request("/matches", { method: "POST", body: payload });
}

export async function myMatchPosts() {
  return request("/my/match-posts");
}

export async function deleteMyPlayerPost(id: number) {
  return request(`/my/player-posts/${id}`, { method: "DELETE" });
}

export async function updateMyPlayerPost(
  id: number,
  payload: { position?: string; city?: string; note?: string }
) {
  return request(`/my/player-posts/${id}`, { method: "PUT", body: payload });
}

export async function deleteMyMatchPost(id: number) {
  return request(`/my/match-posts/${id}`, { method: "DELETE" });
}

export async function updateMyMatchPost(
  id: number,
  payload: { city?: string; field?: string; match_date?: string; match_time?: string; note?: string }
) {
  return request(`/my/match-posts/${id}`, { method: "PUT", body: payload });
}

/* ===================== FIELDS ===================== */

export async function listFields() {
  return request("/fields", { auth: false });
}

/* ===================== CHAT ===================== */

export async function inbox() {
  return request("/messages/inbox");
}

export async function getChat(otherUserId: number | string) {
  return request(`/messages/chat/${otherUserId}`);
}

export async function sendMessage(payload: { receiver_id: number; text: string }) {
  return request("/messages", { method: "POST", body: payload });
}
export async function deleteConversation(otherUserId: number | string) {
  return request(`/messages/conversation/${otherUserId}`, { method: "DELETE" });
}

/* ===================== DEBUG (opsiyonel) ===================== */

export async function debugMyPosts() {
  return request("/debug/my-posts");
}
