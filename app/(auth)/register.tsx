import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

const API_BASE = "http://192.168.1.11:3000";

async function registerRequest(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

function normalizeEmail(s: string) {
  return (s || "").trim().toLowerCase();
}

export default function Register() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPass, setShowPass] = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => {
    const e = normalizeEmail(email);
    const p = password.trim();
    const c = confirmPassword.trim();
    return e.length > 3 && p.length >= 6 && c.length >= 6 && p === c && !loading;
  }, [email, password, confirmPassword, loading]);

  const onRegister = async () => {
    const e = normalizeEmail(email);
    const p = password.trim();
    const c = confirmPassword.trim();

    if (!e || !p || !c) {
      Alert.alert("Eksik bilgi", "Lütfen tüm alanları doldur.");
      return;
    }

    if (p.length < 6) {
      Alert.alert("Şifre kısa", "Şifre en az 6 karakter olmalı.");
      return;
    }

    if (p !== c) {
      Alert.alert("Şifreler eşleşmiyor", "Lütfen şifreleri aynı gir.");
      return;
    }

    setLoading(true);
    try {
      const { ok, data } = await registerRequest(e, p);

      const token = data?.token || data?.sessionToken;

      if (!ok || !token) {
        // backend error code -> kullanıcı dostu mesaj
        const err = String(data?.error || "");
        if (err === "email_exists") {
          Alert.alert("Bu e-posta kullanılıyor", "Başka bir e-posta deneyebilirsin.");
          return;
        }
        if (err === "password_too_short") {
          Alert.alert("Şifre kısa", "Şifre en az 6 karakter olmalı.");
          return;
        }
        Alert.alert("Kayıt başarısız", "Bilgileri kontrol edip tekrar dene.");
        return;
      }

      await SecureStore.setItemAsync("token", String(token));
      router.replace("/(tabs)");
    } catch {
      Alert.alert("Bağlantı hatası", "Sunucuya bağlanılamadı. IP/Port doğru mu?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* arka plan glow */}
      <View style={styles.bgGlowA} />
      <View style={styles.bgGlowB} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.badge}>
            <Ionicons name="person-add" size={18} color="#052E1C" />
          </View>

          <Text style={styles.logo}>MAÇIM</Text>
          <Text style={styles.slogan}>Hemen kayıt ol, maçlara karış!</Text>
        </View>

        {/* CARD */}
        <View style={styles.card}>
          <Text style={styles.title}>Kayıt Ol</Text>
          <Text style={styles.subTitle}>Halı saha dünyasına katıl.</Text>

          {/* Email */}
          <View style={styles.inputWrap}>
            <View style={styles.inputIcon}>
              <Ionicons name="mail-outline" size={18} color="#9CA3AF" />
            </View>
            <TextInput
              placeholder="E-posta"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              returnKeyType="next"
            />
          </View>

          {/* Password */}
          <View style={styles.inputWrap}>
            <View style={styles.inputIcon}>
              <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" />
            </View>
            <TextInput
              placeholder="Şifre (min 6 karakter)"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              secureTextEntry={!showPass}
              value={password}
              onChangeText={setPassword}
              returnKeyType="next"
            />
            <Pressable onPress={() => setShowPass((v) => !v)} style={styles.eyeBtn} hitSlop={10}>
              <Ionicons
                name={showPass ? "eye-off-outline" : "eye-outline"}
                size={18}
                color="#D1D5DB"
              />
            </Pressable>
          </View>

          {/* Confirm */}
          <View style={styles.inputWrap}>
            <View style={styles.inputIcon}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#9CA3AF" />
            </View>
            <TextInput
              placeholder="Şifre Tekrar"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              secureTextEntry={!showPass2}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              returnKeyType="done"
              onSubmitEditing={onRegister}
            />
            <Pressable onPress={() => setShowPass2((v) => !v)} style={styles.eyeBtn} hitSlop={10}>
              <Ionicons
                name={showPass2 ? "eye-off-outline" : "eye-outline"}
                size={18}
                color="#D1D5DB"
              />
            </Pressable>
          </View>

          {/* CTA */}
          <Pressable
            style={({ pressed }) => [
              styles.button,
              !canSubmit && styles.buttonDisabled,
              pressed && canSubmit && { transform: [{ scale: 0.995 }], opacity: 0.95 },
            ]}
            onPress={onRegister}
            disabled={!canSubmit}
          >
            {loading ? (
              <ActivityIndicator color="#052E1C" />
            ) : (
              <>
                <Ionicons name="sparkles-outline" size={18} color="#052E1C" />
                <Text style={styles.buttonText}>Hesap Oluştur</Text>
              </>
            )}
          </Pressable>

          {/* switch */}
          <Pressable onPress={() => router.replace("/(auth)/login")} style={{ marginTop: 14 }}>
            <Text style={styles.switchText}>
              Zaten hesabın var mı? <Text style={styles.link}>Giriş Yap</Text>
            </Text>
          </Pressable>

          <View style={styles.hintRow}>
            <Ionicons name="shield-checkmark-outline" size={14} color="#9CA3AF" />
            <Text style={styles.hintText}>Bilgilerin güvenle saklanır.</Text>
          </View>
        </View>

        <Text style={styles.footer}>Topluluğa katıl ve maçını planla</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#020A08" },

  // background glows
  bgGlowA: {
    position: "absolute",
    top: -140,
    right: -120,
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: "rgba(163,230,53,0.14)",
  },
  bgGlowB: {
    position: "absolute",
    bottom: -160,
    left: -140,
    width: 340,
    height: 340,
    borderRadius: 999,
    backgroundColor: "rgba(96,165,250,0.10)",
  },

  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 22,
  },

  header: { alignItems: "center", marginBottom: 22 },
  badge: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#A3E635",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  logo: {
    color: "white",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 1,
  },
  slogan: {
    color: "#9CA3AF",
    fontSize: 12,
    marginTop: 6,
    fontWeight: "700",
  },

  card: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  title: {
    color: "white",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  subTitle: {
    color: "#9CA3AF",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 14,
    fontSize: 12,
    fontWeight: "700",
  },

  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 52,
    borderRadius: 16,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    marginBottom: 12,
  },
  inputIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    color: "white",
    fontWeight: "800",
    fontSize: 13,
    paddingVertical: 0,
  },
  eyeBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  button: {
    height: 52,
    borderRadius: 18,
    backgroundColor: "#A3E635",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    flexDirection: "row",
    gap: 8,
  },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: "#052E1C", fontWeight: "900", fontSize: 15 },

  switchText: {
    textAlign: "center",
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "700",
  },
  link: { color: "#A3E635", fontWeight: "900" },

  hintRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  hintText: { color: "#9CA3AF", fontSize: 11, fontWeight: "700" },

  footer: {
    marginTop: 18,
    textAlign: "center",
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
  },
});
