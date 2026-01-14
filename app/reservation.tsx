import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { createReservation, getAvailability } from "../services/api";

/* ---------- helpers ---------- */
const pad2 = (n: number) => String(n).padStart(2, "0");
const dateToISO = (d: Date) => d.toISOString().slice(0, 10);
const todayISO = () => new Date().toISOString().slice(0, 10);

function buildSlots(openHour: number, closeHour: number) {
  // closeHour=24 ise 23:00'a kadar slot üret (12..23)
  const end = Math.min(23, closeHour - 1);
  const slots: string[] = [];
  for (let h = openHour; h <= end; h++) slots.push(`${pad2(h)}:00`);
  return slots;
}

export default function ReservationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; name?: string }>();

  const fieldIdStr = String(params.id || "");
  const fieldId = fieldIdStr ? Number(fieldIdStr) : null;

  const fieldName = (() => {
    try {
      return decodeURIComponent(String(params.name || "Halı Saha"));
    } catch {
      return String(params.name || "Halı Saha");
    }
  })();

  const PRICE = 1200;

  const [date, setDate] = useState<Date | null>(null);
  const [timeHHMM, setTimeHHMM] = useState<string>("");

  const [showDate, setShowDate] = useState(false);

  // ✅ availability state
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slots, setSlots] = useState<string[]>([]);
  const [taken, setTaken] = useState<Set<string>>(new Set());

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const canSubmit = !!fieldId && !!date && !!timeHHMM && !slotsLoading;

  const loadAvailability = async (pickedDateISO: string) => {
    if (!fieldId) return;

    setSlotsLoading(true);
    try {
      const r = await getAvailability(String(fieldId), pickedDateISO);

      // beklenen format: {ok:true, open_hour, close_hour, taken:[...], price}
      const openHour = Number(r?.open_hour ?? 12);
      const closeHour = Number(r?.close_hour ?? 24);
      const t = Array.isArray(r?.taken) ? r.taken : [];

      setSlots(buildSlots(openHour, closeHour));
      setTaken(new Set(t.map((x: any) => String(x).slice(0, 5))));
    } catch (e: any) {
      // availability endpoint yoksa vs.
      console.log("availability error:", e?.message || e);
      setSlots(buildSlots(12, 24));
      setTaken(new Set());
    } finally {
      setSlotsLoading(false);
    }
  };

  const onPickDate = async (_event: any, selected?: Date) => {
    if (Platform.OS !== "ios") setShowDate(false);
    // @ts-ignore
    if (_event?.type === "dismissed") return;

    if (!selected) return;

    const iso = dateToISO(selected);

    // geçmiş engeli (extra güvenlik)
    if (iso < todayISO()) {
      Alert.alert("Geçersiz", "Geçmiş bir tarih seçemezsin.");
      return;
    }

    setDate(selected);
    setTimeHHMM(""); // tarih değişince saat sıfırla
    await loadAvailability(iso);

    if (Platform.OS === "ios") setShowDate(false);
  };

  const submit = async () => {
    if (!fieldId) return Alert.alert("Hata", "Saha bilgisi bulunamadı (id).");
    if (!date || !timeHHMM) return Alert.alert("Eksik bilgi", "Tarih ve saat seçmelisin");

    const dateStr = dateToISO(date);

    // seçilen slot doluysa engelle
    if (taken.has(timeHHMM)) {
      Alert.alert("Dolu", "Bu saat dolu. Lütfen başka saat seç.");
      return;
    }

    const payload = {
      field_id: fieldId,
      field_name: fieldName,
      date: dateStr,
      time: timeHHMM,
      price: PRICE,
    };

    try {
      const r = await createReservation(payload);
      const ok = r?.ok === true || r?.success === true;

      if (!ok) {
        const msg =
          r?.error === "dolu"
            ? "Bu tarih ve saat dolu. Lütfen başka saat seç."
            : String(r?.error || r?.message || "Rezervasyon yapılamadı");
        Alert.alert("Hata", msg);
        return;
      }

      Alert.alert("✅ Başarılı", "Rezervasyon alındı", [
        { text: "Tamam", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("Hata", String(e?.message || "Rezervasyon yapılamadı"));
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* HEADER */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color="white" />
        </Pressable>
        <Text style={styles.headerTitle}>Rezervasyon</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* HERO */}
        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <Ionicons name="football" size={18} color="#A3E635" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.fieldName} numberOfLines={1}>
                {fieldName}
              </Text>
              <Text style={styles.heroSub}>Tarih seç, müsait saatlerden birini işaretle.</Text>
            </View>
          </View>

          <View style={styles.pricePill}>
            <Ionicons name="cash-outline" size={16} color="#052E1C" />
            <Text style={styles.priceText}>{PRICE} TL / Saat</Text>
          </View>
        </View>

        {/* CARD */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Seçimler</Text>

          {/* DATE */}
          <Pressable style={styles.selectRow} onPress={() => setShowDate(true)}>
            <View style={styles.leftIcon}>
              <Ionicons name="calendar-outline" size={18} color="#A3E635" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.selectLabel}>Tarih</Text>
              <Text style={[styles.selectValue, !date && styles.muted]}>
                {date ? date.toLocaleDateString() : "Tarih seç"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.45)" />
          </Pressable>

          {/* TIME GRID */}
          <View style={{ marginTop: 14 }}>
            <View style={styles.timeHead}>
              <Text style={styles.timeTitle}>Saat Seç</Text>

              {slotsLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#A3E635" />
                  <Text style={styles.loadingText}>Müsaitlik kontrol ediliyor…</Text>
                </View>
              ) : (
                <Text style={styles.timeSub}>
                  {date ? "Müsait saatler aşağıda" : "Önce tarih seç"}
                </Text>
              )}
            </View>

            <View style={styles.grid}>
              {slots.map((s) => {
                const isTaken = taken.has(s);
                const selected = timeHHMM === s;

                return (
                  <Pressable
                    key={s}
                    disabled={!date || slotsLoading || isTaken}
                    onPress={() => setTimeHHMM(s)}
                    style={[
                      styles.slot,
                      isTaken && styles.slotTaken,
                      selected && styles.slotSelected,
                      (!date || slotsLoading) && { opacity: 0.6 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.slotText,
                        isTaken && { color: "rgba(255,255,255,0.45)" },
                        selected && { color: "#052E1C" },
                      ]}
                    >
                      {s}
                    </Text>
                    {isTaken ? (
                      <Ionicons name="lock-closed" size={14} color="rgba(255,255,255,0.45)" />
                    ) : selected ? (
                      <Ionicons name="checkmark" size={16} color="#052E1C" />
                    ) : (
                      <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.35)" />
                    )}
                  </Pressable>
                );
              })}
            </View>

            {!!date && taken.size > 0 && (
              <View style={styles.hintRow}>
                <Ionicons name="information-circle-outline" size={16} color="rgba(255,255,255,0.55)" />
                <Text style={styles.hintText}>Kilitli saatler doludur.</Text>
              </View>
            )}
          </View>

          {/* SUBMIT */}
          <Pressable
            style={[styles.primaryBtn, !canSubmit && { opacity: 0.55 }]}
            onPress={submit}
            disabled={!canSubmit}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color="#052E1C" />
            <Text style={styles.primaryText}>Rezervasyonu Onayla</Text>
          </Pressable>
        </View>

        <View style={{ height: 18 }} />
      </ScrollView>

      {/* DATE PICKER */}
      {showDate && (
        <DateTimePicker
          value={date ?? today}
          mode="date"
          minimumDate={today}
          display={Platform.OS === "ios" ? "inline" : "calendar"}
          onChange={onPickDate}
        />
      )}
    </SafeAreaView>
  );
}

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

  container: { padding: 16, paddingBottom: 24 },

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
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(163,230,53,0.16)",
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(163,230,53,0.12)",
    borderWidth: 1,
    borderColor: "rgba(163,230,53,0.28)",
  },
  fieldName: { color: "white", fontSize: 18, fontWeight: "900" },
  heroSub: { color: "#9CA3AF", marginTop: 6, fontSize: 12, fontWeight: "700" },

  pricePill: {
    marginTop: 14,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#A3E635",
  },
  priceText: { color: "#052E1C", fontWeight: "900", fontSize: 12 },

  card: {
    marginTop: 14,
    borderRadius: 22,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  sectionTitle: { color: "white", fontWeight: "900", fontSize: 16, marginBottom: 10 },

  selectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  leftIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(163,230,53,0.12)",
    borderWidth: 1,
    borderColor: "rgba(163,230,53,0.28)",
  },
  selectLabel: { color: "#9CA3AF", fontWeight: "800", fontSize: 11 },
  selectValue: { color: "white", fontWeight: "900", fontSize: 14, marginTop: 4 },
  muted: { color: "rgba(255,255,255,0.55)" },

  timeHead: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  timeTitle: { color: "white", fontWeight: "900", fontSize: 14 },
  timeSub: { color: "#9CA3AF", fontWeight: "800", fontSize: 11 },

  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  loadingText: { color: "#9CA3AF", fontWeight: "800", fontSize: 11 },

  grid: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  slot: {
    width: "31%",
    minWidth: 100,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  slotText: { color: "white", fontWeight: "900", fontSize: 12 },

  slotTaken: {
    borderColor: "rgba(239,68,68,0.25)",
    backgroundColor: "rgba(239,68,68,0.08)",
  },
  slotSelected: {
    backgroundColor: "#A3E635",
    borderColor: "rgba(163,230,53,0.55)",
  },

  hintRow: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  hintText: { color: "rgba(255,255,255,0.65)", fontWeight: "800", fontSize: 12 },

  primaryBtn: {
    marginTop: 14,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#A3E635",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  primaryText: { color: "#052E1C", fontWeight: "900", fontSize: 16 },
});
