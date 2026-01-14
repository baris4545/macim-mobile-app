import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    Alert,
    Modal,
    Pressable,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { listMatches, listPlayers } from "../../services/api";

import { Buffer } from "buffer";
import * as SecureStore from "expo-secure-store";

const CITIES = ["Tümü", "İstanbul", "Ankara", "İzmir"] as const;

type HomeTab = "featured" | "players" | "matches";

export default function Home() {
  const router = useRouter();

  const [players, setPlayers] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [city, setCity] = useState<(typeof CITIES)[number]>("Tümü");
  const [refreshing, setRefreshing] = useState(false);

  // ✅ Modal state
  const [filterOpen, setFilterOpen] = useState(false);

  // ✅ YARDIM MODAL
  const [helpOpen, setHelpOpen] = useState(false);

  // ✅ Tabs
  const [tab, setTab] = useState<HomeTab>("featured");

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

  // ✅ “bu ilan benim mi?”
  const isMine = (postUserId: any) => {
    const a = Number(myUserId);
    const b = Number(postUserId);
    if (!a || Number.isNaN(a) || !b || Number.isNaN(b)) return false;
    return a === b;
  };

  const load = async () => {
    setRefreshing(true);
    try {
      const [p, m] = await Promise.all([listPlayers(), listMatches()]);
      setPlayers(p?.posts ?? []);
      setMatches(m?.matches ?? []);
    } catch (e) {
      console.log("Home load error", e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMe();
    load();
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  const todayMatches = useMemo(
    () => matches.filter((m) => String(m.match_date) === today),
    [matches, today]
  );

  const filteredPlayers = useMemo(() => {
    if (city === "Tümü") return players;
    return players.filter((p) => p.city === city);
  }, [players, city]);

  const filteredMatches = useMemo(() => {
    if (city === "Tümü") return matches;
    return matches.filter((m) => m.city === city);
  }, [matches, city]);

  const featured = useMemo(() => {
    const p = [...filteredPlayers].slice(0, 3).map((x) => ({ ...x, _type: "player" }));
    const m = [...filteredMatches].slice(0, 3).map((x) => ({ ...x, _type: "match" }));
    const t = todayMatches.slice(0, 2).map((x) => ({ ...x, _type: "today" }));
    return [...t, ...p, ...m].slice(0, 8);
  }, [filteredPlayers, filteredMatches, todayMatches]);

  const openInAppChat = (otherUserId: number, title: string) => {
    router.push({
      pathname: "/chat",
      params: { other_user_id: String(otherUserId), title },
    });
  };

  const goPlayerDetail = (p: any) => {
    router.push({
      pathname: "/player_detail",
      params: {
        id: String(p.id),
        position: String(p.position || ""),
        city: String(p.city || ""),
        name: String(p.name || "Kullanıcı"),
        note: String(p.note || ""),
        user_id: String(p.user_id || ""),
      },
    });
  };

  const goMatchDetail = (m: any) => {
    router.push({
      pathname: "/match_detail",
      params: {
        id: String(m.id),
        city: String(m.city || ""),
        field: String(m.field || ""),
        match_date: String(m.match_date || ""),
        match_time: String(m.match_time || ""),
        note: String(m.note || ""),
        user_id: String(m.user_id || ""),
        name: String(m.name || "Kullanıcı"),
      },
    });
  };

  const ensureUserId = (userId: any) => {
    const n = Number(userId);
    if (!n || Number.isNaN(n)) {
      Alert.alert("Hata", "Bu ilan için kullanıcı bilgisi bulunamadı (user_id yok).");
      return null;
    }
    return n;
  };

  const cityLabel = city === "Tümü" ? "Tüm şehirler" : city;

  const renderTabContent = () => {
    if (tab === "featured") {
      return (
        <>
          <View style={styles.featureHead}>
            <Text style={styles.featureTitle}>Öne Çıkanlar</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable onPress={() => setHelpOpen(true)} style={styles.pillBtn}>
                <Ionicons name="help-circle-outline" size={16} color="#A3E635" />
                <Text style={styles.pillBtnText}>Yardım</Text>
              </Pressable>

              <Pressable onPress={() => setFilterOpen(true)} style={styles.featureLink}>
                <Text style={styles.featureLinkText}>{cityLabel}</Text>
                <Ionicons name="chevron-down" size={16} color="#A3E635" />
              </Pressable>
            </View>
          </View>

          {featured.length === 0 ? (
            <EmptyCard
              title="Şu an öne çıkan ilan yok"
              subtitle="Yenile veya şehir filtresini değiştir."
              cta="Filtrele"
              onPress={() => setFilterOpen(true)}
            />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 12 }}
            >
              {featured.map((it: any) => {
                const type = it._type as "today" | "player" | "match";
                const badge = type === "today" ? "Bugün" : type === "player" ? "Yeni" : "Popüler";

                const title =
                  type === "player" ? `${it.position} aranıyor` : `${it.city} • ${it.field}`;

                const sub =
                  type === "player"
                    ? `${it.city} • ${it.name || "Kullanıcı"}`
                    : `${it.match_date} • ${it.match_time}`;

                return (
                  <Pressable
                    key={`${type}-${it.id}`}
                    style={styles.featureCard}
                    onPress={() => (type === "player" ? goPlayerDetail(it) : goMatchDetail(it))}
                  >
                    <View style={styles.featureBadge}>
                      <Text style={styles.featureBadgeText}>{badge}</Text>
                    </View>

                    <Text style={styles.featureCardTitle} numberOfLines={2}>
                      {title}
                    </Text>

                    <Text style={styles.featureCardSub} numberOfLines={1}>
                      {sub}
                    </Text>

                    <View style={styles.featureBottom}>
                      <View style={styles.smallAvatar}>
                        <Text style={styles.smallAvatarText}>
                          {getInitials(it.name || "Kullanıcı")}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }} />
                      <Ionicons name="arrow-forward" size={16} color="#A3E635" />
                    </View>
                  </Pressable>
                );
              })}
              <View style={{ width: 8 }} />
            </ScrollView>
          )}

          {todayMatches.length > 0 && (
            <View style={styles.todayWrap}>
              <View style={styles.todayTop}>
                <View style={styles.todayBadgeRow}>
                  <Ionicons name="flame" size={14} color="#052E1C" />
                  <Text style={styles.todayBadgeText}>Bugün Maç Var</Text>
                </View>

                <Pressable onPress={load} style={styles.iconBtn}>
                  <Ionicons name="refresh" size={18} color="#A3E635" />
                </Pressable>
              </View>

              {todayMatches.slice(0, 4).map((m) => (
                <Pressable
                  key={m.id}
                  style={styles.todayRow}
                  onPress={() => goMatchDetail(m)}
                >
                  <Ionicons name="location" size={16} color="#A3E635" />
                  <Text style={styles.todayItem} numberOfLines={1}>
                    {m.city} • {m.field}
                  </Text>
                  <View style={styles.timePill}>
                    <Ionicons name="time" size={14} color="#D1D5DB" />
                    <Text style={styles.timeText}>{m.match_time}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </>
      );
    }

    if (tab === "players") {
      return (
        <>
          <SectionHeader
            title="Oyuncu Arayan Takımlar"
            icon="person"
            onSeeAll={() => router.push("/(tabs)/players")}
          />

          {filteredPlayers.length === 0 ? (
            <EmptyCard
              title="Şu an oyuncu ilanı yok"
              subtitle="İlk ilanı sen oluştur, takımını tamamla."
              cta="Oyuncu ilanlarına git"
              onPress={() => router.push("/(tabs)/players")}
            />
          ) : (
            filteredPlayers.map((p) => (
              <PostCard
                key={p.id}
                kind="player"
                chipLeft="Yeni"
                title={`${p.position} aranıyor`}
                leftMeta={`${p.city}`}
                rightMeta={`${p.name || "Kullanıcı"}`}
                note={p.note}
                onPress={() => goPlayerDetail(p)}
                onChat={() => {
                  const uid = ensureUserId(p.user_id);
                  if (!uid) return;
                  openInAppChat(uid, `${p.city} • ${p.position}`);
                }}
                hideChat={isMine(p.user_id ?? p.userId ?? p.owner_id ?? p.created_by ?? p.createdBy)}
              />
            ))
          )}
        </>
      );
    }

    return (
      <>
        <SectionHeader
          title="Rakip Arayan Takımlar"
          icon="football"
          onSeeAll={() => router.push("/(tabs)/matches")}
        />

        {filteredMatches.length === 0 ? (
          <EmptyCard
            title="Şu an rakip ilanı yok"
            subtitle="Bir maç ilanı aç, rakibini bul!"
            cta="Maç ilanlarına git"
            onPress={() => router.push("/(tabs)/matches")}
          />
        ) : (
          filteredMatches.map((m) => (
            <PostCard
              key={m.id}
              kind="match"
              chipLeft={String(m.match_date) === today ? "Bugün" : "Popüler"}
              title={`${m.city} • ${m.field}`}
              leftMeta={`${m.match_date} • ${m.match_time}`}
              rightMeta={m.name ? String(m.name) : "Kullanıcı"}
              note={m.note}
              onPress={() => goMatchDetail(m)}
              onChat={() => {
                const uid = ensureUserId(m.user_id);
                if (!uid) return;
                openInAppChat(uid, `${m.city} • ${m.field}`);
              }}
              hideChat={isMine(m.user_id ?? m.userId ?? m.owner_id ?? m.created_by ?? m.createdBy)}
            />
          ))
        )}
      </>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} tintColor="#A3E635" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* HERO */}
        <View style={styles.hero}>
          <View style={styles.heroGlowA} />
          <View style={styles.heroGlowB} />

          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.brand}>⚽ MAÇIM</Text>
              <Text style={styles.heroTitle}>Takımını tamamla, rakibini bul</Text>
              <Text style={styles.heroSub}>İlanları keşfet • Mesajlaş • Maç ayarla</Text>

              {/* ✅ MINI HELP BAR */}
              <Pressable onPress={() => setHelpOpen(true)} style={styles.helpBar}>
                <View style={styles.helpIcon}>
                  <Ionicons name="information-circle-outline" size={18} color="#A3E635" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.helpTitle}>Uygulama nasıl çalışır?</Text>
                  <Text style={styles.helpSub} numberOfLines={1}>
                    30 saniyede öğren → Oyuncu, Rakip, Harita, Mesaj
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#A3E635" />
              </Pressable>
            </View>

            <View style={{ gap: 10 }}>
              <Pressable onPress={() => setHelpOpen(true)} style={styles.filterBtn}>
                <Ionicons name="help" size={18} color="white" />
              </Pressable>

              <Pressable onPress={() => setFilterOpen(true)} style={styles.filterBtn}>
                <Ionicons name="options-outline" size={18} color="white" />
              </Pressable>
            </View>
          </View>

          <Pressable onPress={() => setFilterOpen(true)} style={styles.searchRow}>
            <Ionicons name="search" size={18} color="#9CA3AF" />
            <Text style={styles.searchText} numberOfLines={1}>
              {city === "Tümü" ? "Şehir seç / Filtrele…" : `${cityLabel} ilanları gösteriliyor`}
            </Text>
            <View style={styles.searchRight}>
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Canlı</Text>
              </View>
            </View>
          </Pressable>

          <View style={styles.statsRow}>
            <Stat icon="people" color="#A3E635" value={filteredPlayers.length} label="Oyuncu ilanı" />
            <Stat icon="football" color="#60A5FA" value={filteredMatches.length} label="Rakip ilanı" />
            <Stat icon="location" color="#F59E0B" value={cityLabel} label="Filtre" />
          </View>
        </View>

        {/* QUICK ACTIONS */}
        <View style={styles.quickGrid}>
          <QuickAction
            icon="map"
            title="Harita"
            subtitle="Halı saha bul"
            tone="green"
            onPress={() => router.push("/(tabs)/map")}
          />
          <QuickAction
            icon="person-add"
            title="Oyuncu Ara"
            subtitle="İlan Oluştur"
            tone="blue"
            onPress={() => router.push("/(tabs)/players")}
          />
          <QuickAction
            icon="football"
            title="Rakip Bul"
            subtitle="Maç ilanı"
            tone="amber"
            onPress={() => router.push("/(tabs)/matches")}
          />
        </View>

        {/* ✅ TOP TABS */}
        <HomeTabs tab={tab} setTab={setTab} />

        {/* ✅ TAB CONTENT */}
        {renderTabContent()}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* FILTER MODAL */}
      <Modal
        visible={filterOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setFilterOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Filtrele</Text>
            <Pressable onPress={() => setFilterOpen(false)} style={styles.sheetClose}>
              <Ionicons name="close" size={18} color="white" />
            </Pressable>
          </View>

          <Text style={styles.sheetLabel}>Şehir</Text>

          <View style={styles.sheetChips}>
            {CITIES.map((c) => {
              const active = city === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCity(c)}
                  style={[styles.sheetChip, active && styles.sheetChipActive]}
                >
                  <Text style={[styles.sheetChipText, active && styles.sheetChipTextActive]}>
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.sheetActions}>
            <Pressable style={styles.sheetGhost} onPress={() => setCity("Tümü")}>
              <Ionicons name="refresh" size={16} color="white" />
              <Text style={styles.sheetGhostText}>Sıfırla</Text>
            </Pressable>

            <Pressable style={styles.sheetPrimary} onPress={() => setFilterOpen(false)}>
              <Text style={styles.sheetPrimaryText}>Uygula</Text>
              <Ionicons name="checkmark" size={18} color="#052E1C" />
            </Pressable>
          </View>

          <View style={{ height: 8 }} />
        </View>
      </Modal>

      {/* ✅ HELP MODAL */}
      <Modal
        visible={helpOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setHelpOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setHelpOpen(false)} />

        <View style={styles.helpSheet}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>MAÇIM • Nasıl çalışır?</Text>
            <Pressable onPress={() => setHelpOpen(false)} style={styles.sheetClose}>
              <Ionicons name="close" size={18} color="white" />
            </Pressable>
          </View>

          <Text style={styles.helpDesc}>
            5 adımda uygulamayı kullan:
          </Text>

          <View style={styles.helpSteps}>
            <HelpStep
              icon="person-add-outline"
              title="Oyuncu bul / ilan aç"
              text="Oyuncu Ara sekmesinden ilan oluştur."
            />
            <HelpStep
              icon="football-outline"
              title="Rakip bul / maç ilanı"
              text="Maç Bul sekmesinde rakip ilanları oluştur, maç ayarla."
            />
            <HelpStep
              icon="map-outline"
              title="Haritada halı saha bul"
              text="Harita’dan yakındaki sahaları seç, yol tarifi al."
            />
            <HelpStep
              icon="chatbubble-ellipses-outline"
              title="Mesajlaş"
              text="İlan sahibine direkt uygulama içinden mesaj at."
            />
            <HelpStep
              icon="calendar-outline"
              title="Rezervasyon"
              text="Saha seç → rezervasyon ekranından tarih/saat seçip onayla."
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ---------------- TOP TABS ---------------- */

function HomeTabs({ tab, setTab }: { tab: HomeTab; setTab: (t: HomeTab) => void }) {
  return (
    <View style={styles.tabsWrap}>
      <TabBtn active={tab === "featured"} text="Öne Çıkanlar" icon="sparkles" onPress={() => setTab("featured")} />
      <TabBtn active={tab === "players"} text="Oyuncu" icon="people" onPress={() => setTab("players")} />
      <TabBtn active={tab === "matches"} text="Maç" icon="football" onPress={() => setTab("matches")} />
    </View>
  );
}

function TabBtn({
  active,
  text,
  icon,
  onPress,
}: {
  active: boolean;
  text: string;
  icon: any;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tabBtn, active && styles.tabBtnActive]}>
      <Ionicons name={icon} size={14} color={active ? "#052E1C" : "#D1D5DB"} />
      <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
        {text}
      </Text>
    </Pressable>
  );
}

/* ---------------- UI PIECES ---------------- */

function Stat({ icon, color, value, label }: { icon: any; color: string; value: any; label: string }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { borderColor: `${color}55` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.statNum} numberOfLines={1}>
        {String(value)}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function SectionHeader({ title, icon, onSeeAll }: { title: string; icon: any; onSeeAll: () => void }) {
  return (
    <View style={styles.sectionRow}>
      <View style={styles.sectionLeft}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={16} color="#A3E635" />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>

      <Pressable onPress={onSeeAll} style={styles.seeAll}>
        <Text style={styles.seeAllText}>Tümü</Text>
        <Ionicons name="chevron-forward" size={16} color="#A3E635" />
      </Pressable>
    </View>
  );
}

function QuickAction({
  icon,
  title,
  subtitle,
  tone,
  onPress,
}: {
  icon: any;
  title: string;
  subtitle: string;
  tone: "green" | "blue" | "amber";
  onPress: () => void;
}) {
  const toneColor = tone === "green" ? "#A3E635" : tone === "blue" ? "#60A5FA" : "#F59E0B";

  return (
    <Pressable onPress={onPress} style={styles.quickCard}>
      <View style={[styles.quickIcon, { borderColor: `${toneColor}55` }]}>
        <Ionicons name={icon} size={18} color={toneColor} />
      </View>
      <Text style={styles.quickTitle}>{title}</Text>
      <Text style={styles.quickSub}>{subtitle}</Text>
    </Pressable>
  );
}

function EmptyCard({ title, subtitle, cta, onPress }: { title: string; subtitle: string; cta: string; onPress: () => void }) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="sparkles-outline" size={18} color="#A3E635" />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{subtitle}</Text>

      <Pressable onPress={onPress} style={styles.emptyCta}>
        <Text style={styles.emptyCtaText}>{cta}</Text>
        <Ionicons name="arrow-forward" size={16} color="#052E1C" />
      </Pressable>
    </View>
  );
}

function PostCard({
  kind,
  chipLeft,
  title,
  leftMeta,
  rightMeta,
  note,
  onPress,
  onChat,
  hideChat,
}: {
  kind: "player" | "match";
  chipLeft: string;
  title: string;
  leftMeta: string;
  rightMeta: string;
  note?: string;
  onPress: () => void;
  onChat: () => void;
  hideChat?: boolean;
}) {
  const icon = kind === "player" ? "search" : "football";
  const accent = kind === "player" ? "#A3E635" : "#60A5FA";
  const initials = getInitials(rightMeta);

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.badge, { borderColor: `${accent}55` }]}>
          <Ionicons name={icon} size={14} color={accent} />
          <Text style={styles.badgeText} numberOfLines={1}>
            {title}
          </Text>
        </View>

        <View style={styles.chipMini}>
          <Text style={styles.chipMiniText}>{chipLeft}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaLeft}>
          <Ionicons name="location-outline" size={14} color="#9CA3AF" />
          <Text style={styles.metaText} numberOfLines={1}>
            {leftMeta}
          </Text>
        </View>

        <View style={styles.metaRight}>
          <View style={styles.smallAvatar}>
            <Text style={styles.smallAvatarText}>{initials}</Text>
          </View>
          <Text style={styles.metaText} numberOfLines={1}>
            {rightMeta}
          </Text>
        </View>
      </View>

      {!!note && (
        <View style={styles.noteBox}>
          <Text style={styles.note} numberOfLines={3}>
            {note}
          </Text>
        </View>
      )}

      <View style={styles.cardActions}>
        <Pressable style={styles.cardBtnGhost} onPress={onPress}>
          <Ionicons name="information-circle-outline" size={16} color="white" />
          <Text style={styles.cardBtnGhostText}>Detay</Text>
        </Pressable>

        {!hideChat && (
          <Pressable style={styles.cardBtnPrimary} onPress={onChat}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color="#052E1C" />
            <Text style={styles.cardBtnPrimaryText}>Mesaj At</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.linkRow}>
        <Text style={styles.linkText}>İlana Git</Text>
        <Ionicons name="arrow-forward" size={16} color="#A3E635" />
      </View>
    </Pressable>
  );
}

