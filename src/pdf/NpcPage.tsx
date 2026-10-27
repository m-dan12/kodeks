import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { NpcCardModel } from "./npc-model.js";
import { Dot, Panel, Shield, Stat, border } from "./Statblock.js";
import { AbilityRow, Label, ListRow, Para, Plain, hair } from "./NpcCard.js";
import { color, font, px, type PageFormat } from "./theme.js";

const lines = (chars: number, perLine: number) => Math.max(1, Math.ceil(chars / perLine));

/** Высота левой колонки (характеристики + навыки) в пунктах: правая колонка заполняется до неё. */
const SIDE_BUDGET = 600;

interface Block {
  key: string;
  est: number;
  node: ReactNode;
}

function blocks(m: NpcCardModel, compact = false): Block[] {
  const out: Block[] = [];
  const panelGap = { marginBottom: px(10) };

  if (m.attacks.length > 0) {
    out.push({
      key: "attacks",
      est: 34 + m.attacks.length * 29,
      node: (
        <Panel title="Атаки" style={panelGap} wrap={false}>
          {compact ? (
            m.attacks.map((a, i) => (
              <View key={i} wrap={false} style={{ marginTop: px(5), ...hair, paddingTop: px(4) }}>
                <Text style={{ fontFamily: font.serif, fontWeight: 700, fontSize: px(13) }}>{a.name}</Text>
                <Text style={{ fontSize: px(12.5), fontWeight: 700 }}>
                  {a.bonus}
                  <Text style={{ fontWeight: 400 }}>  ·  {a.damage}</Text>
                </Text>
                {a.note ? <Text style={{ fontSize: px(11), color: color.soft, fontStyle: "italic" }}>{a.note}</Text> : null}
              </View>
            ))
          ) : null}
          {compact ? null : (<>
          <View style={{ flexDirection: "row", marginTop: px(6) }}>
            <View style={{ flexGrow: 1 }}><Label>Название</Label></View>
            <View style={{ width: px(46) }}><Label>Бонус</Label></View>
            <View style={{ width: px(112) }}><Label>Урон</Label></View>
          </View>
          {m.attacks.map((a, i) => (
            <View key={i} wrap={false} style={{ marginTop: px(5), ...hair, paddingTop: px(4) }}>
              <View style={{ flexDirection: "row" }}>
                <Text style={{ flexGrow: 1, flexShrink: 1, fontFamily: font.serif, fontWeight: 700, fontSize: px(13) }}>{a.name}</Text>
                <Text style={{ width: px(46), fontWeight: 700, fontSize: px(13) }}>{a.bonus}</Text>
                <Text style={{ width: px(112), fontSize: px(12.5) }}>{a.damage}</Text>
              </View>
              {a.note ? <Text style={{ fontSize: px(11), color: color.soft, fontStyle: "italic" }}>{a.note}</Text> : null}
            </View>
          ))}
          </>)}
        </Panel>
      ),
    });
  }

  if (m.features.length > 0) {
    out.push({
      key: "features",
      est: 32 + m.features.reduce((n, f) => n + lines(f.name.length + f.text.length, 56) * 15.5 + 6, 0),
      node: (
        <Panel title="Умения и способности" style={panelGap}>
          {m.features.map((f, i) => (
            <Para key={i} name={f.name}>{f.text}</Para>
          ))}
        </Panel>
      ),
    });
  }

  if (m.spellGroups.length > 0) {
    out.push({
      key: "spells",
      est: 70 + m.spellGroups.reduce((n, g) => n + 24 + lines(g.spells.reduce((c, sp) => c + sp.name.length + 2, 0), 62) * 15.5, 0),
      node: (
        <Panel title="Заклинания" style={panelGap}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: px(6) }}>
            {m.spellStats.map((s) => (
              <View key={s.label} style={{ marginRight: px(14), marginBottom: px(2) }}>
                <Text style={{ fontSize: px(12) }}>
                  {s.label}: <Text style={{ fontWeight: 700 }}>Сл {s.dc}</Text>, атака <Text style={{ fontWeight: 700 }}>{s.attack}</Text>
                </Text>
              </View>
            ))}
            {m.pact ? <Text style={{ fontSize: px(12) }}>{m.pact}</Text> : null}
          </View>
          {m.spellGroups.map((g) => (
            <View key={g.level} wrap={false} style={{ marginTop: px(6), ...hair, paddingTop: px(4) }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontWeight: 700, fontSize: px(12) }}>{g.title}</Text>
                {g.slots !== undefined ? <Text style={{ fontSize: px(11.5), color: color.soft }}>ячеек: {g.slots}</Text> : null}
              </View>
              <Text style={{ fontSize: px(12.5), lineHeight: 1.38 }}>
                {g.spells.map((sp, i) => (
                  <Text key={i} style={sp.muted ? { color: color.muted, fontStyle: "italic" } : undefined}>
                    {i > 0 ? ", " : ""}
                    {sp.name}
                    {sp.marks ? ` (${sp.marks})` : ""}
                  </Text>
                ))}
              </Text>
            </View>
          ))}
          <Text style={{ marginTop: px(6), fontSize: px(10.5), color: color.muted }}>
            К — концентрация, Р — ритуал, курсив — в книге, не подготовлено.
          </Text>
        </Panel>
      ),
    });
  }

  if (m.proficiencies.length > 0 || m.equipment.length > 0) {
    out.push({
      key: "gear",
      est: 36 + m.proficiencies.length * 22 + (m.equipment.length ? lines(m.equipment.map((e) => e.name).join(", ").length, 40) * 16 + 6 : 0) + (m.currency ? 22 : 0),
      node: (
        <Panel title="Владения и снаряжение" style={panelGap} wrap={false}>
          {m.proficiencies.map((p) => (
            <Plain key={p.label} label={p.label}>{p.value}</Plain>
          ))}
          {m.equipment.length > 0 && <Plain label="Снаряжение">{m.equipment.map((e) => e.name).join(", ")}</Plain>}
          {m.currency ? <Plain label="Деньги">{m.currency}</Plain> : null}
        </Panel>
      ),
    });
  }

  if (m.roleplay.length > 0) {
    out.push({
      key: "roleplay",
      est: 32 + m.roleplay.reduce((n, r) => n + lines(r.label.length + r.text.length, 56) * 15.5 + 6, 0),
      node: (
        <Panel title="Для отыгрыша" style={panelGap}>
          {m.roleplay.map((r, i) => (
            <Para key={i} name={r.label}>{r.text}</Para>
          ))}
        </Panel>
      ),
    });
  }

  if (m.notes.length > 0) {
    out.push({
      key: "notes",
      est: 32 + m.notes.reduce((n, x) => n + lines(x.title.length + x.text.length, 56) * 15.5 + 6, 0),
      node: (
        <Panel title="Заметки мастера" style={panelGap}>
          {m.notes.map((n, i) => (
            <Para key={i} name={n.title}>{n.text}</Para>
          ))}
        </Panel>
      ),
    });
  }
  return out;
}

