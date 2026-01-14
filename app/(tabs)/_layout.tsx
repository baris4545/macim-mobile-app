import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform, View } from "react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: "#020A08" },
        headerShadowVisible: false,
        headerTintColor: "white",

        tabBarActiveTintColor: "#A3E635",
        tabBarInactiveTintColor: "#9CA3AF",

        tabBarHideOnKeyboard: Platform.OS === "ios",

        tabBarStyle: {
          backgroundColor: "#020A08",
          borderTopColor: "rgba(255,255,255,0.10)",
          height: Platform.OS === "ios" ? 88 : 68,
          paddingBottom: Platform.OS === "ios" ? 22 : 10,
          paddingTop: 8,
        },

        // ✅ tabbar arkasını garanti siyah yapar (iOS beyazlık fix)
        tabBarBackground: () => (
          <View style={{ flex: 1, backgroundColor: "#020A08" }} />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Ana Sayfa",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="players"
        options={{
          title: "Oyuncu Ara",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="matches"
        options={{
          title: "Maç Bul",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="football" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="map"
        options={{
          title: "Harita",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="messages"
        options={{
          title: "Mesajlarım",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
