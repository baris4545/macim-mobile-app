import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { deleteReservation, myReservations } from "../services/api";

type ResItem = {
  id: number;
  field_id: string;
  field_name: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  price: number;
  created_at: string;
};

export default function MyRezervation() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ResItem[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await myReservations();
      if (!data?.ok) {
        Alert.alert("Hata", data?.error || "Rezervasyonlar alınamadı");
        setItems([]);
        return;
      }
      setItems(data.reservations ?? []);
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Rezervasyonlar yüklenemedi");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const cancelReservation = (id: number) => {
    Alert.alert(
      "İptal edilsin mi?",
      "Bu rezervasyonu iptal etmek istiyor musun?",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "İptal Et",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await deleteReservation(id);
              if (res?.ok) {
                // UI'dan kaldır
                setItems((prev) => prev.filter((r) => r.id !== id));
                Alert.alert("Başarılı", "Rezervasyon iptal edildi");
              } else {
                Alert.alert("Hata", res?.error || "İptal edilemedi");
              }
            } catch (e: any) {
              Alert.alert("Hata", e?.message || "Sunucu hatası");
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
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color="white" />
        </Pressable>

        <Text style={styles.headerTitle}>Rezervasyonlarım</Text>

        <Pressable onPress={load} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={18} color="#A3E635" />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#A3E635" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          {items.length === 0 ? (
            <Text style={styles.empty}>Henüz rezervasyonun yok.</Text>
          ) : (
            items.map((r) => (
              <View key={r.id} style={styles.card}>
                <View style={styles.row}>
                  <Ionicons name="football" size={18} color="#A3E635" />
                  <Text style={styles.title} numberOfLines={1}>
                    {r.field_name}
                  </Text>
                </View>

                <Text style={styles.meta}>
                  {r.date} • {r.time} • {r.price} TL
                </Text>

                <Pressable
                  onPress={() => cancelReservation(r.id)}
                  style={styles.cancelBtn}
                >
                  <Ionicons name="close-circle" size={18} color="#ef4444" />
                  <Text style={styles.cancelText}>İptal Et</Text>
                </Pressable>
              </View>
            ))
          )}

          <View style={{ height: 24 }} />
        </ScrollView>
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
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  headerTitle: { color: "white", fontWeight: "900", fontSize: 16 },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  container: { padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  empty: { color: "#9CA3AF", marginTop: 20, textAlign: "center" },

  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: "white", fontWeight: "900", flex: 1 },
  meta: { color: "#9CA3AF", fontSize: 12, marginTop: 6 },

  cancelBtn: {
    marginTop: 12,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(239,68,68,0.12)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.30)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  cancelText: { color: "#ef4444", fontWeight: "900" },
});