export function NpcPage({ m, size = "A4" }: { m: NpcCardModel; size?: PageFormat }) {
  // Панели по порядку занимают место справа от левой колонки, пока влезают; остальные идут во всю ширину ниже.
  const all = blocks(m, size !== "A4");
  let used = 70; // панель спасбросков
  let split = 0;
  while (split < all.length && used + all[split].est <= SIDE_BUDGET) used += all[split++].est;
  const side = all.slice(0, split);
  const below = all.slice(split);
  const twoCol = size !== "A4";

  const abilitiesPanel = (
    <Panel title="Характеристики" style={{ marginBottom: px(8), paddingBottom: px(8) }}>
      {m.abilities.map((a) => (
        <AbilityRow key={a.name} a={a} />
      ))}
    </Panel>
  );
  const skillsPanel = (
    <Panel title="Навыки" style={{ paddingBottom: px(6) }}>
      {m.skills.map((s) => (
        <ListRow key={s.name} mark={s.level} bonus={s.bonus} name={s.name} tail={s.ability} />
      ))}
      <View style={{ marginTop: px(8), ...hair, paddingTop: px(6), flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontSize: px(11.5), color: color.soft }}>Пассивная внимательность</Text>
        <Text style={{ fontFamily: font.serif, fontWeight: 700, fontSize: px(17) }}>{m.passive}</Text>
      </View>
    </Panel>
  );
  const savesPanel = (
    <Panel title="Спасброски" style={{ marginBottom: px(10), paddingBottom: px(6) }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {m.saves.map((s) => (
          <View key={s.name} style={{ width: "33.33%" }}>
            <ListRow
              mark={s.proficient ? 1 : 0}
              bonus={s.bonus}
              name={s.name[0] + s.name.slice(1).toLowerCase().replace("телосложение", "Телосл.").replace("интеллект", "Интелл.")}
            />
          </View>
        ))}
      </View>
    </Panel>
  );

  // длинный лист: сверху полоса «характеристики и спасброски», ниже слева (треть) навыки и атаки, справа всё остальное
  const leftBlocks = all.filter((blk) => blk.key === "attacks");
  const rightBlocks = all.filter((blk) => blk.key !== "attacks");
  const statsBand = (
    <Panel title="Характеристики и спасброски" style={{ marginBottom: px(10), paddingBottom: px(8) }}>
      <View style={{ flexDirection: "row", marginTop: px(6) }}>
        {m.abilities.map((a, i) => (
          <View key={a.name} style={{ flexGrow: 1, flexBasis: 0, alignItems: "center" }}>
            <Text style={{ fontSize: px(11.5), fontWeight: 600, letterSpacing: px(0.5) }}>{a.name}</Text>
            <View style={{ marginTop: px(5), width: px(40), height: px(40), borderRadius: px(20), borderWidth: px(2), borderColor: color.line, borderStyle: "solid", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontFamily: font.serif, fontWeight: 700, fontSize: px(18) }}>{a.mod}</Text>
            </View>
            <View style={{ marginTop: px(5), minWidth: px(36), borderWidth: px(1.5), borderColor: color.line, borderStyle: "solid", borderRadius: px(4), backgroundColor: color.fill, alignItems: "center", paddingHorizontal: px(6) }}>
              <Text style={{ fontFamily: font.serif, fontSize: px(15) }}>{a.score}</Text>
            </View>
            <View style={{ marginTop: px(7), ...hair, paddingTop: px(4), alignSelf: "stretch", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <ListRow mark={m.saves[i].proficient ? 1 : 0} bonus={m.saves[i].bonus} name="Спас." />
              </View>
            </View>
          </View>
        ))}
      </View>
    </Panel>
  );

  return (
    <Page
      size={size}
      wrap={!twoCol}
      style={{
        paddingVertical: px(32), paddingHorizontal: px(36), backgroundColor: color.white, color: color.ink,
        fontFamily: font.sans, fontSize: px(13), flexDirection: "column",
      }}
    >
      {/* Шапка */}
      <View style={{ ...border, flexDirection: "row", alignItems: "center", paddingVertical: px(12), paddingHorizontal: px(18), marginBottom: px(10) }}>
        <Dot style={{ left: px(-6), top: px(-6) }} />
        <Dot style={{ right: px(-6), bottom: px(-6) }} />
        <View style={{ flexGrow: 1, flexShrink: 1 }}>
          <Text style={{ fontFamily: font.serif, fontWeight: 700, fontSize: px(32), lineHeight: 1.1, color: color.accent }}>{m.name}</Text>
          <Text style={{ marginTop: px(4), fontStyle: "italic", fontSize: px(13.5), color: color.soft }}>{m.subtitle}</Text>
          <View style={{ marginTop: px(7), ...hair, paddingTop: px(5) }}>
            <Text style={{ fontSize: px(10.5), letterSpacing: px(0.6), color: color.muted }}>
              ИСТОЧНИК: <Text style={{ fontWeight: 700, color: color.ink }}>{m.source}</Text>
            </Text>
          </View>
        </View>
        <View style={{ width: px(150), marginLeft: px(16), borderWidth: px(1.5), borderColor: color.line, borderStyle: "solid", borderRadius: px(6), alignItems: "center", paddingVertical: px(6), paddingHorizontal: px(6), backgroundColor: color.fill }}>
          <Text style={{ fontSize: px(10.5), letterSpacing: px(0.9), fontWeight: 600 }}>УРОВЕНЬ {m.level}</Text>
          <Text style={{ fontFamily: font.serif, fontWeight: 700, fontSize: px(16), lineHeight: 1.2, color: color.accent, textAlign: "center", marginTop: px(3) }}>{m.classLine}</Text>
        </View>
      </View>

      {/* Боевые показатели */}
      {twoCol ? (
        <View style={{ flexDirection: "row", marginBottom: px(10) }}>
          {[
            ["Класс доспеха", m.ac, m.acNote],
            ["Хиты", m.hp, m.hitDice],
            ["Скорость", m.speed + " фт.", ""],
            ["Инициатива", m.initiative, ""],
            ["Мастерство", m.proficiency, ""],
          ].map(([title, value, note], i, arr) => (
            <View key={title} style={{ ...border, flexGrow: 1, flexBasis: 0, marginRight: i < arr.length - 1 ? px(8) : 0, height: px(60), paddingHorizontal: px(8), alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: px(10), letterSpacing: px(0.6), fontWeight: 600, color: color.soft }}>{String(title).toUpperCase()}</Text>
              <Text style={{ fontFamily: font.serif, fontWeight: 700, fontSize: px(24), marginTop: px(2) }}>{value}</Text>
              {note ? <Text style={{ fontSize: px(10), color: color.soft, textAlign: "center" }}>{note}</Text> : null}
            </View>
          ))}
        </View>
      ) : (
        <View style={{ flexDirection: "row", marginBottom: px(10) }}>
          <View style={{ ...border, width: px(104), alignItems: "center", paddingTop: px(5), paddingBottom: px(6), marginRight: px(8) }}>
            <Text style={{ fontSize: px(10.5), letterSpacing: px(0.6), fontWeight: 600 }}>КЛАСС ДОСПЕХА</Text>
            <Shield value={m.ac} />
            {m.acNote ? <Text style={{ fontSize: px(10.5), color: color.soft, marginTop: px(2), textAlign: "center" }}>{m.acNote}</Text> : null}
          </View>
          <View style={{ flexGrow: 1.4, flexBasis: 0, marginRight: px(8), flexDirection: "row" }}>
            <Stat title="Хиты">
              <Text style={{ fontFamily: font.serif, fontWeight: 700, fontSize: px(40) }}>{m.hp}</Text>
              <Text style={{ fontSize: px(13), color: color.soft, marginLeft: px(8) }}>({m.hitDice})</Text>
            </Stat>
          </View>
          <View style={{ flexGrow: 1, flexBasis: 0, marginRight: px(8), flexDirection: "row" }}>
            <Stat title="Скорость">
              <Text style={{ fontFamily: font.serif, fontWeight: 700, fontSize: px(40) }}>{m.speed}</Text>
              <Text style={{ fontSize: px(13), color: color.soft, marginLeft: px(6) }}>фт.</Text>
            </Stat>
          </View>
          <Stat title="Иниц." width={px(78)}>
            <Text style={{ fontFamily: font.serif, fontWeight: 700, fontSize: px(32) }}>{m.initiative}</Text>
          </Stat>
          <View style={{ width: px(8) }} />
          <Stat title="Мастерство" width={px(96)}>
            <Text style={{ fontFamily: font.serif, fontWeight: 700, fontSize: px(32) }}>{m.proficiency}</Text>
          </Stat>
        </View>

      )}
      {twoCol ? (
        <>
          {statsBand}
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, marginRight: px(10) }}>
              {skillsPanel}
              {leftBlocks.map((blk) => (
                <View key={blk.key} style={{ marginTop: px(10) }}>{blk.node}</View>
              ))}
            </View>
            <View style={{ flexGrow: 2, flexShrink: 1, flexBasis: 0 }}>
              {rightBlocks.map((blk) => (
                <View key={blk.key}>{blk.node}</View>
              ))}
            </View>
          </View>
        </>
      ) : (
        <>
          <View wrap={false} style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <View style={{ width: px(232), marginRight: px(10) }}>
              {abilitiesPanel}
              {skillsPanel}
            </View>
            <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>
              {savesPanel}
              {side.map((blk) => (
                <View key={blk.key}>{blk.node}</View>
              ))}
            </View>
          </View>
          {below.map((blk) => (
            <View key={blk.key} style={{ marginTop: px(10) }}>
              {blk.node}
            </View>
          ))}
        </>
      )}
    </Page>
  );
}

export function NpcDocument({ m }: { m: NpcCardModel }) {
  return (
    <Document title={`${m.name}: карточка NPC`} language="ru">
      <NpcPage m={m} />
    </Document>
  );
}
