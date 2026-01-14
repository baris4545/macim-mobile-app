import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { createPlayerPost, listPlayers } from "../../services/api";

const POSITIONS = ["Kaleci", "Defans", "Orta Saha", "Forvet", "Diğer"] as const;
const CITY_SUGGESTIONS = ["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya"] as const;

export default function Players() {
  const [posts, setPosts] = useState<any[]>([]); // istersen tamamen silebilirsin
  const [form, setForm] = useState({ position: "", city: "", note: "" });

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const canSubmit = useMemo(() => {
    return form.position.trim().length > 0 && form.city.trim().length > 0 && !loading;
  }, [form.position, form.city, loading]);

  const load = async () => {
    setRefreshing(true);
    try {
      const r = await listPlayers();
      setPosts(r?.posts ?? []);
    } catch (e) {
      console.log("Players load error:", e);
      setPosts([]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    if (!form.position.trim() || !form.city.trim()) {
      alert("Pozisyon ve şehir zorunludur");
      return;
    }

    setLoading(true);
    try {
      await createPlayerPost({
        position: form.position.trim(),
        city: form.city.trim(),
        note: form.note.trim(),
      });

      setForm({ position: "", city: "", note: "" });
      await load();
      alert("✅ İlan paylaşıldı");
    } catch (e) {
      console.log("Create post error:", e);
      alert("İlan paylaşılamadı");
    } finally {
      setLoading(false);
    }
  };

  const cityFilled = form.city.trim().length > 0;
  const posFilled = form.position.trim().length > 0;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        >
          {/* HERO */}
          <View style={styles.hero}>
            <View style={styles.heroGlowA} />
            <View style={styles.heroGlowB} />

            <View style={styles.heroTop}>
              <View style={styles.heroIcon}>
                <Ionicons name="people" size={22} color="#A3E635" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Oyuncu Arıyorum</Text>
                <Text style={styles.subtitle}>
                  Eksik pozisyonu ilan ver, oyuncular sana ulaşsın.
                </Text>

                <View style={styles.heroPills}>
                  <View style={styles.pill}>
                    <Ionicons name="flash" size={14} color="#A3E635" />
                    <Text style={styles.pillText}>Hızlı ilan</Text>
                  </View>
                  <View style={styles.pillMuted}>
                    <Ionicons name="shield-checkmark" size={14} color="#D1D5DB" />
                    <Text style={styles.pillMutedText}>Uygulama içi mesaj</Text>
                  </View>
                </View>
              </View>

              <Pressable
                onPress={load}
                style={[styles.refreshBtn, refreshing && { opacity: 0.6 }]}
                disabled={refreshing}
              >
                {refreshing ? (
                  <ActivityIndicator color="#A3E635" />
                ) : (
                  <Ionicons name="refresh" size={18} color="#A3E635" />
                )}
              </Pressable>
            </View>

            {/* Mini progress */}
            <View style={styles.progressRow}>
              <Step done={posFilled} label="Pozisyon" />
              <View style={styles.progressLine} />
              <Step done={cityFilled} label="Şehir" />
              <View style={styles.progressLine} />
              <Step done={canSubmit} label="Hazır" />
            </View>
          </View>

          {/* FORM CARD */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={styles.cardIcon}>
                  <Ionicons name="create-outline" size={18} color="#A3E635" />
                </View>
                <View>
                  <Text style={styles.cardTitle}>İlan Oluştur</Text>
                  <Text style={styles.cardSub}>2 adımda hızlıca paylaş</Text>
                </View>
              </View>

              <View style={styles.badge}>
                <Text style={styles.badgeText}>Yeni</Text>
              </View>
            </View>

            {/* POSITION */}
            <Text style={styles.sectionLabel}>Pozisyon</Text>
            <View style={styles.chipsRow}>
              {POSITIONS.map((p) => (
                <Chip
                  key={p}
                  text={p}
                  selected={form.position === p}
                  onPress={() => setForm((s) => ({ ...s, position: p }))}
                />
              ))}
            </View>

            <Field
              icon="football"
              placeholder="Pozisyon yaz (ör: Sol kanat)"
              value={form.position}
              onChangeText={(t: string) => setForm((s) => ({ ...s, position: t }))}
              autoCorrect={false}
              returnKeyType="next"
            />

            {/* CITY */}
            <Text style={[styles.sectionLabel, { marginTop: 14 }]}>Şehir</Text>
            <View style={styles.chipsRow}>
              {CITY_SUGGESTIONS.map((c) => (
                <Chip
                  key={c}
                  text={c}
                  selected={form.city === c}
                  onPress={() => setForm((s) => ({ ...s, city: c }))}
                />
              ))}
            </View>

            <Field
              icon="location"
              placeholder="Şehir yaz"
              value={form.city}
              onChangeText={(t: string) => setForm((s) => ({ ...s, city: t }))}
              autoCorrect={false}
              returnKeyType="next"
            />

            {/* NOTE */}
            <Text style={[styles.sectionLabel, { marginTop: 14 }]}>Not (isteğe bağlı)</Text>
            <Field
              icon="chatbox-ellipses"
              placeholder="Örn: 20:00-22:00 arası uygunum, takımımız 6 kişi…"
              value={form.note}
              onChangeText={(t: string) => setForm((s) => ({ ...s, note: t }))}
              multiline
            />

            {/* SUBMIT */}
            <Pressable
              style={[
                styles.button,
                !canSubmit && { opacity: 0.55 },
                loading && { opacity: 0.75 },
              ]}
              onPress={submit}
              disabled={!canSubmit}
            >
              {loading ? (
                <View style={styles.btnRow}>
                  <ActivityIndicator color="#052E1C" />
                  <Text style={styles.buttonText}>Paylaşılıyor...</Text>
                </View>
              ) : (
                <View style={styles.btnRow}>
                  <Ionicons name="send" size={16} color="#052E1C" />
                  <Text style={styles.buttonText}>İlanı Paylaş</Text>
                </View>
              )}
            </Pressable>

            {!canSubmit && (
              <Text style={styles.helperText}>
                İlan verebilmek için <Text style={{ color: "#A3E635" }}>pozisyon</Text> ve{" "}
                <Text style={{ color: "#A3E635" }}>şehir</Text> seçmelisin.
              </Text>
            )}
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ---------- components ---------- */

function Step({ done, label }: { done: boolean; label: string }) {
  return (
    <View style={styles.step}>
      <View style={[styles.stepDot, done && styles.stepDotOn]}>
        <Ionicons
          name={done ? "checkmark" : "ellipse"}
          size={done ? 14 : 10}
          color={done ? "#052E1C" : "rgba(255,255,255,0.35)"}
        />
      </View>
      <Text style={[styles.stepText, done && { color: "white" }]}>{label}</Text>
    </View>
  );
}

function Chip({
  text,
  selected,
  onPress,
}: {
  text: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{text}</Text>
    </Pressable>
  );
}

function Field({ icon, multiline, style, ...props }: any) {
  return (
    <View style={styles.fieldRow}>
      <View style={styles.fieldIcon}>
        <Ionicons name={icon} size={16} color="#A3E635" />
      </View>

      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor="#9CA3AF"
        style={[styles.input, multiline && styles.textArea, style]}
      />
    </View>
  );
}

/* ---------- styles ---------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#020A08" },

  container: {
    padding: 16,
    paddingBottom: 34, // ✅ klavye + scroll rahatlığı
  },

  hero: {
    borderRadius: 26,
    padding: 16,
    marginBottom: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  heroGlowA: {
    position: "absolute",
    top: -110,
    right: -90,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "rgba(163,230,53,0.16)",
  },
  heroGlowB: {
    position: "absolute",
    bottom: -120,
    left: -120,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "rgba(96,165,250,0.12)",
  },

  heroTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },

  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(163,230,53,0.12)",
    borderWidth: 1,
    borderColor: "rgba(163,230,53,0.35)",
  },

  title: { color: "white", fontSize: 24, fontWeight: "900" },
  subtitle: { color: "#9CA3AF", fontSize: 12, marginTop: 6, lineHeight: 16, fontWeight: "700" },

  heroPills: { flexDirection: "row", gap: 10, marginTop: 12, flexWrap: "wrap" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(163,230,53,0.12)",
    borderWidth: 1,
    borderColor: "rgba(163,230,53,0.28)",
  },
  pillText: { color: "white", fontWeight: "900", fontSize: 12 },

  pillMuted: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  pillMutedText: { color: "#E5E7EB", fontWeight: "900", fontSize: 12 },

  refreshBtn: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.20)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    marginLeft: "auto",
  },

  progressRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.10)",
  },
  progressLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.10)" },
  step: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotOn: { backgroundColor: "#A3E635", borderColor: "rgba(163,230,53,0.55)" },
  stepText: { color: "#9CA3AF", fontWeight: "900", fontSize: 12 },

  card: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(163,230,53,0.12)",
    borderWidth: 1,
    borderColor: "rgba(163,230,53,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { color: "white", fontWeight: "900", fontSize: 16 },
  cardSub: { color: "#9CA3AF", fontWeight: "800", fontSize: 12, marginTop: 2 },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(163,230,53,0.14)",
    borderWidth: 1,
    borderColor: "rgba(163,230,53,0.35)",
  },
  badgeText: { color: "#A3E635", fontWeight: "900", fontSize: 11 },

  sectionLabel: { color: "#9CA3AF", fontSize: 12, marginTop: 6, fontWeight: "900" },

  chipsRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },

  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    marginRight: 8,
    marginBottom: 8,
  },
  chipSelected: {
    backgroundColor: "#A3E635",
    borderColor: "rgba(163,230,53,0.70)",
  },
  chipText: { color: "#E5E7EB", fontWeight: "900", fontSize: 12 },
  chipTextSelected: { color: "#052E1C" },

  fieldRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  fieldIcon: {
    width: 44,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    marginRight: 10,
  },

  input: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    color: "white",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    fontWeight: "800",
  },
  textArea: {
    height: 110,
    paddingTop: 12,
    textAlignVertical: "top",
  },

  button: {
    marginTop: 16,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#A3E635",
    alignItems: "center",
    justifyContent: "center",
  },
  btnRow: { flexDirection: "row", alignItems: "center" },
  buttonText: { color: "#052E1C", fontWeight: "900", fontSize: 15, marginLeft: 10 },

  helperText: { marginTop: 10, color: "#9CA3AF", fontWeight: "800", fontSize: 12, lineHeight: 16 },
});
