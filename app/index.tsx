import { Redirect } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";

const API_BASE = "http://192.168.1.11:3000";

export default function Index() {
  const [route, setRoute] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const token = await SecureStore.getItemAsync("token");

      if (!token) {
        setRoute("/(auth)/login");
        return;
      }

      // Token gerçekten geçerli mi kontrol
      try {
        const r = await fetch(`${API_BASE}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (r.ok) setRoute("/(tabs)");
        else {
          await SecureStore.deleteItemAsync("token");
          setRoute("/(auth)/login");
        }
      } catch {
        // Sunucu yoksa en azından login'e düş
        setRoute("/(auth)/login");
      }
    })();
  }, []);

  if (!route) return null;
  return <Redirect href={route as any} />;
}
