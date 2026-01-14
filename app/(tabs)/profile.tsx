import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  deleteMyMatchPost,
  deleteMyPlayerPost,
  getMe,
  myMatchPosts,
  myPlayerPosts,
  updateMe,
  updateMyMatchPost,
  updateMyPlayerPost,
} from "../../services/api";

export default function Profile() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState({
    name: "",
    position: "",
    city: "",
    age: "",
  });

  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);

  const [myPlayers, setMyPlayers] = useState<any[]>([]);
  const [myMatches, setMyMatches] = useState<any[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editType, setEditType] = useState<"player" | "match" | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editSaving, setEditSaving] = useState(false);

  const initials = useMemo(() => {
    const n = (user?.name || "").trim();
    if (!n) return "M";
    const parts = n.split(" ").filter(Boolean);
    const a = parts[0]?.[0] || "M";
    const b = parts[1]?.[0] || "";
    return (a + b).toUpperCase();
  }, [user?.name]);

  const stats = useMemo(() => {
    const p = myPlayers?.length ?? 0;
    const m = myMatches?.length ?? 0;
    return { players: p, matches: m, total: p + m };
  }, [myPlayers, myMatches]);

  const fillFromMe = (meUser: any) => {
    setUser(meUser);
    setAvatar(meUser?.avatar ?? null);
    setProfile({
      name: meUser?.name ?? "",
      position: meUser?.position ?? "",
      city: meUser?.city ?? "",
      age: meUser?.age != null ? String(meUser.age) : "",
    });
  };

  const goLogin = async () => {
    await SecureStore.deleteItemAsync("token");
    router.replace("/(auth)/login");
  };

  const loadMeOnly = async () => {
    const me = await getMe();
    if (me?.ok !== true || !me?.user) {
      await goLogin();
      return null;
    }
    fillFromMe(me.user);
    return me.user;
  };

  const loadMyPosts = async () => {
    setPostsLoading(true);
    try {
      const [p, m] = await Promise.all([myPlayerPosts(), myMatchPosts()]);
      setMyPlayers(p?.posts ?? []);
      setMyMatches(m?.matches ?? []);
    } catch (e) {
      console.log("my posts load error:", e);
      setMyPlayers([]);
      setMyMatches([]);
    } finally {
      setPostsLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync("token");
      if (!token) {
        router.replace("/(auth)/login");
        return;
      }

      const meUser = await loadMeOnly();
      if (!meUser) return;

      await loadMyPosts();
    } catch (e) {
      console.log("Profile load error:", e);
      Alert.alert("Hata", "Profil yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const save = async () => {
    if (saving) return;
    setSaving(true);

    try {
      const ageStr = (profile.age ?? "").trim();
      const ageNum = ageStr.length > 0 ? Number(ageStr) : null;

      const payload = {
        name: (profile.name ?? "").trim(),
        position: (profile.position ?? "").trim(),
        city: (profile.city ?? "").trim(),
        age: ageNum != null && !Number.isNaN(ageNum) ? ageNum : null,
      };

      const r = await updateMe(payload);
      if (r?.ok !== true) {
        Alert.alert("Hata", r?.error ? String(r.error) : "Kaydedilemedi");
        return;
      }

      await loadMeOnly();
      Alert.alert("Başarılı", "✅ Profil güncellendi");
    } catch (e: any) {
      console.log("Profile save error:", e);
      Alert.alert("Hata", "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync("token");
    router.replace("/(auth)/login");
  };

  /* ===================== AVATAR ===================== */

  const pickAvatar = async () => {
    if (avatarSaving) return;

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("İzin", "Fotoğraf seçmek için galeri izni gerekli.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.base64) {
      Alert.alert("Hata", "Fotoğraf okunamadı (base64 yok).");
      return;
    }

    const mime = asset.mimeType || "image/jpeg";
    const dataUrl = `data:${mime};base64,${asset.base64}`;

    setAvatar(dataUrl);

    setAvatarSaving(true);
    try {
      await updateMe({ avatar: dataUrl });
      await loadMeOnly();
    } catch (e) {
      console.log(e);
      Alert.alert("Hata", "Profil fotoğrafı kaydedilemedi");
    } finally {
      setAvatarSaving(false);
    }
  };

  const removeAvatar = () => {
    Alert.alert("Profil Fotoğrafı", "Fotoğrafı kaldırmak istiyor musun?", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Kaldır",
        style: "destructive",
        onPress: async () => {
          setAvatar(null);
          try {
            await updateMe({ avatar: "" });
            await loadMeOnly();
          } catch (e) {
            console.log(e);
            Alert.alert("Hata", "Kaldırılamadı");
          }
        },
      },
    ]);
  };

  /* ===================== EDIT / DELETE ===================== */

  const openEditPlayer = (p: any) => {
    setEditType("player");
    setEditId(Number(p.id));
    setEditForm({
      position: p.position ?? "",
      city: p.city ?? "",
      note: p.note ?? "",
    });
    setEditOpen(true);
  };

  const openEditMatch = (m: any) => {
    setEditType("match");
    setEditId(Number(m.id));
    setEditForm({
      city: m.city ?? "",
      field: m.field ?? "",
      match_date: m.match_date ?? "",
      match_time: m.match_time ?? "",
      note: m.note ?? "",
    });
    setEditOpen(true);
  };

  const confirmDeletePlayer = (id: number) => {
    Alert.alert("İlanı Sil", "Bu oyuncu ilanını silmek istiyor musun?", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteMyPlayerPost(id);
            await loadMyPosts();
          } catch (e) {
            console.log(e);
            Alert.alert("Hata", "İlan silinemedi");
          }
        },
      },
    ]);
  };

  const confirmDeleteMatch = (id: number) => {
    Alert.alert("İlanı Sil", "Bu maç ilanını silmek istiyor musun?", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteMyMatchPost(id);
            await loadMyPosts();
          } catch (e) {
            console.log(e);
            Alert.alert("Hata", "İlan silinemedi");
          }
        },
      },
    ]);
  };

  const saveEdit = async () => {
    if (!editType || !editId) return;
    if (editSaving) return;

    setEditSaving(true);
    try {
      if (editType === "player") {
        const payload = {
          position: String(editForm.position ?? "").trim(),
          city: String(editForm.city ?? "").trim(),
          note: String(editForm.note ?? "").trim(),
        };
        if (!payload.position || !payload.city) {
          Alert.alert("Eksik", "Pozisyon ve şehir zorunludur.");
          return;
        }
        await updateMyPlayerPost(editId, payload);
      } else {
        const payload = {
          city: String(editForm.city ?? "").trim(),
          field: String(editForm.field ?? "").trim(),
          match_date: String(editForm.match_date ?? "").trim(),
          match_time: String(editForm.match_time ?? "").trim(),
          note: String(editForm.note ?? "").trim(),
        };
        if (!payload.city || !payload.field || !payload.match_date || !payload.match_time) {
          Alert.alert("Eksik", "Şehir, saha, tarih ve saat zorunludur.");
          return;
        }
        await updateMyMatchPost(editId, payload);
      }

      setEditOpen(false);
      await loadMyPosts();
      Alert.alert("Başarılı", "✅ İlan güncellendi");
    } catch (e) {
      console.log(e);
      Alert.alert("Hata", "İlan güncellenemedi");
    } finally {
      setEditSaving(false);
    }
  };


  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#A3E635" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        {/* HERO */}
        <View style={styles.hero}>
          <View style={styles.heroGlowA} />
          <View style={styles.heroGlowB} />

          <View style={styles.heroTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Profil</Text>
              <Text style={styles.heroSub}>Bilgilerini güncelle, ilanlarını yönet.</Text>
            </View>

            <Pressable onPress={logout} style={styles.iconBtn}>
              <Ionicons name="log-out-outline" size={18} color="#ef4444" />
            </Pressable>
          </View>

          <View style={styles.heroRow}>
            <Pressable
              onPress={pickAvatar}
              onLongPress={removeAvatar}
              style={({ pressed }) => [styles.avatarWrap, pressed && { transform: [{ scale: 0.99 }], opacity: 0.95 }]}
            >
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              )}

              <View style={styles.cameraBadge}>
                {avatarSaving ? <ActivityIndicator color="#052E1C" /> : <Ionicons name="camera" size={14} color="#052E1C" />}
              </View>
            </Pressable>

            <View style={{ flex: 1 }}>
              <Text style={styles.heroName}>{user?.name || "İsimsiz Kullanıcı"}</Text>
              <Text style={styles.heroEmail}>{user?.email || ""}</Text>

              <View style={styles.chipsRow}>
                <Chip icon="location-outline" text={user?.city || "Şehir yok"} />
                <Chip icon="briefcase-outline" text={user?.position || "Pozisyon yok"} />
                {user?.age ? <Chip icon="sparkles-outline" text={`${user.age} yaş`} /> : null}
              </View>
            </View>
          </View>

          <View style={styles.statsRow}>
            <StatPill icon="people" label="Oyuncu" value={stats.players} />
            <StatPill icon="football" label="Maç" value={stats.matches} />
            <StatPill icon="albums" label="Toplam" value={stats.total} />
          </View>

          <Text style={styles.tipText}>
            Fotoğraf değiştirmek için dokun. Kaldırmak için uzun bas.
          </Text>
        </View>

        {/* PROFIL FORM */}
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Profil Bilgileri</Text>
          </View>

          <Field label="İsim">
            <Input
              value={profile.name}
              onChangeText={(v: string) => setProfile({ ...profile, name: v })}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </Field>

          <Field label="Pozisyon">
            <Input
              value={profile.position}
              onChangeText={(v: string) => setProfile({ ...profile, position: v })}
              returnKeyType="next"
            />
          </Field>

          <Field label="Şehir">
            <Input
              value={profile.city}
              onChangeText={(v: string) => setProfile({ ...profile, city: v })}
              returnKeyType="next"
            />
          </Field>

          <Field label="Yaş">
            <Input
              value={profile.age}
              keyboardType="number-pad"
              onChangeText={(v: string) => setProfile({ ...profile, age: v })}
              returnKeyType="done"
            />
          </Field>

          <Pressable onPress={save} style={[styles.primaryBtn, saving && { opacity: 0.75 }]} disabled={saving}>
            {saving ? (
              <View style={styles.btnRow}>
                <ActivityIndicator color="#052E1C" />
                <Text style={styles.primaryBtnText}>Kaydediliyor...</Text>
              </View>
            ) : (
              <View style={styles.btnRow}>
                <Ionicons name="save-outline" size={18} color="#052E1C" />
                <Text style={styles.primaryBtnText}>Profili Güncelle</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* İLANLARIM */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>İlanlarım</Text>

            <Pressable onPress={loadMyPosts} style={styles.iconBtn} disabled={postsLoading}>
              {postsLoading ? <ActivityIndicator color="#A3E635" /> : <Ionicons name="refresh" size={18} color="#A3E635" />}
            </Pressable>
          </View>

          <Text style={styles.smallHead}>Oyuncu İlanlarım</Text>
          {myPlayers.length === 0 ? (
            <EmptyRow text="Oyuncu ilanı yok." />
          ) : (
            myPlayers.map((p) => (
              <PostItem
                key={`p-${p.id}`}
                tone="green"
                title={`${p.position} aranıyor`}
                metaLeft={p.city}
                note={p.note}
                onEdit={() => openEditPlayer(p)}
                onDelete={() => confirmDeletePlayer(Number(p.id))}
              />
            ))
          )}

          <View style={{ height: 10 }} />

          <Text style={styles.smallHead}>Maç İlanlarım</Text>
          {myMatches.length === 0 ? (
            <EmptyRow text="Maç ilanı yok." />
          ) : (
            myMatches.map((m) => (
              <PostItem
                key={`m-${m.id}`}
                tone="blue"
                title={`${m.city} • ${m.field}`}
                metaLeft={`${m.match_date} • ${m.match_time}`}
                note={m.note}
                onEdit={() => openEditMatch(m)}
                onDelete={() => confirmDeleteMatch(Number(m.id))}
              />
            ))
          )}
        </View>

        {/* HESAP */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Hesap</Text>

          <Pressable onPress={() => router.push("/my_reservation")} style={styles.rowBtn}>
            <View style={styles.rowBtnLeft}>
              <View style={styles.rowIcon}>
                <Ionicons name="calendar-outline" size={18} color="#A3E635" />
              </View>
              <Text style={styles.rowBtnText}>Rezervasyonlarım</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </Pressable>

          <Pressable onPress={logout} style={styles.rowBtn}>
            <View style={styles.rowBtnLeft}>
              <View style={[styles.rowIcon, { borderColor: "rgba(239,68,68,0.25)" }]}>
                <Ionicons name="log-out-outline" size={18} color="#ef4444" />
              </View>
              <Text style={styles.rowBtnText}>Çıkış Yap</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </Pressable>
        </View>

        <View style={{ height: 8 }} />
      </ScrollView>

      {/* EDIT MODAL */}
      {editOpen && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editType === "player" ? "Oyuncu İlanını Düzenle" : "Maç İlanını Düzenle"}
              </Text>

              <Pressable onPress={() => setEditOpen(false)} style={styles.iconBtn}>
                <Ionicons name="close" size={18} color="white" />
              </Pressable>
            </View>

            {editType === "player" ? (
              <>
                <Field label="Pozisyon">
                  <Input value={editForm.position} onChangeText={(v: string) => setEditForm({ ...editForm, position: v })} />
                </Field>

                <Field label="Şehir">
                  <Input value={editForm.city} onChangeText={(v: string) => setEditForm({ ...editForm, city: v })} />
                </Field>

                <Field label="Not">
                  <Input
                    value={editForm.note}
                    onChangeText={(v: string) => setEditForm({ ...editForm, note: v })}
                    multiline
                    style={{ minHeight: 84, textAlignVertical: "top" }}
                  />
                </Field>
              </>
            ) : (
              <>
                <Field label="Şehir">
                  <Input value={editForm.city} onChangeText={(v: string) => setEditForm({ ...editForm, city: v })} />
                </Field>

                <Field label="Saha">
                  <Input value={editForm.field} onChangeText={(v: string) => setEditForm({ ...editForm, field: v })} />
                </Field>

                <Field label="Tarih (YYYY-MM-DD)">
                  <Input value={editForm.match_date} onChangeText={(v: string) => setEditForm({ ...editForm, match_date: v })} />
                </Field>

                <Field label="Saat (HH:MM)">
                  <Input value={editForm.match_time} onChangeText={(v: string) => setEditForm({ ...editForm, match_time: v })} />
                </Field>

                <Field label="Not">
                  <Input
                    value={editForm.note}
                    onChangeText={(v: string) => setEditForm({ ...editForm, note: v })}
                    multiline
                    style={{ minHeight: 84, textAlignVertical: "top" }}
                  />
                </Field>
              </>
            )}

            <Pressable onPress={saveEdit} style={[styles.primaryBtn, editSaving && { opacity: 0.75 }]} disabled={editSaving}>
              {editSaving ? (
                <View style={styles.btnRow}>
                  <ActivityIndicator color="#052E1C" />
                  <Text style={styles.primaryBtnText}>Kaydediliyor...</Text>
                </View>
              ) : (
                <View style={styles.btnRow}>
                  <Ionicons name="save-outline" size={18} color="#052E1C" />
                  <Text style={styles.primaryBtnText}>Kaydet</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

/* ---------- UI COMPONENTS ---------- */

function Field({ label, children }: { label: string; children: any }) {
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function Input(props: any) {
  return <TextInput {...props} placeholderTextColor="#9CA3AF" style={[styles.input, props?.style]} />;
}

function Chip({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.chip}>
      <Ionicons name={icon} size={14} color="#D1D5DB" />
      <Text style={styles.chipText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function StatPill({ icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <View style={styles.statPill}>
      <Ionicons name={icon} size={16} color="#A3E635" />
      <Text style={styles.statPillValue}>{value}</Text>
      <Text style={styles.statPillLabel}>{label}</Text>
    </View>
  );
}

function QuickBtn({ icon, text, onPress }: { icon: any; text: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.quickBtn}>
      <Ionicons name={icon} size={16} color="#A3E635" />
      <Text style={styles.quickBtnText} numberOfLines={1}>
        {text}
      </Text>
    </Pressable>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <View style={styles.emptyRow}>
      <Ionicons name="information-circle-outline" size={16} color="#9CA3AF" />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function PostItem({
  tone,
  title,
  metaLeft,
  note,
  onEdit,
  onDelete,
}: {
  tone: "green" | "blue";
  title: string;
  metaLeft: string;
  note?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const dotColor = tone === "green" ? "#A3E635" : "#60A5FA";
  const border = tone === "green" ? "rgba(163,230,53,0.20)" : "rgba(96,165,250,0.20)";

  return (
    <View style={[styles.postItem, { borderColor: border }]}>
      <View style={styles.postTop}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={styles.postTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <View style={styles.postMetaRow}>
        <Ionicons name="information-circle-outline" size={14} color="#9CA3AF" />
        <Text style={styles.postMetaText} numberOfLines={1}>
          {metaLeft}
        </Text>
      </View>

      {!!note && (
        <View style={styles.noteBox}>
          <Text style={styles.noteText} numberOfLines={3}>
            {note}
          </Text>
        </View>
      )}

      <View style={styles.postActions}>
        <Pressable onPress={onEdit} style={styles.actionBtn}>
          <Ionicons name="create-outline" size={16} color="#D1D5DB" />
          <Text style={styles.actionText}>Düzenle</Text>
        </Pressable>

        <Pressable onPress={onDelete} style={[styles.actionBtn, styles.dangerBtn]}>
          <Ionicons name="trash-outline" size={16} color="#fecaca" />
          <Text style={[styles.actionText, { color: "#fecaca" }]}>Sil</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ---------- STYLES ---------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#020A08" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  hero: {
    margin: 16,
    borderRadius: 26,
    padding: 16,
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
    backgroundColor: "rgba(96,165,250,0.12)",
  },

  heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroTitle: { color: "white", fontWeight: "900", fontSize: 22 },
  heroSub: { color: "#9CA3AF", marginTop: 6, fontSize: 12, fontWeight: "700" },

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

  heroRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 },

  avatarWrap: { width: 80, height: 80, borderRadius: 26 },
  avatarImg: { width: "100%", height: "100%", borderRadius: 26 },
  avatarFallback: {
    width: "100%",
    height: "100%",
    borderRadius: 26,
    backgroundColor: "rgba(163,230,53,0.15)",
    borderWidth: 1,
    borderColor: "rgba(163,230,53,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "white", fontWeight: "900", fontSize: 20 },

  cameraBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 12,
    backgroundColor: "#A3E635",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#020A08",
  },

  heroName: { color: "white", fontSize: 18, fontWeight: "900" },
  heroEmail: { color: "#9CA3AF", fontSize: 12, marginTop: 3 },

  chipsRow: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    maxWidth: "100%",
  },
  chipText: { color: "#D1D5DB", fontWeight: "800", fontSize: 12 },

  statsRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  statPill: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: "rgba(0,0,0,0.20)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    gap: 4,
  },
  statPillValue: { color: "white", fontWeight: "900", fontSize: 14 },
  statPillLabel: { color: "#9CA3AF", fontWeight: "800", fontSize: 11 },

  quickRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  quickBtn: {
    flex: 1,
    height: 44,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 10,
  },
  quickBtnText: { color: "white", fontWeight: "900", fontSize: 12 },

  tipText: { color: "#6B7280", fontSize: 11, marginTop: 12, fontWeight: "700" },

  card: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { color: "white", fontWeight: "900", fontSize: 18 },

  sectionHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.20)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  sectionHintText: { color: "#D1D5DB", fontWeight: "900", fontSize: 12 },

  label: { color: "#9CA3AF", fontSize: 12, marginBottom: 6, fontWeight: "800" },

  input: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "white",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },

  primaryBtn: {
    marginTop: 16,
    backgroundColor: "#A3E635",
    borderRadius: 16,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: "#052E1C", fontWeight: "900", fontSize: 15 },
  btnRow: { flexDirection: "row", alignItems: "center", gap: 10 },

  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },

  smallHead: { color: "white", fontWeight: "900", marginTop: 6, marginBottom: 6 },

  postItem: {
    padding: 12,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    marginTop: 10,
  },
  postTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 999, backgroundColor: "#A3E635" },
  postTitle: { color: "white", fontWeight: "900", fontSize: 14, flex: 1 },

  postMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  postMetaText: { color: "#9CA3AF", fontSize: 12, fontWeight: "800", flex: 1 },

  noteBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  noteText: { color: "#D1D5DB", fontSize: 12, lineHeight: 16, fontWeight: "700" },

  postActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  actionBtn: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  dangerBtn: {
    borderColor: "rgba(239,68,68,0.30)",
    backgroundColor: "rgba(239,68,68,0.10)",
  },
  actionText: { color: "#D1D5DB", fontWeight: "900", fontSize: 12 },

  emptyRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  emptyText: { color: "#9CA3AF", fontWeight: "800", fontSize: 12 },

  rowBtn: {
    height: 54,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  rowBtnDanger: {
    borderColor: "rgba(239,68,68,0.25)",
    backgroundColor: "rgba(239,68,68,0.08)",
  },
  rowBtnLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowBtnText: { color: "white", fontWeight: "900", fontSize: 14 },

  miniHint: { color: "#6B7280", fontWeight: "700", fontSize: 11, marginTop: 10, lineHeight: 16 },

  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    borderRadius: 22,
    padding: 16,
    backgroundColor: "rgba(11,18,32,0.98)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  modalTitle: { color: "white", fontWeight: "900", fontSize: 16 },
});
