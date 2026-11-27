import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { Link } from "expo-router";
export const palette = {
  background: "#f4f5f0",
  ink: "#142c29",
  muted: "#526a65",
  accent: "#d4ef7b",
  line: "#d8e0d7",
  white: "#fff",
  error: "#9c2e24",
};
export function Button({
  title,
  onPress,
  disabled = false,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        disabled && { opacity: 0.45 },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[styles.buttonText, secondary && { color: palette.ink }]}>
        {title}
      </Text>
    </Pressable>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function Navigation() {
  return (
    <View style={styles.navigation}>
      <Link href="/" replace style={styles.link}>
        Venta
      </Link>
      <Link href="/history" replace style={styles.link}>
        Historial
      </Link>
      <Link href="/settings" replace style={styles.link}>
        Simuladores
      </Link>
    </View>
  );
}
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.background },
  content: {
    padding: 22,
    paddingBottom: 50,
    width: "100%",
    maxWidth: 850,
    alignSelf: "center",
    gap: 18,
  },
  title: {
    fontSize: 33,
    fontWeight: "700",
    color: palette.ink,
    letterSpacing: -1,
  },
  subtitle: { fontSize: 16, lineHeight: 24, color: palette.muted },
  eyebrow: {
    fontSize: 13,
    letterSpacing: 2,
    fontWeight: "700",
    color: palette.muted,
  },
  heading: { fontSize: 21, color: palette.ink, fontWeight: "600" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  card: {
    backgroundColor: palette.white,
    borderRadius: 16,
    padding: 20,
    gap: 13,
    borderWidth: 1,
    borderColor: palette.line,
  },
  button: {
    backgroundColor: palette.ink,
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },
  secondary: { backgroundColor: palette.accent },
  buttonText: { color: palette.white, fontSize: 16, fontWeight: "600" },
  navigation: {
    flexDirection: "row",
    gap: 23,
    flexWrap: "wrap",
    paddingVertical: 10,
  },
  link: { color: palette.ink, fontSize: 16, textDecorationLine: "underline" },
  amount: { fontSize: 26, fontWeight: "700", color: palette.ink },
  small: { fontSize: 14, lineHeight: 21, color: palette.muted },
  error: { color: palette.error, fontSize: 16, lineHeight: 24 },
  input: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 8,
    minHeight: 48,
    padding: 12,
    color: palette.ink,
    fontSize: 16,
    backgroundColor: palette.white,
  },
  badge: {
    color: palette.ink,
    backgroundColor: palette.accent,
    borderRadius: 5,
    padding: 7,
    fontSize: 14,
    fontWeight: "500",
  },
});
