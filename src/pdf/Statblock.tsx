import { Document, Page, Path, Svg, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { Entry, Section, StatblockModel } from "./statblock-model.js";
import { color, font, px, type PageFormat } from "./theme.js";

export const border = { borderWidth: px(2), borderColor: color.line, borderStyle: "solid" as const, borderRadius: px(6) };

export function Title({ children }: { children: ReactNode }) {
  return (
    <View style={{ borderBottomWidth: px(1.5), borderBottomColor: color.rule, borderBottomStyle: "solid", paddingBottom: px(2) }}>
      <Text style={{ fontFamily: font.sans, fontWeight: 600, fontSize: px(11), letterSpacing: px(0.66), textAlign: "center" }}>
        {String(children).toUpperCase()}
      </Text>
    </View>
  );
}

export function Panel({ title, children, style, wrap }: { title?: string; children?: ReactNode; style?: object; wrap?: boolean }) {
  return (
    <View wrap={wrap} style={{ ...border, backgroundColor: color.white, paddingTop: px(6), paddingBottom: px(8), paddingHorizontal: px(16), ...style }}>
      {title ? <Title>{title}</Title> : null}
      {children}
    </View>
  );
}

export function Dot({ style }: { style: object }) {
  return <View style={{ position: "absolute", width: px(10), height: px(10), borderRadius: px(5), backgroundColor: color.dot, ...style }} />;
}

export function Shield({ value }: { value: string }) {
  return (
    <View style={{ width: px(62), height: px(70), marginTop: px(6), alignItems: "center", justifyContent: "center" }}>
      <Svg viewBox="0 0 60 70" style={{ position: "absolute", width: px(62), height: px(70) }}>
        <Path
          d="M30 3 L56 11 V35 C56 52 44 63 30 68 C16 63 4 52 4 35 V11 Z"
          fill="#ffffff"
          stroke={color.line}
          strokeWidth={2.5}
        />
      </Svg>
      <Text style={{ fontFamily: font.serif, fontWeight: 700, fontSize: px(28), marginTop: px(-3) }}>{value}</Text>
    </View>
  );
}

export function Stat({ title, children, width }: { title: string; children: ReactNode; width?: number }) {
  return (
    <View style={{ ...border, flexGrow: width ? 0 : 1, flexBasis: width ?? 0, width, paddingTop: px(6), paddingBottom: px(8), paddingHorizontal: px(10) }}>
      <Title>{title}</Title>
      <View style={{ flexGrow: 1, alignItems: "center", justifyContent: "center", flexDirection: "row" }}>{children}</View>
    </View>
  );
}

function EntryText({ e }: { e: Entry }) {
  return (
    <Text wrap={false} style={{ marginTop: px(7), fontFamily: font.sans, fontSize: px(13.5), lineHeight: 1.4 }}>
      <Text style={{ fontFamily: font.serif, fontWeight: 700, fontStyle: "italic" }}>{e.name}. </Text>
      {e.lead ? <Text style={{ fontStyle: "italic", color: color.soft }}>{e.lead} </Text> : null}
      {e.text}
    </Text>
  );
}

/** Грубая оценка высоты секции в пунктах: нужна, чтобы короткие панели не рвались между страницами. */
function estimateHeight(s: Section): number {
  const lines = (n: number) => Math.max(1, Math.ceil(n / 92));
  const body = s.entries.reduce((sum, e) => sum + lines(e.name.length + (e.lead?.length ?? 0) + e.text.length) * 14.2 + 5.3, 0);
  return body + (s.intro ? lines(s.intro.length) * 13.6 : 0) + 40;
}

function SectionPanel({ s }: { s: Section }) {
  return (
    <Panel title={s.title} style={{ paddingBottom: px(10) }} wrap={estimateHeight(s) > 560}>
      {s.intro ? <Text style={{ marginTop: px(7), fontFamily: font.sans, fontSize: px(13), lineHeight: 1.4, color: color.soft }}>{s.intro}</Text> : null}
      {s.entries.map((e, i) => (
        <EntryText key={i} e={e} />
      ))}
    </Panel>
  );
}

export function StatblockPage({ m, size = "A4" }: { m: StatblockModel; size?: PageFormat }) {
  return (
    <Page
      size={size}
      wrap={size === "A4"}
      style={{
        paddingVertical: px(36),
        paddingHorizontal: px(40),
        backgroundColor: color.white,
        color: color.ink,
        fontFamily: font.sans,
        fontSize: px(13.5),
        flexDirection: "column",
      }}
    >
      {/* Шапка */}
      <View style={{ ...border, flexDirection: "row", alignItems: "center", paddingVertical: px(13), paddingHorizontal: px(18), marginBottom: px(10) }}>
        <Dot style={{ left: px(-6), top: px(-6) }} />
        <Dot style={{ right: px(-6), bottom: px(-6) }} />
        <View style={{ flexGrow: 1, flexShrink: 1 }}>
          <Text style={{ fontFamily: font.serif, fontWeight: 700, fontSize: px(34), lineHeight: 1.1, color: color.accent }}>{m.name}</Text>
          <Text style={{ marginTop: px(4), fontStyle: "italic", fontSize: px(14), color: color.soft }}>{m.typeLine}</Text>
          <View style={{ marginTop: px(8), borderTopWidth: px(1), borderTopColor: color.hairline, borderTopStyle: "solid", paddingTop: px(5) }}>
            <Text style={{ fontSize: px(11), letterSpacing: px(0.66), color: color.muted }}>
              ИСТОЧНИК: <Text style={{ fontWeight: 700, color: color.ink }}>{m.source}</Text>
            </Text>
          </View>
        </View>
        <View style={{ width: px(116), marginLeft: px(18), borderWidth: px(1.5), borderColor: color.line, borderStyle: "solid", borderRadius: px(6), alignItems: "center", paddingVertical: px(6), backgroundColor: color.fill }}>
          <Text style={{ fontSize: px(11), letterSpacing: px(0.9), fontWeight: 600 }}>ОПАСНОСТЬ</Text>
          <Text style={{ fontFamily: font.serif, fontWeight: 700, fontSize: px(40), lineHeight: 1.05, color: color.accent }}>{m.cr}</Text>
          <Text style={{ fontSize: px(12), color: color.soft }}>{m.xp} опыта</Text>
        </View>
      </View>

      {/* Боевые показатели */}
      <View style={{ flexDirection: "row", marginBottom: px(10) }}>
        <View style={{ ...border, width: px(118), alignItems: "center", paddingTop: px(6), paddingBottom: px(8), marginRight: px(10) }}>
          <View style={{ width: "94%" }}>
            <Title>Класс доспеха</Title>
          </View>
          <Shield value={m.ac} />
          {m.acNote ? <Text style={{ fontSize: px(11.5), color: color.soft, marginTop: px(3) }}>{m.acNote}</Text> : null}
        </View>
        <View style={{ flexGrow: 1, flexBasis: 0, marginRight: px(10), flexDirection: "row" }}>
          <Stat title="Хиты">
            <Text style={{ fontFamily: font.serif, fontWeight: 700, fontSize: px(46) }}>{m.hp}</Text>
            <Text style={{ fontSize: px(15), color: color.soft, marginLeft: px(10) }}>({m.hpFormula})</Text>
          </Stat>
        </View>
        <View style={{ flexGrow: 1, flexBasis: 0, marginRight: px(10), flexDirection: "row" }}>
          <Stat title="Скорость">
            <View style={{ alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
                <Text style={{ fontFamily: font.serif, fontWeight: 700, fontSize: px(m.speedExtra ? 36 : 46) }}>{m.speed}</Text>
                <Text style={{ fontSize: px(15), color: color.soft, marginLeft: px(8), marginBottom: px(m.speedExtra ? 6 : 8) }}>фт.</Text>
              </View>
              {m.speedExtra ? <Text style={{ fontSize: px(12), color: color.soft, textAlign: "center" }}>{m.speedExtra}</Text> : null}
            </View>
          </Stat>
        </View>
        <Stat title="Иниц." width={px(96)}>
          <Text style={{ fontFamily: font.serif, fontWeight: 700, fontSize: px(38) }}>{m.initiative}</Text>
        </Stat>
      </View>

      {/* Характеристики */}
      <View style={{ flexDirection: "row", marginBottom: px(10) }}>
        {m.abilities.map((a, i) => (
          <View key={a.name} style={{ ...border, flexGrow: 1, flexBasis: 0, alignItems: "center", paddingTop: px(6), paddingBottom: px(7), marginRight: i < 5 ? px(8) : 0 }}>
            <View style={{ width: "84%" }}>
              <Title>{a.name}</Title>
            </View>
            <View style={{ marginTop: px(8), width: px(54), height: px(54), borderWidth: px(2), borderColor: color.line, borderStyle: "solid", borderRadius: px(27), alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontFamily: font.serif, fontWeight: 700, fontSize: px(26) }}>{a.mod}</Text>
            </View>
            <View style={{ marginTop: px(6), minWidth: px(40), borderWidth: px(1.5), borderColor: color.line, borderStyle: "solid", borderRadius: px(4), backgroundColor: color.fill, paddingHorizontal: px(8), alignItems: "center" }}>
              <Text style={{ fontFamily: font.serif, fontSize: px(17) }}>{a.score}</Text>
            </View>
            <View style={{ marginTop: px(7), width: "84%", borderTopWidth: px(1), borderTopColor: color.hairline, borderTopStyle: "solid", paddingTop: px(5), flexDirection: "row", justifyContent: "center", alignItems: "center" }}>
              <View style={{ width: px(10), height: px(10), borderRadius: px(5), borderWidth: px(1.5), borderStyle: "solid", borderColor: a.saveProf ? color.ink : "#6b6b6b", backgroundColor: a.saveProf ? color.ink : color.white, marginRight: px(6) }} />
              <Text style={{ fontSize: px(12), fontWeight: 700 }}>{a.save} </Text>
              <Text style={{ fontSize: px(12), color: color.soft }}>спасбр.</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Свойства */}
      <Panel title="Свойства" style={{ marginBottom: px(10) }}>
        <View style={{ marginTop: px(6) }}>
          {m.props.map((p) => (
            <View key={p.label} style={{ flexDirection: "row", marginBottom: px(3) }}>
              <Text style={{ width: px(165), fontSize: px(11), letterSpacing: px(0.55), color: color.muted, paddingTop: px(2) }}>{p.label.toUpperCase()}</Text>
              <Text style={{ flexGrow: 1, flexShrink: 1, fontWeight: 600 }}>{p.value}</Text>
            </View>
          ))}
        </View>
      </Panel>

      {/* Особенности и действия */}
      {m.sections.map((s) => (
        <View key={s.title} wrap={estimateHeight(s) > 560} style={{ marginBottom: px(10) }}>
          <SectionPanel s={s} />
        </View>
      ))}

      {/* Тактика и проверка опасности */}
      <View wrap={size !== "A4" ? undefined : false} style={{ flexDirection: "row" }}>
        <Panel title="Тактика и заметки мастера" style={{ flexGrow: 1.5, flexBasis: 0, marginRight: px(10), minHeight: px(120) }}>
          {m.notes.map((n, i) => (
            <Text key={i} style={{ marginTop: px(6), fontSize: px(13), lineHeight: 1.4 }}>
              <Text style={{ fontWeight: 700 }}>{n.title}. </Text>
              {n.text}
            </Text>
          ))}
        </Panel>
        <Panel title="Проверка опасности" style={{ flexGrow: 1, flexBasis: 0, minHeight: px(120) }}>
          <View style={{ marginTop: px(7) }}>
            {m.crCheck.rows.map((r) => (
              <View key={r.label} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: px(4) }}>
                <Text style={{ fontSize: px(13) }}>{r.label}</Text>
                <Text style={{ fontFamily: font.serif, fontWeight: 700, fontSize: px(13) }}>{r.value}</Text>
              </View>
            ))}
          </View>
          <View style={{ marginTop: px(8), borderTopWidth: px(1), borderTopColor: color.hairline, borderTopStyle: "solid", paddingTop: px(7) }}>
            <Text style={{ fontSize: px(12.5), lineHeight: 1.35 }}>
              {m.crCheck.status === "ok" ? "✓ " : m.crCheck.status === "tolerable" ? "≈ " : "! "}
              {m.crCheck.verdict}
            </Text>
          </View>
        </Panel>
      </View>
    </Page>
  );
}

export function StatblockDocument({ m }: { m: StatblockModel }) {
  return (
    <Document title={`${m.name}: статблок`} language="ru">
      <StatblockPage m={m} />
    </Document>
  );
}
