import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PosProvider } from "../application/PosProvider";
export default function Layout() {
  return (
    <PosProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#f4f5f0" },
          headerTintColor: "#142c29",
          headerTitle: "POS Sandbox · demo",
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="history" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="sale/[id]" />
      </Stack>
    </PosProvider>
  );
}
