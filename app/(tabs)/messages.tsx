import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { deleteConversation, inbox } from "../../services/api";

/* ---------- helpers ---------- */

function getInitials(name: string) {
  const n = (name || "").trim();
  if (!n) return "M";
  const parts = n.split(" ").filter(Boolean);
  const a = parts[0]?.[0] || "M";
  const b = parts[1]?.[0] || "";
  return (a + b).toUpperCase();
}

function formatInboxTime(value: any) {
  try {
    const d = new Date(value);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();

    if (sameDay) {
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${hh}:${mm}`;
    }

    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}.${mm}`;
  } catch {
    return "";
  }
}

function isValidUri(u?: string | null) {
  return !!u && typeof u === "string" && (u.startsWith("http") || u.startsWith("data:image"));
}

function pickAvatarUrl(item: any) {
  const raw =
    item?.other_avatar_url ||
    item?.other_avatar ||
    item?.other_photo_url ||
    item?.avatar_url ||
    item?.avatar ||
    item?.photo_url ||
    null;

  if (!raw) return null;

  try {
    const decoded = decodeURIComponent(String(raw));
    return isValidUri(decoded) ? decoded : String(raw);
  } catch {
    return isValidUri(String(raw)) ? String(raw) : null;
  }
}

function pickOtherName(item: any) {
  return (item?.other_user_name && String(item.other_user_name).trim()) || "Kullanıcı";
}

/* ---------- ui ---------- */

function Avatar({ uri, label }: { uri?: string | null; label: string }) {
  const initials = useMemo(() => getInitials(label), [label]);
  const hasImg = isValidUri(uri);

  return (
    <View style={styles.avatarWrap}>
      {hasImg ? (
        <Image source={{ uri: uri! }} style={styles.avatarImg} />
      ) : (
        <>
          <View style={styles.avatarGlow} />
          <Text style={styles.avatarText}>{initials}</Text>
        </>
      )}
    </View>
  );
}

export default function MessagesTab() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const r = await inbox();
      setItems(r?.inbox ?? []);
    } catch (e) {
      console.log("inbox error", e);
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [])
  );

  const openChat = (it: any) => {
    const otherName = pickOtherName(it);
    const avatarUrl = pickAvatarUrl(it);

    router.push({
      pathname: "/chat",
      params: {
        other_user_id: String(it.other_user_id),
        title: encodeURIComponent(otherName),
        ...(avatarUrl ? { other_avatar_url: encodeURIComponent(avatarUrl) } : {}),
      },
    });
  };

  const onDeleteConversation = (it: any) => {
    const otherName = pickOtherName(it);
    const otherId = it?.other_user_id;

    Alert.alert(
      "Sohbeti sil",
      `${otherName} ile olan tüm mesajlar kalıcı olarak silinsin mi?`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            // ✅ Optimistic: listeden kaldır
            setItems((prev) => prev.filter((x) => String(x.other_user_id) !== String(otherId)));

            try {
              await deleteConversation(otherId);
            } catch (e: any) {
              // başarısızsa geri yükle
              Alert.alert("Hata", String(e?.message || "Sohbet silinemedi"));
              load(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerGlowA} />
        <View style={styles.headerGlowB} />

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Mesajlarım</Text>
          <Text style={styles.subtitle}>Konuşmaların ve son mesajların</Text>
        </View>

        <Pressable
          onPress={() => load(true)}
          style={styles.iconBtn}
          disabled={loading || refreshing}
        >
          {loading || refreshing ? (
            <ActivityIndicator color="#A3E635" />
          ) : (
            <Ionicons name="refresh" size={18} color="white" />
          )}
        </Pressable>
      </View>

      {/* LIST */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#A3E635" />
          <Text style={styles.loadingText}>Yükleniyor…</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => String(it.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor="#A3E635"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Ionicons name="chatbubble-ellipses-outline" size={22} color="#A3E635" />
              </View>
              <Text style={styles.emptyTitle}>Henüz mesaj yok</Text>
              <Text style={styles.emptySub}>
                İlanlardan mesajlaşmaya başlayınca konuşmaların burada gözükecek.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const otherName = pickOtherName(item);
            const avatarUrl = pickAvatarUrl(item);
            const time = formatInboxTime(item.created_at);
            const preview = (item.text && String(item.text).trim()) || "Mesaj yok";

            return (
              <Pressable
                onPress={() => openChat(item)}
                onLongPress={() => onDeleteConversation(item)}
                delayLongPress={350}
                style={({ pressed }) => [
                  styles.card,
                  pressed && { opacity: 0.86, transform: [{ scale: 0.995 }] },
                ]}
              >
                <View style={styles.row}>
                  <Avatar uri={avatarUrl} label={otherName} />

                  <View style={{ flex: 1 }}>
                    <View style={styles.topRow}>
                      <Text style={styles.name} numberOfLines={1}>
                        {otherName}
                      </Text>

                      <View style={styles.timeWrap}>
                        <Text style={styles.time}>{time}</Text>
                      </View>
                    </View>

                    <Text style={styles.preview} numberOfLines={1}>
                      {preview}
                    </Text>

                    <Text style={styles.hint} numberOfLines={1}>
                      Uzun bas: Sil
                    </Text>
                  </View>

                  <View style={styles.chev}>
                    <Ionicons name="chevron-forward" size={18} color="#6B7280" />
                  </View>
                </View>
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListFooterComponent={<View style={{ height: 18 }} />}
        />
      )}
    </SafeAreaView>
  );
}

/* ---------- styles ---------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#020A08" },

  header: {
    padding: 16,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.02)",
    overflow: "hidden",
  },
  headerGlowA: {
    position: "absolute",
    top: -80,
    right: -80,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(163,230,53,0.14)",
  },
  headerGlowB: {
    position: "absolute",
    bottom: -90,
    left: -90,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(96,165,250,0.10)",
  },

  title: { color: "white", fontSize: 24, fontWeight: "900" },
  subtitle: { color: "#9CA3AF", marginTop: 6, fontWeight: "700", fontSize: 12 },

  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { color: "#9CA3AF", marginTop: 10, fontWeight: "800", fontSize: 12 },

  list: { padding: 16, paddingTop: 14 },

  emptyWrap: { paddingTop: 40, alignItems: "center" },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "rgba(163,230,53,0.12)",
    borderWidth: 1,
    borderColor: "rgba(163,230,53,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { color: "white", fontWeight: "900", marginTop: 14, fontSize: 15 },
  emptySub: {
    color: "#9CA3AF",
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 16,
    maxWidth: 280,
  },

  card: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  row: { flexDirection: "row", alignItems: "center", gap: 12 },

  avatarWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  avatarGlow: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 999,
    backgroundColor: "rgba(163,230,53,0.16)",
    top: -18,
    right: -18,
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarText: { color: "white", fontWeight: "900" },

  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  name: { color: "white", fontWeight: "900", fontSize: 14, flex: 1 },

  timeWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  time: { color: "#9CA3AF", fontWeight: "800", fontSize: 11 },

  preview: { color: "#9CA3AF", marginTop: 6, fontSize: 12, fontWeight: "700" },
  hint: { color: "rgba(163,230,53,0.65)", marginTop: 6, fontSize: 11, fontWeight: "800" },

  chev: { width: 26, alignItems: "flex-end", justifyContent: "center" },
});
