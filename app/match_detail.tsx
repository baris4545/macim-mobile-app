import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

// ✅ eklendi (Home / PlayerDetail ile aynı mantık)
import { Buffer } from "buffer";
import * as SecureStore from "expo-secure-store";

export default function MatchDetail() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    city?: string;
    field?: string;
    match_date?: string;
    match_time?: string;
    note?: string;

    // ✅ ilan sahibi
    user_id?: string;
    name?: string;

    // ✅ ilan sahibinin avatarı (liste/card ekranından göndereceğiz)
    avatar_url?: string;
  }>();

  const city = params.city || "-";
  const field = params.field || "-";
  const date = params.match_date || "-";
  const time = params.match_time || "-";
  const note = params.note || "";

  const ownerName = params.name || "Kullanıcı";
  const userId = params.user_id ? Number(params.user_id) : null;

  // ✅ burası eksikti (hata sebebi)
  const ownerAvatarUrl = params.avatar_url ? String(params.avatar_url) : "";

  // ✅ benim user id
  const [myUserId, setMyUserId] = useState<number | null>(null);

  // ✅ JWT payload decode (Expo/RN uyumlu)
  const decodeJwtPayload = (token: string) => {
    try {
      const parts = token.split(".");
      if (parts.length < 2) return null;

      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);

      const json = Buffer.from(padded, "base64").toString("utf8");
      return JSON.parse(json);
    } catch {
      return null;
    }
  };

  // ✅ kullanıcı id bul (token’dan veya securestore’dan)
  const loadMe = async () => {
    try {
      // 1) Direkt kayıtlı user id var mı?
      const direct =
        (await SecureStore.getItemAsync("user_id")) ||
        (await SecureStore.getItemAsync("userId")) ||
        (await SecureStore.getItemAsync("uid")) ||
        (await SecureStore.getItemAsync("me_user_id")) ||
        (await SecureStore.getItemAsync("profile_user_id"));

      if (direct) {
        const n = Number(direct);
        if (n && !Number.isNaN(n)) {
          setMyUserId(n);
          return;
        }
      }

      // 1.1) Bazı projelerde "me" / "user" JSON olarak kaydediliyor
      const meRaw =
        (await SecureStore.getItemAsync("me")) ||
        (await SecureStore.getItemAsync("user")) ||
        (await SecureStore.getItemAsync("profile"));

      if (meRaw) {
        try {
          const me = JSON.parse(meRaw);
          const raw = me?.id ?? me?.user_id ?? me?.userId ?? me?.sub;
          const n = Number(raw);
          if (n && !Number.isNaN(n)) {
            setMyUserId(n);
            return;
          }
        } catch {}
      }

      // 2) Token’dan çöz
      const token =
        (await SecureStore.getItemAsync("token")) ||
        (await SecureStore.getItemAsync("access_token")) ||
        (await SecureStore.getItemAsync("accessToken")) ||
        (await SecureStore.getItemAsync("jwt"));

      if (!token) return;

      const payload = decodeJwtPayload(token);

      const raw =
        payload?.user_id ??
        payload?.userId ??
        payload?.id ??
        payload?.sub ??
        payload?.uid;

      const n = Number(raw);
      if (n && !Number.isNaN(n)) setMyUserId(n);
    } catch (e) {
      console.log("loadMe error", e);
    }
  };

  useEffect(() => {
    loadMe();
  }, []);

  // ✅ “bu ilan benim mi?”
  const isMine = () => {
    const a = Number(myUserId);
    const b = Number(userId);
    if (!a || Number.isNaN(a) || !b || Number.isNaN(b)) return false;
    return a === b;
  };

  const goChat = () => {
    if (!userId) {
      alert("Kullanıcı bilgisi bulunamadı (user_id).");
      return;
    }

    router.push({
      pathname: "/chat",
      params: {
        other_user_id: String(userId),
        title: encodeURIComponent(ownerName),
        ...(ownerAvatarUrl
          ? { other_avatar_url: encodeURIComponent(ownerAvatarUrl) }
          : {}),
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* HEADER */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color="white" />
        </Pressable>

        <Text style={styles.headerTitle}>Maç İlanı</Text>

        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="close" size={18} color="white" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* HERO */}
        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <View style={styles.heroTop}>
            <View style={[styles.heroIcon, { borderColor: "rgba(96,165,250,0.40)" }]}>
              <Ionicons name="football" size={20} color="#60A5FA" />
            </View>
            <View style={styles.heroTag}>
              <Ionicons name="sparkles" size={14} color="#A3E635" />
              <Text style={styles.heroTagText}>Rakip aranıyor</Text>
            </View>
          </View>

          <Text style={styles.heroTitle} numberOfLines={1}>
            {city} • {field}
          </Text>

          <View style={styles.pills}>
            <Pill icon="calendar-outline" text={date} />
            <Pill icon="time-outline" text={time} />
          </View>
        </View>

        {/* INFO */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detaylar</Text>

          <View style={styles.infoCard}>
            <InfoRow icon="location-outline" label="Şehir" value={city} />
            <InfoRow icon="map-outline" label="Saha" value={field} />
            <InfoRow icon="calendar-outline" label="Tarih" value={date} />
            <InfoRow icon="time-outline" label="Saat" value={time} />
            <InfoRow icon="person-outline" label="İlan Sahibi" value={ownerName} />
          </View>
        </View>

        {/* NOTE */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Açıklama</Text>
          <View style={styles.noteBox}>
            {note ? (
              <Text style={styles.noteText}>{note}</Text>
            ) : (
              <Text style={styles.noteMuted}>Bu ilan için açıklama girilmemiş.</Text>
            )}
          </View>
        </View>

        <View style={{ height: 90 }} />
      </ScrollView>

      {/* BOTTOM BAR */}
      <View style={styles.bottomBar}>
        <Pressable style={styles.ghostBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color="white" />
          <Text style={styles.ghostText}>Geri</Text>
        </Pressable>

        {/* ✅ KENDİ İLANINDA “Mesaj At” GÖRÜNMESİN */}
        {!isMine() && (
          <Pressable style={styles.primaryBtn} onPress={goChat}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color="#052E1C" />
            <Text style={styles.primaryText}>Mesaj At</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

/* ---------- SMALL UI ---------- */

function Pill({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.pill}>
      <Ionicons name={icon} size={14} color="#D1D5DB" />
      <Text style={styles.pillText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <View style={styles.infoIcon}>
          <Ionicons name={icon} size={16} color="#A3E635" />
        </View>
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/* ---------- STYLES ---------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#020A08" },

  header: {
    height: 56,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  headerTitle: { color: "white", fontWeight: "900", fontSize: 16 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  container: { padding: 16 },

  hero: {
    borderRadius: 24,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  heroGlow: {
    position: "absolute",
    top: -80,
    right: -80,
    width: 200,
    height: 200,
    borderRadius: 999,
    backgroundColor: "rgba(96,165,250,0.18)",
  },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.25)",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(163,230,53,0.12)",
    borderWidth: 1,
    borderColor: "rgba(163,230,53,0.28)",
  },
  heroTagText: { color: "white", fontWeight: "900", fontSize: 12 },

  heroTitle: { color: "white", fontSize: 20, fontWeight: "900", marginTop: 14 },
  pills: { flexDirection: "row", gap: 10, marginTop: 14 },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.25)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  pillText: { color: "#D1D5DB", fontWeight: "800", flex: 1, fontSize: 12 },

  section: { marginTop: 14 },
  sectionTitle: { color: "white", fontWeight: "900", fontSize: 16, marginBottom: 10 },

  infoCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  infoLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  infoIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    backgroundColor: "rgba(163,230,53,0.12)",
    borderWidth: 1,
    borderColor: "rgba(163,230,53,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  infoLabel: { color: "#9CA3AF", fontWeight: "800", fontSize: 12 },
  infoValue: { color: "white", fontWeight: "900", fontSize: 12, maxWidth: "55%" },

  noteBox: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  noteText: { color: "#D1D5DB", lineHeight: 18, fontWeight: "700" },
  noteMuted: { color: "#6B7280", fontWeight: "800" },

  bottomBar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    padding: 12,
    borderRadius: 22,
    backgroundColor: "rgba(11, 18, 32, 0.98)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    gap: 10,
  },
  ghostBtn: {
    flex: 1,
    height: 48,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  ghostText: { color: "white", fontWeight: "900" },

  primaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 18,
    backgroundColor: "#A3E635",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryText: { color: "#052E1C", fontWeight: "900" },
});
