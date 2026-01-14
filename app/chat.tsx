import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useCallback, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { deleteConversation, getChat, getMe, sendMessage } from "../services/api";

/* ---------- hidden conversations (same key as messages.tsx) ---------- */

const HIDDEN_KEY = "hidden_conversations_v1";

async function readHiddenIds(): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(HIDDEN_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

async function writeHiddenIds(ids: string[]) {
  try {
    await SecureStore.setItemAsync(HIDDEN_KEY, JSON.stringify(ids));
  } catch {}
}

/* ---------- helpers ---------- */

function formatTime(value: any) {
  try {
    const d = new Date(value);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch {
    return "";
  }
}

function getInitials(name: string) {
  const t = (name || "").trim();
  if (!t) return "M";
  const parts = t.split(" ").filter(Boolean);
  const a = parts[0]?.[0] || "M";
  const b = parts[1]?.[0] || "";
  return (a + b).toUpperCase();
}

function isValidUri(u?: string | null) {
  return !!u && typeof u === "string" && (u.startsWith("http") || u.startsWith("data:image"));
}

/* ---------- small ui ---------- */

function Avatar({
  uri,
  label,
  size = 38,
  variant = "soft",
}: {
  uri?: string | null;
  label: string;
  size?: number;
  variant?: "soft" | "dark";
}) {
  const initials = useMemo(() => getInitials(label), [label]);
  const hasImg = isValidUri(uri);

  const wrapStyle = [
    styles.avatarWrap,
    { width: size, height: size, borderRadius: Math.max(12, Math.floor(size * 0.36)) },
    variant === "dark" ? styles.avatarDark : styles.avatarSoft,
  ] as any;

  return (
    <View style={wrapStyle}>
      {hasImg ? (
        <Image source={{ uri: uri! }} style={{ width: "100%", height: "100%" }} />
      ) : (
        <Text style={styles.avatarText}>{initials}</Text>
      )}
    </View>
  );
}

export default function Chat() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    other_user_id?: string;
    title?: string;
    other_avatar_url?: string;
  }>();

  const otherUserId = params.other_user_id ? Number(params.other_user_id) : null;
  const otherUserIdStr = otherUserId != null ? String(otherUserId) : "";

  const title = params.title ? decodeURIComponent(String(params.title)) : "Sohbet";

  const [myId, setMyId] = useState<number | null>(null);
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);

  const otherAvatarUrl = params.other_avatar_url
    ? decodeURIComponent(String(params.other_avatar_url))
    : null;

  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const [isDeleted, setIsDeleted] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  const scrollToBottom = (animated = true) => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated }));
  };

  const checkDeleted = useCallback(async () => {
    if (!otherUserIdStr) return false;
    const hidden = await readHiddenIds();
    const deleted = hidden.includes(otherUserIdStr);
    setIsDeleted(deleted);
    return deleted;
  }, [otherUserIdStr]);

  const load = useCallback(async () => {
    if (!otherUserId) return;

    setLoading(true);
    try {
      // ✅ sohbet silindiyse chat içini de boşalt
      const deleted = await checkDeleted();
      if (deleted) {
        setMessages([]);
        return;
      }

      // ✅ benim id + avatar
      if (myId == null) {
        const me = await getMe();
        if (me?.ok && me?.user?.id) setMyId(Number(me.user.id));

        const avatar =
          me?.user?.avatar_url ||
          me?.user?.avatar ||
          me?.user?.photo_url ||
          null;

        if (avatar) setMyAvatarUrl(String(avatar));
      }

      const r = await getChat(otherUserId);
      setMessages(r?.messages ?? []);
      setTimeout(() => scrollToBottom(false), 60);
    } finally {
      setLoading(false);
    }
  }, [otherUserId, checkDeleted, myId]);

  // ✅ ekrana her gelişte “silinmiş mi?” kontrol et
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const restoreConversation = async () => {
    if (!otherUserIdStr) return;
    const hidden = await readHiddenIds();
    const next = hidden.filter((x) => String(x) !== otherUserIdStr);
    await writeHiddenIds(next);
    setIsDeleted(false);
    await load();
  };

  // ✅ KALICI SİL (DB + chat temizle + hidden’a ekle)
  const hardDeleteConversation = async () => {
    if (!otherUserId || !otherUserIdStr) return;

    Alert.alert(
      "Sohbeti sil",
      "Bu konuşmadaki tüm mesajlar kalıcı olarak silinsin mi?",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);

              // 1) DB’den sil
              await deleteConversation(otherUserId);

              // 2) local hidden listesine ekle (senin mevcut akışın bozulmasın)
              const hidden = await readHiddenIds();
              const next = hidden.includes(otherUserIdStr)
                ? hidden
                : [...hidden, otherUserIdStr];
              await writeHiddenIds(next);

              // 3) chat’i temizle
              setMessages([]);
              setText("");
              setIsDeleted(true);

              // İstersen direk geri dön:
              router.back();
            } catch (e: any) {
              Alert.alert("Hata", String(e?.message || "Sohbet silinemedi"));
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const onSend = async () => {
    if (!otherUserId) return;

    // ✅ sohbet silindiyse mesaj gönderme
    const deleted = await checkDeleted();
    if (deleted) {
      Alert.alert("Sohbet silindi", "Bu sohbet silindiği için mesaj gönderemezsin.");
      return;
    }

    const t = text.trim();
    if (!t) return;

    setSending(true);
    try {
      const temp = {
        id: `temp-${Date.now()}`,
        sender_id: myId ?? -1,
        receiver_id: otherUserId,
        text: t,
        created_at: new Date().toISOString(),
        _temp: true,
      };

      setMessages((prev) => [...prev, temp]);
      setText("");
      setTimeout(() => scrollToBottom(true), 30);

      await sendMessage({ receiver_id: otherUserId, text: t });
      await load();
    } catch (e) {
      setMessages((prev) => prev.filter((m) => !m?._temp));
      setText(t);
      Alert.alert("Hata", "Mesaj gönderilemedi");
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* HEADER */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color="white" />
        </Pressable>

        <View style={styles.headerMid}>
          <Avatar uri={otherAvatarUrl} label={title} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
            <View style={styles.headerPill}>
              <View style={[styles.dot, isDeleted && { backgroundColor: "rgba(239,68,68,0.9)" }]} />
              <Text style={styles.headerSub} numberOfLines={1}>
                {isDeleted ? "Sohbet silindi" : "Uygulama içi mesajlaşma"}
              </Text>
            </View>
          </View>
        </View>

        {/* ✅ SİL BUTONU */}
        <Pressable
          onPress={hardDeleteConversation}
          style={styles.iconBtn}
          disabled={loading}
        >
          <Ionicons name="trash-outline" size={18} color="white" />
        </Pressable>

        {/* REFRESH */}
        <Pressable onPress={load} style={styles.iconBtn} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#A3E635" />
          ) : (
            <Ionicons name="refresh" size={18} color="white" />
          )}
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        {/* ✅ Deleted Banner */}
        {isDeleted && (
          <View style={styles.deletedBanner}>
            <View style={styles.deletedIcon}>
              <Ionicons name="trash-outline" size={18} color="#A3E635" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.deletedTitle}>Bu sohbet silindi</Text>
              <Text style={styles.deletedSub}>
                Mesajlar kaldırıldı. İstersen sohbeti geri görünür yapabilirsin.
              </Text>
            </View>

            <Pressable onPress={restoreConversation} style={styles.restoreBtn}>
              <Text style={styles.restoreText}>Geri getir</Text>
            </Pressable>
          </View>
        )}

        {/* MESSAGES */}
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollToBottom(false)}
        >
          {loading && messages.length === 0 ? (
            <View style={styles.center}>
              <ActivityIndicator color="#A3E635" />
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name={isDeleted ? "trash-outline" : "chatbubble-ellipses-outline"}
                  size={22}
                  color={isDeleted ? "#A3E635" : "#9CA3AF"}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {isDeleted ? "Sohbet temizlendi" : "Henüz mesaj yok"}
              </Text>
              <Text style={styles.emptySub}>
                {isDeleted ? "Bu konuşmanın mesajları silindi." : "İlk mesajı sen gönder."}
              </Text>
            </View>
          ) : (
            messages.map((m) => {
              const mine = myId != null && Number(m.sender_id) === myId;

              return (
                <View
                  key={String(m.id)}
                  style={[styles.row, mine ? styles.rowRight : styles.rowLeft]}
                >
                  {!mine ? (
                    <Avatar uri={otherAvatarUrl} label={title} size={32} variant="dark" />
                  ) : (
                    <View style={{ width: 32 }} />
                  )}

                  <View
                    style={[
                      styles.bubbleWrap,
                      mine ? { alignItems: "flex-end" } : { alignItems: "flex-start" },
                    ]}
                  >
                    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                      <Text style={[styles.msgText, mine ? styles.msgTextMine : styles.msgTextOther]}>
                        {m.text}
                      </Text>
                      <Text style={[styles.time, mine ? styles.timeMine : styles.timeOther]}>
                        {formatTime(m.created_at)}
                      </Text>
                      <View style={[styles.tail, mine ? styles.tailMine : styles.tailOther]} />
                    </View>
                  </View>

                  {mine ? (
                    <Avatar uri={myAvatarUrl} label="Ben" size={32} variant="dark" />
                  ) : (
                    <View style={{ width: 32 }} />
                  )}
                </View>
              );
            })
          )}

          <View style={{ height: 10 }} />
        </ScrollView>

        {/* INPUT BAR */}
        <View style={[styles.inputBar, isDeleted && { opacity: 0.55 }]}>
          <View style={styles.inputWrap}>
            <Ionicons name="create-outline" size={18} color="#9CA3AF" />
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={isDeleted ? "Sohbet silindi" : "Mesaj yaz..."}
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              multiline
              editable={!isDeleted}
            />
          </View>

          <Pressable
            onPress={onSend}
            disabled={isDeleted || sending || text.trim().length === 0}
            style={[
              styles.sendBtn,
              (isDeleted || sending || text.trim().length === 0) && { opacity: 0.55 },
            ]}
          >
            {sending ? (
              <ActivityIndicator color="#052E1C" />
            ) : (
              <Ionicons name="send" size={18} color="#052E1C" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ---------- styles ---------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#020A08" },

  header: {
    height: 60,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
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
  headerMid: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },

  headerTitle: { color: "white", fontWeight: "900", fontSize: 16 },
  headerPill: {
    marginTop: 4,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 99,
    backgroundColor: "rgba(163,230,53,0.9)",
  },
  headerSub: { color: "#9CA3AF", fontSize: 11, fontWeight: "800" },

  deletedBanner: {
    margin: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: "rgba(11, 18, 32, 0.98)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  deletedIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  deletedTitle: { color: "white", fontWeight: "900", fontSize: 13 },
  deletedSub: { color: "#9CA3AF", marginTop: 4, fontSize: 12, fontWeight: "700" },
  restoreBtn: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "#A3E635",
    alignItems: "center",
    justifyContent: "center",
  },
  restoreText: { color: "#052E1C", fontWeight: "900" },

  list: { padding: 14, flexGrow: 1 },
  center: { paddingTop: 24, alignItems: "center" },

  emptyWrap: { paddingTop: 40, alignItems: "center" },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  emptyTitle: { color: "white", fontWeight: "900", marginTop: 12 },
  emptySub: { color: "#9CA3AF", marginTop: 6, fontSize: 12, fontWeight: "700" },

  row: { flexDirection: "row", alignItems: "flex-end", marginBottom: 12, gap: 8 },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end" },

  bubbleWrap: { flex: 1 },

  bubble: {
    maxWidth: "86%",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    borderRadius: 18,
    borderWidth: 1,
    position: "relative",
    overflow: "visible",
  },
  bubbleMine: {
    backgroundColor: "#A3E635",
    borderColor: "rgba(163,230,53,0.40)",
    borderTopRightRadius: 8,
  },
  bubbleOther: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.12)",
    borderTopLeftRadius: 8,
  },

  msgText: { fontSize: 14, lineHeight: 20, fontWeight: "700" },
  msgTextMine: { color: "#052E1C" },
  msgTextOther: { color: "white" },

  time: { fontSize: 10, marginTop: 6, fontWeight: "900" },
  timeMine: { color: "rgba(5,46,28,0.75)", textAlign: "right" },
  timeOther: { color: "#9CA3AF", textAlign: "right" },

  tail: {
    position: "absolute",
    bottom: 10,
    width: 10,
    height: 10,
    borderRadius: 3,
    transform: [{ rotate: "45deg" }],
  },
  tailMine: {
    right: -5,
    backgroundColor: "#A3E635",
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(163,230,53,0.40)",
  },
  tailOther: {
    left: -5,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  inputBar: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-end",
    padding: 10,
    margin: 12,
    borderRadius: 22,
    backgroundColor: "rgba(11, 18, 32, 0.98)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  input: {
    flex: 1,
    color: "white",
    fontSize: 14,
    maxHeight: 110,
    padding: 0,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: "#A3E635",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarWrap: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  avatarSoft: {
    backgroundColor: "rgba(163,230,53,0.14)",
    borderColor: "rgba(163,230,53,0.35)",
  },
  avatarDark: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.12)",
  },
  avatarText: { color: "white", fontWeight: "900", fontSize: 12 },
});
