import { Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { NpcCardModel } from "./npc-model.js";
import { color, font, px } from "./theme.js";

export const hair = { borderTopWidth: px(1), borderTopColor: color.hairline, borderTopStyle: "solid" as const };

export function Label({ children }: { children: ReactNode }) {
  return <Text style={{ fontSize: px(10.5), letterSpacing: px(0.55), color: color.muted }}>{String(children).toUpperCase()}</Text>;
}

function Mark({ level }: { level: 0 | 1 | 2 | "save" }) {
  const filled = level !== 0;
  return (
    <View
      style={{
        width: px(10), height: px(10), borderRadius: px(5), marginRight: px(7),
        borderWidth: px(1.5), borderStyle: "solid",
        borderColor: filled ? color.ink : "#6b6b6b",
        backgroundColor: filled ? color.ink : color.white,
        ...(level === 2 ? { borderWidth: px(2.5), backgroundColor: color.white } : {}),
      }}
    />
  );
}

export function Para({ name, children }: { name?: string; children: ReactNode }) {
  return (
    <Text wrap={false} style={{ marginTop: px(6), fontSize: px(12.5), lineHeight: 1.38 }}>
      {name ? <Text style={{ fontFamily: font.serif, fontWeight: 700, fontStyle: "italic" }}>{name}. </Text> : null}
      {children}
    </Text>
  );
}

export function AbilityRow({ a }: { a: NpcCardModel["abilities"][number] }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: px(5) }}>
      <View style={{ width: px(34), height: px(34), borderRadius: px(17), borderWidth: px(2), borderColor: color.line, borderStyle: "solid", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: font.serif, fontWeight: 700, fontSize: px(16) }}>{a.mod}</Text>
      </View>
      <Text style={{ flexGrow: 1, marginLeft: px(10), fontSize: px(12), fontWeight: 600, letterSpacing: px(0.5) }}>{a.name}</Text>
      <View style={{ minWidth: px(34), borderWidth: px(1.5), borderColor: color.line, borderStyle: "solid", borderRadius: px(4), backgroundColor: color.fill, alignItems: "center", paddingHorizontal: px(6) }}>
        <Text style={{ fontFamily: font.serif, fontSize: px(15) }}>{a.score}</Text>
      </View>
    </View>
  );
}

export function ListRow({ mark, bonus, name, tail }: { mark: 0 | 1 | 2; bonus: string; name: string; tail?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: px(2.5) }}>
      <Mark level={mark} />
      <Text style={{ width: px(28), fontWeight: 700, fontSize: px(12.5) }}>{bonus}</Text>
      <Text style={{ flexGrow: 1, fontSize: px(12.5) }}>{name}</Text>
      {tail ? <Text style={{ fontSize: px(10.5), color: color.muted }}>{tail}</Text> : null}
    </View>
  );
}

export function Plain({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", marginTop: px(4) }}>
      <View style={{ width: px(104), flexShrink: 0, paddingTop: px(1.5) }}>
        <Label>{label}</Label>
      </View>
      <Text style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, fontSize: px(12.5), fontWeight: 600 }}>{children}</Text>
    </View>
  );
}