/* ✅ HELP MODAL STEP */
function HelpStep({ icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <View style={styles.helpStep}>
      <View style={styles.helpStepIcon}>
        <Ionicons name={icon} size={18} color="#A3E635" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.helpStepTitle}>{title}</Text>
        <Text style={styles.helpStepText}>{text}</Text>
      </View>
    </View>
  );
}

function getInitials(name: string) {
  const t = String(name || "").trim();
  if (!t) return "M";
  const parts = t.split(" ").filter(Boolean);
  const a = parts[0]?.[0] || "M";
  const b = parts[1]?.[0] || "";
  return (a + b).toUpperCase();
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#020A08" },
  container: { padding: 16, paddingBottom: 22 },

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
    backgroundColor: "rgba(163,230,53,0.18)",
  },
  heroGlowB: {
    position: "absolute",
    bottom: -120,
    left: -120,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "rgba(96,165,250,0.14)",
  },
  heroTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  brand: { color: "white", fontSize: 26, fontWeight: "900" },
  heroTitle: { color: "#E5E7EB", fontSize: 14, marginTop: 6, lineHeight: 18, fontWeight: "800" },
  heroSub: { color: "#9CA3AF", fontSize: 12, marginTop: 6, lineHeight: 16, fontWeight: "700" },

  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  /* ✅ NEW: Help bar */
  helpBar: {
    marginTop: 12,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(11, 18, 32, 0.70)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  helpIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  helpTitle: { color: "white", fontWeight: "900", fontSize: 13 },
  helpSub: { color: "#9CA3AF", marginTop: 3, fontSize: 12, fontWeight: "700" },

  searchRow: {
    marginTop: 14,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchText: { color: "#9CA3AF", fontWeight: "800", flex: 1, fontSize: 12 },
  searchRight: { flexDirection: "row", alignItems: "center" },

  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  liveDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: "#A3E635" },
  liveText: { color: "white", fontWeight: "900", fontSize: 12 },

  statsRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "flex-start",
    gap: 6,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statNum: { color: "white", fontWeight: "900", fontSize: 14 },
  statLabel: { color: "#9CA3AF", fontSize: 12, fontWeight: "700" },

  quickGrid: { flexDirection: "row", gap: 10, marginBottom: 14 },
  quickCard: {
    flex: 1,
    padding: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  quickIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.25)",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  quickTitle: { color: "white", fontWeight: "900", fontSize: 13 },
  quickSub: { color: "#9CA3AF", fontSize: 12, marginTop: 4, fontWeight: "700" },

  tabsWrap: {
    flexDirection: "row",
    gap: 10,
    padding: 10,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    height: 44,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 8,
  },
  tabBtnActive: { backgroundColor: "#A3E635", borderColor: "rgba(163,230,53,0.65)" },
  tabText: { color: "#D1D5DB", fontWeight: "900", fontSize: 12 },
  tabTextActive: { color: "#052E1C" },

  featureHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6, marginBottom: 10 },
  featureTitle: { color: "white", fontWeight: "900", fontSize: 18 },

  pillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  pillBtnText: { color: "white", fontWeight: "900", fontSize: 12 },

  featureLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  featureLinkText: { color: "white", fontWeight: "900", fontSize: 12 },

  featureCard: {
    width: 230,
    marginRight: 10,
    borderRadius: 22,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  featureBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(163,230,53,0.18)",
    borderWidth: 1,
    borderColor: "rgba(163,230,53,0.35)",
    marginBottom: 10,
  },
  featureBadgeText: { color: "white", fontWeight: "900", fontSize: 12 },
  featureCardTitle: { color: "white", fontWeight: "900", fontSize: 14, lineHeight: 18 },
  featureCardSub: { color: "#9CA3AF", fontWeight: "800", fontSize: 12, marginTop: 8 },
  featureBottom: { flexDirection: "row", alignItems: "center", marginTop: 12 },

  todayWrap: {
    borderRadius: 22,
    padding: 14,
    backgroundColor: "rgba(163,230,53,0.12)",
    borderWidth: 1,
    borderColor: "rgba(163,230,53,0.25)",
    marginBottom: 8,
  },
  todayTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  todayBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#A3E635",
  },
  todayBadgeText: { color: "#052E1C", fontWeight: "900", fontSize: 12 },

  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  todayRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  todayItem: { color: "white", fontWeight: "800", flex: 1, fontSize: 13 },
  timePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.25)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  timeText: { color: "#D1D5DB", fontWeight: "800", fontSize: 12 },

  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16, marginBottom: 10 },
  sectionLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 12,
    backgroundColor: "rgba(163,230,53,0.12)",
    borderWidth: 1,
    borderColor: "rgba(163,230,53,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { color: "white", fontWeight: "900", fontSize: 18, flex: 1 },
  seeAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  seeAllText: { color: "white", fontWeight: "900", fontSize: 12 },

  card: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 22,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.25)",
    borderWidth: 1,
    maxWidth: "78%",
  },
  badgeText: { color: "white", fontWeight: "900", fontSize: 13, flexShrink: 1 },

  chipMini: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  chipMiniText: { color: "#D1D5DB", fontWeight: "900", fontSize: 12 },

  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 12 },
  metaLeft: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  metaRight: { flexDirection: "row", alignItems: "center", gap: 8, maxWidth: "52%" },
  metaText: { color: "#9CA3AF", fontSize: 12, fontWeight: "800" },

  smallAvatar: {
    width: 26,
    height: 26,
    borderRadius: 10,
    backgroundColor: "rgba(163,230,53,0.14)",
    borderWidth: 1,
    borderColor: "rgba(163,230,53,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  smallAvatarText: { color: "white", fontWeight: "900", fontSize: 11 },

  noteBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  note: { color: "#D1D5DB", fontSize: 12, lineHeight: 16, fontWeight: "700" },

  cardActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  cardBtnGhost: {
    flex: 1,
    height: 44,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  cardBtnGhostText: { color: "white", fontWeight: "900", fontSize: 13 },

  cardBtnPrimary: {
    flex: 1,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#A3E635",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  cardBtnPrimaryText: { color: "#052E1C", fontWeight: "900", fontSize: 13 },

  linkRow: { marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6 },
  linkText: { color: "#A3E635", fontWeight: "900", fontSize: 12 },

  emptyCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    marginBottom: 10,
    alignItems: "center",
  },
  emptyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "rgba(163,230,53,0.12)",
    borderWidth: 1,
    borderColor: "rgba(163,230,53,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  emptyTitle: { color: "white", fontWeight: "900", fontSize: 14 },
  emptySub: { color: "#9CA3AF", fontWeight: "700", fontSize: 12, marginTop: 6, textAlign: "center", lineHeight: 16 },
  emptyCta: {
    marginTop: 12,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#A3E635",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  emptyCtaText: { color: "#052E1C", fontWeight: "900" },

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
  sheetLabel: { color: "#9CA3AF", fontWeight: "900", marginTop: 14, marginBottom: 10 },

  sheetChips: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  sheetChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  sheetChipActive: { backgroundColor: "rgba(163,230,53,0.18)", borderColor: "rgba(163,230,53,0.55)" },
  sheetChipText: { color: "#9CA3AF", fontWeight: "900" },
  sheetChipTextActive: { color: "white" },

  sheetActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  sheetGhost: {
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

  /* ✅ HELP SHEET */
  helpSheet: {
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
  helpDesc: { color: "#9CA3AF", fontWeight: "800", marginTop: 10, marginBottom: 10 },
  helpSteps: { gap: 10 },

  helpStep: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  helpStepIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  helpStepTitle: { color: "white", fontWeight: "900", fontSize: 13 },
  helpStepText: { color: "#9CA3AF", fontWeight: "700", fontSize: 12, marginTop: 4, lineHeight: 16 },

  helpActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  helpBtnGhost: {
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
  helpBtnGhostText: { color: "white", fontWeight: "900" },
  helpBtnPrimary: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#A3E635",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  helpBtnPrimaryText: { color: "#052E1C", fontWeight: "900" },
});
