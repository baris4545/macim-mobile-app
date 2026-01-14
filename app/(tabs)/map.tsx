import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Linking,
    Platform,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import MapView, { Marker, Region } from "react-native-maps";

type Field = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

type ViewMode = "map" | "list";

function normalizeTR(s: string) {
  return (s || "")
    .toLowerCase()
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c");
}

export default function MapScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView | null>(null);

  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState<Field[]>([]);
  const [selected, setSelected] = useState<Field | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [query, setQuery] = useState("");

  const [region, setRegion] = useState<Region>({
    latitude: 41.0082,
    longitude: 28.9784,
    latitudeDelta: 0.15,
    longitudeDelta: 0.15,
  });

  // Marker’a basınca map onPress tetiklenmesin diye
  const ignoreNextMapPress = useRef(false);

  const selectedLabel = useMemo(() => {
    if (!selected) return "";
    return `${selected.lat.toFixed(5)}, ${selected.lng.toFixed(5)}`;
  }, [selected]);

  const filtered = useMemo(() => {
    const q = normalizeTR(query).trim();
    if (!q) return fields;
    return fields.filter((f) => normalizeTR(f.name).includes(q));
  }, [fields, query]);

  const openDirections = async (f: Field) => {
    const url =
      Platform.OS === "ios"
        ? `https://maps.apple.com/?ll=${f.lat},${f.lng}&q=${encodeURIComponent(f.name)}`
        : `https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lng}`;

    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert("Harita açılamadı");
      return;
    }
    await Linking.openURL(url);
  };

  const focusTo = (f: Field) => {
    mapRef.current?.animateToRegion(
      {
        latitude: f.lat,
        longitude: f.lng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      },
      450
    );
  };

  const selectField = (f: Field, goMap?: boolean) => {
    setSelected(f);
    focusTo(f);
    if (goMap) setViewMode("map");
  };

  const load = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Konum izni gerekli",
          "Haritada sahaları görebilmek için izin vermelisin."
        );
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;

      setRegion({
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.15,
        longitudeDelta: 0.15,
      });

      const queryOverpass = `
[out:json][timeout:25];
(
  node["leisure"="pitch"]["sport"="soccer"](around:8000, ${lat}, ${lng});
  way["leisure"="pitch"]["sport"="soccer"](around:8000, ${lat}, ${lng});
  relation["leisure"="pitch"]["sport"="soccer"](around:8000, ${lat}, ${lng});
);
out center;
      `.trim();

      const url =
        "https://overpass-api.de/api/interpreter?data=" +
        encodeURIComponent(queryOverpass);

      const res = await fetch(url);
      const text = await res.text();

      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        Alert.alert("Harita yoğun", "Biraz sonra tekrar dene.");
        return;
      }

      const mapped: Field[] = (data.elements || [])
        .map((el: any) => {
          const lat2 = el.lat ?? el.center?.lat ?? el.latitude;
          const lng2 = el.lon ?? el.center?.lon ?? el.longitude ?? el.lng;

          if (typeof lat2 !== "number" || typeof lng2 !== "number") return null;

          const name =
            el.tags?.name ||
            el.tags?.operator ||
            el.tags?.brand ||
            el.name ||
            "Halı Saha";

          return {
            id: String(el.id ?? el._id ?? Math.random()),
            name,
            lat: lat2,
            lng: lng2,
          };
        })
        .filter(Boolean);

      setFields(mapped);
    } catch (e) {
      console.log("MAP ERROR:", e);
      Alert.alert("Harita yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const ListItem = ({ item }: { item: Field }) => {
    return (
      <Pressable
        onPress={() => selectField(item, true)}
        style={({ pressed }) => [styles.listCard, pressed && { opacity: 0.85 }]}
      >
        <View style={styles.listTop}>
          <View style={styles.listIcon}>
            <Ionicons name="football" size={16} color="#A3E635" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.listTitle} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.listSub} numberOfLines={1}>
              {item.lat.toFixed(5)}, {item.lng.toFixed(5)}
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={18} color="#6B7280" />
        </View>

        <View style={styles.listActions}>
          <Pressable
            style={styles.listMiniBtn}
            onPress={() => {
              selectField(item, false);
              openDirections(item);
            }}
          >
            <Ionicons name="navigate" size={16} color="#D1D5DB" />
            <Text style={styles.listMiniText}>Yol</Text>
          </Pressable>

          <Pressable
            style={[styles.listMiniBtn, styles.listMiniPrimary]}
            onPress={() => {
              router.push({
                pathname: "/reservation",
                params: {
                  id: item.id,
                  name: item.name,
                  lat: String(item.lat),
                  lng: String(item.lng),
                },
              });
            }}
          >
            <Ionicons name="calendar-outline" size={16} color="#052E1C" />
            <Text style={[styles.listMiniText, { color: "#052E1C" }]}>
              Rezervasyon
            </Text>
          </Pressable>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={{ flex: 1 }}>
        {/* TOP HEADER */}
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.topTitle}>Sahalar</Text>
            <Text style={styles.topSub}>
              Yakındaki halı sahaları{" "}
              {viewMode === "map" ? "haritadan" : "listeden"} seç.
            </Text>
          </View>

          <Pressable
            onPress={() => {
              setSelected(null);
              load();
            }}
            style={styles.topIconBtn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#A3E635" />
            ) : (
              <Ionicons name="refresh" size={18} color="white" />
            )}
          </Pressable>
        </View>

        {/* SEARCH + TOGGLE */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color="#9CA3AF" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Saha ara (örn: arena, park...)"
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
              autoCorrect={false}
              returnKeyType="search"
            />
            {!!query && (
              <Pressable onPress={() => setQuery("")} style={styles.clearBtn}>
                <Ionicons name="close" size={16} color="#D1D5DB" />
              </Pressable>
            )}
          </View>

          <View style={styles.toggle}>
            <Pressable
              onPress={() => setViewMode("map")}
              style={[
                styles.toggleBtn,
                viewMode === "map" && styles.toggleBtnActive,
              ]}
            >
              <Ionicons
                name="map-outline"
                size={16}
                color={viewMode === "map" ? "#052E1C" : "white"}
              />
              <Text
                style={[
                  styles.toggleText,
                  viewMode === "map" && { color: "#052E1C" },
                ]}
              >
                Harita
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setViewMode("list")}
              style={[
                styles.toggleBtn,
                viewMode === "list" && styles.toggleBtnActive,
              ]}
            >
              <Ionicons
                name="list-outline"
                size={16}
                color={viewMode === "list" ? "#052E1C" : "white"}
              />
              <Text
                style={[
                  styles.toggleText,
                  viewMode === "list" && { color: "#052E1C" },
                ]}
              >
                Liste
              </Text>
            </Pressable>
          </View>
        </View>

        {/* CONTENT */}
        {viewMode === "list" ? (
          <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 6 }}>
            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator color="#A3E635" />
                <Text style={styles.centerText}>Sahalar yükleniyor...</Text>
              </View>
            ) : filtered.length === 0 ? (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="search-outline" size={18} color="#9CA3AF" />
                </View>
                <Text style={styles.emptyTitle}>Sonuç bulunamadı</Text>
                <Text style={styles.emptySub}>Farklı bir arama deneyebilirsin.</Text>
              </View>
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(x) => x.id}
                renderItem={({ item }) => <ListItem item={item} />}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
              />
            )}
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <MapView
              ref={mapRef}
              style={styles.map}
              region={region}
              showsUserLocation
              onPress={() => {
                if (ignoreNextMapPress.current) {
                  ignoreNextMapPress.current = false;
                  return;
                }
                setSelected(null);
              }}
            >
              {filtered.map((f) => (
                <Marker
                  key={f.id}
                  coordinate={{ latitude: f.lat, longitude: f.lng }}
                  pinColor={selected?.id === f.id ? "#A3E635" : "#2563eb"}
                  onPress={() => {
                    ignoreNextMapPress.current = true;
                    setSelected(f);
                  }}
                />
              ))}
            </MapView>

            {selected && (
              <View style={styles.sheet}>
                <View style={styles.sheetHandle} />

                <View style={styles.sheetHead}>
                  <View style={styles.sheetIcon}>
                    <Ionicons name="football" size={16} color="#A3E635" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetTitle} numberOfLines={1}>
                      {selected.name}
                    </Text>
                    <Text style={styles.sheetSub} numberOfLines={1}>
                      {selectedLabel}
                    </Text>
                  </View>

                  <Pressable onPress={() => setSelected(null)} style={styles.closeBtn}>
                    <Ionicons name="close" size={18} color="white" />
                  </Pressable>
                </View>

                <View style={styles.actionsRow}>
                  <Pressable style={styles.primaryBtn} onPress={() => openDirections(selected)}>
                    <Ionicons name="navigate" size={18} color="#052E1C" />
                    <Text style={styles.primaryText}>Yol Tarifi</Text>
                  </Pressable>

                  <Pressable
                    style={styles.secondaryBtn}
                    onPress={() =>
                      router.push({
                        pathname: "/reservation",
                        params: {
                          id: selected.id,
                          name: selected.name,
                          lat: String(selected.lat),
                          lng: String(selected.lng),
                        },
                      })
                    }
                  >
                    <Ionicons name="calendar-outline" size={18} color="white" />
                    <Text style={styles.secondaryText}>Rezervasyon</Text>
                  </Pressable>
                </View>

                <View style={styles.miniInfo}>
                  <View style={styles.miniRow}>
                    <Ionicons name="information-circle-outline" size={16} color="#9CA3AF" />
                    <Text style={styles.miniText}>
                      İpucu: Marker’a dokunarak sahayı seçebilirsin.
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#020A08" },
  map: { flex: 1 },

  topBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#020A08",
  },
  topTitle: { color: "white", fontSize: 20, fontWeight: "900" },
  topSub: { color: "#9CA3AF", marginTop: 4, fontSize: 12, fontWeight: "700" },
  topIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  searchRow: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#020A08",
  },
  searchBox: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: { flex: 1, color: "white", fontWeight: "800", fontSize: 12 },
  clearBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  toggle: {
    height: 44,
    borderRadius: 14,
    padding: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    gap: 6,
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    height: 36,
    justifyContent: "center",
  },
  toggleBtnActive: { backgroundColor: "#A3E635" },
  toggleText: { color: "white", fontWeight: "900", fontSize: 12 },

  chipsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "#020A08",
  },
  chip: {
    flex: 1,
    height: 38,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  chipPrimary: { backgroundColor: "#A3E635", borderColor: "rgba(163,230,53,0.55)" },
  chipText: { color: "#D1D5DB", fontWeight: "900", fontSize: 12 },

  listCard: {
    marginTop: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  listTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  listIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(163,230,53,0.12)",
    borderWidth: 1,
    borderColor: "rgba(163,230,53,0.28)",
  },
  listTitle: { color: "white", fontWeight: "900", fontSize: 14 },
  listSub: { color: "#9CA3AF", fontWeight: "700", fontSize: 12, marginTop: 4 },

  listActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  listMiniBtn: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  listMiniPrimary: { backgroundColor: "#A3E635", borderColor: "rgba(163,230,53,0.55)" },
  listMiniText: { color: "#D1D5DB", fontWeight: "900", fontSize: 12 },

  sheet: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: "rgba(11, 18, 32, 0.97)",
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  sheetHandle: {
    width: 52,
    height: 5,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.20)",
    alignSelf: "center",
    marginBottom: 10,
  },
  sheetHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  sheetIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(163,230,53,0.12)",
    borderWidth: 1,
    borderColor: "rgba(163,230,53,0.28)",
  },
  sheetTitle: { color: "white", fontSize: 18, fontWeight: "900" },
  sheetSub: { color: "#9CA3AF", fontSize: 12, marginTop: 4, fontWeight: "700" },

  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  actionsRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  primaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#A3E635",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryText: { color: "#052E1C", fontWeight: "900", fontSize: 14 },

  secondaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryText: { color: "white", fontWeight: "900", fontSize: 14 },

  miniInfo: {
    marginTop: 12,
    borderRadius: 16,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  miniRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  miniText: { color: "#D1D5DB", fontSize: 12, fontWeight: "700", flex: 1 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  centerText: { color: "#9CA3AF", fontWeight: "800" },

  empty: { paddingTop: 34, alignItems: "center" },
  emptyIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { color: "white", fontWeight: "900", marginTop: 12 },
  emptySub: { color: "#9CA3AF", marginTop: 6, fontSize: 12, fontWeight: "700" },
});
