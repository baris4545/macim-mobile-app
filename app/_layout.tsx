import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: "#020A08" },
        headerShown: false,
      }}
    />
  );
}
