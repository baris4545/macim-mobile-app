import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
    ActivityIndicator,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import { createMatch } from "../../services/api";

import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Calendar, DateData, LocaleConfig } from "react-native-calendars";

/* ✅ Takvim TR */
LocaleConfig.locales["tr"] = {
  monthNames: [
    "Ocak",
    "Şubat",
    "Mart",
    "Nisan",
    "Mayıs",
    "Haziran",
    "Temmuz",
    "Ağustos",
    "Eylül",
    "Ekim",
    "Kasım",
    "Aralık",
  ],
  monthNamesShort: ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"],
  dayNames: ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"],
  dayNamesShort: ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"],
  today: "Bugün",
};
LocaleConfig.defaultLocale = "tr";

/* ---------- helpers ---------- */
const pad2 = (n: number) => String(n).padStart(2, "0");
const todayISO = () => new Date().toISOString().split("T")[0];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function timeToMinutes(hhmm: string) {
  const [h, m] = (hhmm || "").split(":").map((x) => Number(x));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

export default function Matches() {
  const router = useRouter();

  const [form, setForm] = useState({
    city: "",
    field: "",
    match_date: "",
    match_time: "",
    note: "",
  });
  const [loading, setLoading] = useState(false);

  // ✅ UI state
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [timeDraft, setTimeDraft] = useState<Date>(new Date());

  const canSubmit = useMemo(() => {
    return (
      form.city.trim().length > 0 &&
      form.field.trim().length > 0 &&
      form.match_date.trim().length > 0 &&
      form.match_time.trim().length > 0 &&
      !loading
    );
  }, [form, loading]);

  const submit = async () => {
    const { city, field, match_date, match_time } = form;

    if (!city.trim() || !field.trim() || !match_date.trim() || !match_time.trim()) {
      alert("Şehir, saha, tarih ve saat zorunlu");
      return;
    }

    // ✅ ekstra güvenlik: geçmiş tarih engeli
    const tISO = todayISO();
    if (match_date < tISO) {
      alert("Geçmiş bir tarih seçemezsin.");
      return;
    }

    // ✅ aynı günse geçmiş saat engeli
    if (match_date === tISO) {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const chosenMin = timeToMinutes(match_time);
      if (chosenMin != null && chosenMin < nowMin) {
        alert("Bugün için geçmiş bir saat seçemezsin.");
        return;
      }
    }

    setLoading(true);
    try {
      await createMatch({
        city: city.trim(),
        field: field.trim(),
        match_date: match_date.trim(),
        match_time: match_time.trim(),
        note: form.note.trim(),
      });

      setForm({ city: "", field: "", match_date: "", match_time: "", note: "" });
      setTimeDraft(new Date());
      alert("✅ Maç ilanı oluşturuldu");
      // router.back(); // istersen aç
    } catch (e) {
      console.log("Create match error:", e);
      alert("İlan oluşturulamadı");
    } finally {
      setLoading(false);
    }
  };

  const openCalendar = () => {
    Keyboard.dismiss();
    setCalendarOpen(true);
  };

  const openTimePicker = () => {
    Keyboard.dismiss();
    if (!form.match_date.trim()) {
      alert("Önce tarih seç.");
      return;
    }

    // ✅ Draft başlangıcı: seçili saat varsa onu aç, yoksa 1 saat sonrası
    const now = new Date();
    let base = new Date(now);
    base.setMinutes(0, 0, 0);
    base.setHours(base.getHours() + 1);

    if (form.match_time) {
      const [h, m] = form.match_time.split(":").map((x) => Number(x));
      if (!Number.isNaN(h) && !Number.isNaN(m)) {
        base = new Date(now);
        base.setHours(h, m, 0, 0);
      }
    }

    setTimeDraft(base);
    setTimeOpen(true);
  };

  const onPickTime = (event: DateTimePickerEvent, date?: Date) => {
    // Android: cancel -> event.type === "dismissed"
    if (Platform.OS === "android") {
      setTimeOpen(false);
      if (event.type === "dismissed" || !date) return;
    }

    const picked = date || timeDraft;
    const hhmm = `${pad2(picked.getHours())}:${pad2(picked.getMinutes())}`;

    // ✅ bugünse geçmiş saat engeli (seçim anında)
    const tISO = todayISO();
    if (form.match_date === tISO) {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const chosenMin = picked.getHours() * 60 + picked.getMinutes();
      if (chosenMin < nowMin) {
        alert("Bugün için geçmiş bir saat seçemezsin.");
        return;
      }
    }

    setForm((s) => ({ ...s, match_time: hhmm }));
    setTimeDraft(picked);
  };

  const confirmIOS = () => {
    const picked = timeDraft;
    const hhmm = `${pad2(picked.getHours())}:${pad2(picked.getMinutes())}`;

    const tISO = todayISO();
    if (form.match_date === tISO) {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const chosenMin = picked.getHours() * 60 + picked.getMinutes();
      if (chosenMin < nowMin) {
        alert("Bugün için geçmiş bir saat seçemezsin.");
        return;
      }
    }

    setForm((s) => ({ ...s, match_time: hhmm }));
    setTimeOpen(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* HERO */}
            <View style={styles.hero}>
              <View style={styles.heroGlow} />
              <View style={styles.heroRow}>
                <View style={styles.heroIcon}>
                  <Ionicons name="football" size={18} color="#A3E635" />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>Maç & Rakip Bul</Text>
                  <Text style={styles.subtitle}>
                    Rakip bulmak için maç ilanı oluştur, takımlar sana ulaşsın.
                  </Text>
                </View>

                <Pressable onPress={() => router.back()} style={styles.iconBtn}>
                  <Ionicons name="close" size={18} color="white" />
                </Pressable>
              </View>

              <View style={styles.pills}>
                <Pill icon="flash-outline" text="Hızlı ilan" />
                <Pill icon="shield-checkmark-outline" text="Uygulama içi mesaj" />
              </View>
            </View>

            {/* FORM CARD */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>İlan Oluştur</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Yeni</Text>
                </View>
              </View>

              <Field
                icon="location"
                placeholder="Şehir (örn: İstanbul)"
                value={form.city}
                onChangeText={(t: string) => setForm({ ...form, city: t })}
                autoCorrect={false}
              />

              <Field
                icon="map"
                placeholder="Halı saha adı (örn: Kadıköy Arena)"
                value={form.field}
                onChangeText={(t: string) => setForm({ ...form, field: t })}
                autoCorrect={false}
              />

              {/* ✅ Tarih / Saat artık elle yazılamaz */}
              <View style={styles.twoCol}>
                <PickerField
                  icon="calendar"
                  label={form.match_date ? form.match_date : "Tarih seç"}
                  onPress={openCalendar}
                  style={{ flex: 1 }}
                />
                <PickerField
                  icon="time"
                  label={form.match_time ? form.match_time : "Saat seç"}
                  onPress={openTimePicker}
                  style={{ flex: 1 }}
                />
              </View>

              <Field
                icon="chatbox-ellipses"
                placeholder="Not (isteğe bağlı)"
                value={form.note}
                onChangeText={(t: string) => setForm({ ...form, note: t })}
                multiline
                style={[styles.input, styles.textArea]}
              />

              <Pressable style={[styles.button, !canSubmit && { opacity: 0.55 }]} onPress={submit} disabled={!canSubmit}>
                {loading ? (
                  <View style={styles.btnRow}>
                    <ActivityIndicator color="#052E1C" />
                    <Text style={styles.buttonText}>Paylaşılıyor...</Text>
                  </View>
                ) : (
                  <View style={styles.btnRow}>
                    <Ionicons name="send" size={16} color="#052E1C" />
                    <Text style={styles.buttonText}>İlan Oluştur</Text>
                  </View>
                )}
              </Pressable>

                        </View>

            <View style={{ height: 24 }} />
          </ScrollView>

          {/* ✅ Takvim Modal */}
          <Modal visible={calendarOpen} transparent animationType="fade" onRequestClose={() => setCalendarOpen(false)}>
            <Pressable style={styles.modalOverlay} onPress={() => setCalendarOpen(false)} />
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />

              <View style={styles.sheetHead}>
                <Text style={styles.sheetTitle}>Tarih Seç</Text>
                <Pressable onPress={() => setCalendarOpen(false)} style={styles.sheetClose}>
                  <Ionicons name="close" size={18} color="white" />
                </Pressable>
              </View>

              <View style={styles.calendarWrap}>
                <Calendar
                  minDate={todayISO()} // ✅ bugünden öncesi seçilemez
                  onDayPress={(day: DateData) => {
                    setForm((s) => ({ ...s, match_date: day.dateString, match_time: "" }));
                    setCalendarOpen(false);
                  }}
                  markedDates={{
                    ...(form.match_date
                      ? { [form.match_date]: { selected: true, selectedColor: "#A3E635" } }
                      : {}),
                  }}
                  theme={{
                    backgroundColor: "transparent",
                    calendarBackground: "transparent",
                    dayTextColor: "#E5E7EB",
                    monthTextColor: "white",
                    textSectionTitleColor: "#9CA3AF",
                    selectedDayTextColor: "#052E1C",
                    todayTextColor: "#A3E635",
                    arrowColor: "#A3E635",
                  }}
                />
              </View>

              <View style={{ height: 8 }} />
            </View>
          </Modal>

          {/* ✅ Saat Picker */}
          {timeOpen && Platform.OS === "android" && (
            <DateTimePicker
              value={timeDraft}
              mode="time"
              is24Hour
              minuteInterval={5}
              onChange={onPickTime}
            />
          )}

          {/* iOS: sheet içinde */}
          <Modal visible={timeOpen && Platform.OS === "ios"} transparent animationType="fade" onRequestClose={() => setTimeOpen(false)}>
            <Pressable style={styles.modalOverlay} onPress={() => setTimeOpen(false)} />
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />

              <View style={styles.sheetHead}>
                <Text style={styles.sheetTitle}>Saat Seç</Text>
                <Pressable onPress={() => setTimeOpen(false)} style={styles.sheetClose}>
                  <Ionicons name="close" size={18} color="white" />
                </Pressable>
              </View>

              <View style={{ paddingVertical: 10 }}>
                <DateTimePicker
                  value={timeDraft}
                  mode="time"
                  display="spinner"
                  is24Hour
                  minuteInterval={5}
                  onChange={(e, d) => {
                    if (d) setTimeDraft(d);
                  }}
                />
              </View>

              <View style={styles.sheetActions}>
                <Pressable style={styles.sheetGhost} onPress={() => setTimeOpen(false)}>
                  <Text style={styles.sheetGhostText}>Vazgeç</Text>
                </Pressable>

                <Pressable style={styles.sheetPrimary} onPress={confirmIOS}>
                  <Text style={styles.sheetPrimaryText}>Uygula</Text>
                  <Ionicons name="checkmark" size={18} color="#052E1C" />
                </Pressable>
              </View>

              <View style={{ height: 8 }} />
            </View>
          </Modal>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

/* ---------- Small UI ---------- */

function Field({ icon, style, multiline, ...props }: any) {
  return (
    <View style={[styles.fieldRow, style]}>
      <View style={styles.fieldIcon}>
        <Ionicons name={icon} size={16} color="#A3E635" />
      </View>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor="#9CA3AF"
        style={[styles.input, multiline && styles.textArea]}
      />
    </View>
  );
}

function PickerField({
  icon,
  label,
  onPress,
  style,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  style?: any;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.pickerRow, style]}>
      <View style={styles.fieldIcon}>
        <Ionicons name={icon} size={16} color="#A3E635" />
      </View>

      <View style={styles.pickerBody}>
        <Text style={[styles.pickerText, !label || label.includes("seç") ? { color: "#9CA3AF" } : { color: "white" }]} numberOfLines={1}>
          {label}
        </Text>
      </View>

      <View style={styles.pickerRight}>
        <Ionicons name="chevron-down" size={16} color="#A3E635" />
      </View>
    </Pressable>
  );
}

function Pill({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.pill}>
      <Ionicons name={icon} size={14} color="#D1D5DB" />
      <Text style={styles.pillText}>{text}</Text>
    </View>
  );
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#020A08" },
  container: { flexGrow: 1, padding: 16 },

  hero: {
    borderRadius: 24,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
    marginBottom: 14,
  },
  heroGlow: {
    position: "absolute",
    top: -90,
    right: -90,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(163,230,53,0.16)",
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(163,230,53,0.12)",
    borderWidth: 1,
    borderColor: "rgba(163,230,53,0.28)",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  title: { color: "white", fontSize: 22, fontWeight: "900" },
  subtitle: { color: "#9CA3AF", fontSize: 13, marginTop: 4, lineHeight: 18 },

  pills: { flexDirection: "row", gap: 10, marginTop: 12 },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  pillText: { color: "#D1D5DB", fontWeight: "800", fontSize: 12 },

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
  cardTitle: { color: "white", fontWeight: "900", fontSize: 16 },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(163,230,53,0.14)",
    borderWidth: 1,
    borderColor: "rgba(163,230,53,0.35)",
  },
  badgeText: { color: "#A3E635", fontWeight: "900", fontSize: 11 },

  fieldRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  fieldIcon: {
    width: 42,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
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
  },

  twoCol: { flexDirection: "row", gap: 10, marginTop: 10 },

  textArea: { height: 90, textAlignVertical: "top", paddingTop: 12 },

  /* ✅ picker field */
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 46,
    borderRadius: 14,
    paddingRight: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
    marginTop: 10,
  },
  pickerBody: { flex: 1, justifyContent: "center" },
  pickerText: { fontWeight: "900", fontSize: 12 },
  pickerRight: {
    width: 26,
    alignItems: "center",
    justifyContent: "center",
  },

  button: {
    marginTop: 16,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#A3E635",
    alignItems: "center",
    justifyContent: "center",
  },
  btnRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  buttonText: { color: "#052E1C", fontWeight: "900", fontSize: 15 },

  hint: {
    marginTop: 10,
    color: "#9CA3AF",
    fontSize: 12,
    lineHeight: 16,
  },

  /* ✅ Modal Sheet */
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "rgba(11,18,32,0.98)",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 54,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginBottom: 12,
  },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { color: "white", fontWeight: "900", fontSize: 18 },
  sheetClose: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  calendarWrap: {
    marginTop: 10,
    borderRadius: 18,
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  sheetActions: { flexDirection: "row", gap: 10, marginTop: 10 },
  sheetGhost: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetGhostText: { color: "white", fontWeight: "900" },
  sheetPrimary: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#A3E635",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  sheetPrimaryText: { color: "#052E1C", fontWeight: "900" },
});
