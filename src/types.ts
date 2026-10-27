/** Типы карточек. Повторяют schema/*.schema.json в той части, которую читает расчётное ядро. */

export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";
export type Abilities = Record<AbilityKey, number>;

export type SkillKey =
  | "acrobatics" | "animal_handling" | "arcana" | "athletics" | "deception" | "history"
  | "insight" | "intimidation" | "investigation" | "medicine" | "nature" | "perception"
  | "performance" | "persuasion" | "religion" | "sleight_of_hand" | "stealth" | "survival";

export type ClassKey =
  | "barbarian" | "bard" | "cleric" | "druid" | "fighter" | "monk"
  | "paladin" | "ranger" | "rogue" | "sorcerer" | "warlock" | "wizard";

export type DamageType =
  | "acid" | "bludgeoning" | "cold" | "fire" | "force" | "lightning" | "necrotic"
  | "piercing" | "poison" | "psychic" | "radiant" | "slashing" | "thunder";

export interface Source {
  type: "official" | "custom";
  book?: string;
  note?: string;
}

export interface Usage {
  type: "at_will" | "per_day" | "per_rest" | "recharge";
  times?: number;
  rest?: "short" | "long";
  recharge_min?: number;
}

export interface DamagePart {
  dice: string;
  type: DamageType;
  ability?: AbilityKey;
  bonus?: number;
  scales_with_level?: "cantrip";
}

export interface ClassLevel {
  class: ClassKey;
  subclass?: string;
  level: number;
}

export interface Speed {
  walk?: number;
  burrow?: number;
  climb?: number;
  fly?: number;
  swim?: number;
  hover?: boolean;
}

export interface Defense {
  armor?: { name: string; base: number; dex?: "full" | "max_2" | "none"; magic_bonus?: number };
  shield?: boolean;
  other_bonus?: number;
  override?: { value: number; note?: string };
}

export interface Weapon {
  name: string;
  melee: boolean;
  damage: { dice: string; type: DamageType };
  ability?: AbilityKey;
  versatile_dice?: string;
  properties?: string[];
  range_normal?: number;
  range_long?: number;
  magic_bonus?: number;
  damage_bonus?: number;
  crit_range?: number;
  proficient?: boolean;
  note?: string;
  source?: Source;
}

export interface Feature {
  name: string;
  text: string;
  origin: { type: "class" | "race" | "background" | "feat" | "item" | "other"; class?: ClassKey; level?: number };
  usage?: Usage;
  source?: Source;
}

export interface Spell {
  name: string;
  name_en?: string;
  level: number;
  school?: string;
  prepared?: boolean;
  ritual?: boolean;
  concentration?: boolean;
  attack?: { attack_type: "melee_spell" | "ranged_spell"; range?: number; damage: DamagePart[] };
  source: Source;
}

export interface SpellcastingEntry {
  class: ClassKey;
  ability?: AbilityKey;
  spells: Spell[];
}

export interface EquipmentItem {
  name: string;
  quantity?: number;
  note?: string;
  magic?: boolean;
  description?: string;
}

export interface Relationship {
  name: string;
  relation: string;
}

/** Общая часть NPC и персонажа игрока: то, из чего считается механика. */
export interface Build {
  kind: "npc" | "character";
  source?: Source;
  dm_notes?: { kind: string; text: string }[];
  name: string;
  race: { name: string; size?: "small" | "medium" };
  background?: string;
  alignment?: string;
  classes: ClassLevel[];
  abilities: Abilities;
  speed?: Speed;
  hit_points?: { override?: number };
  defense?: Defense;
  skill_proficiencies?: { skill: SkillKey; expertise?: boolean }[];
  save_proficiencies?: AbilityKey[];
  proficiencies?: { armor?: string[]; weapons?: string[]; tools?: string[] };
  languages?: string[];
  weapons?: Weapon[];
  features?: Feature[];
  spellcasting?: SpellcastingEntry[];
  equipment?: {
    items?: EquipmentItem[];
    currency?: { cp?: number; sp?: number; ep?: number; gp?: number; pp?: number };
  };
}

export interface Character extends Build {
  kind: "character";
  player_name?: string;
  experience?: number;
  body?: { age?: string; height?: string; weight?: string; eyes?: string; skin?: string; hair?: string };
  personality: {
    appearance?: string;
    traits: string;
    ideals: string;
    bonds: string;
    flaws: string;
    backstory: string;
    goals?: string;
    relationships?: Relationship[];
  };
  inspiration?: boolean;
}

export interface Npc extends Build {
  kind: "npc";
  role?: string;
  roleplay?: { speech?: string; wants?: string; hides?: string; in_combat?: string };
  personality?: Partial<Character["personality"]>;
}

export type MonsterSize = "tiny" | "small" | "medium" | "large" | "huge" | "gargantuan";

export interface ActionBase {
  usage?: Usage;
  legendary_cost?: number;
  source?: Source;
}

export interface AttackAction extends ActionBase {
  kind: "attack";
  id: string;
  name: string;
  attack_type: "melee_weapon" | "ranged_weapon" | "melee_spell" | "ranged_spell";
  ability: AbilityKey;
  proficient?: boolean;
  to_hit_bonus?: number;
  reach?: number;
  range_normal?: number;
  range_long?: number;
  targets?: string;
  damage: DamagePart[];
  on_hit_text?: string;
}

export interface SaveAction extends ActionBase {
  kind: "save";
  id: string;
  name: string;
  area?: string;
  save_ability: AbilityKey;
  dc: { mode: "auto"; ability: AbilityKey } | { mode: "fixed"; value: number };
  damage?: DamagePart[];
  on_success?: "half" | "none" | "special";
  effect_text?: string;
}

export interface MultiattackAction extends ActionBase {
  kind: "multiattack";
  name?: string;
  text: string;
  plan: { ref: string; count: number }[];
}

export interface TextAction extends ActionBase {
  kind: "text";
  name: string;
  text: string;
}

export type MonsterAction = AttackAction | SaveAction | MultiattackAction | TextAction;

export interface Monster {
  kind: "monster";
  name: string;
  name_en?: string;
  size: MonsterSize;
  type: string;
  subtype?: string;
  alignment: string;
  armor_class: { value: number; note?: string };
  hit_dice: { count: number; die: number };
  hp_override?: number;
  speed: Speed;
  abilities: Abilities;
  saving_throws?: AbilityKey[];
  skills?: { skill: SkillKey; expertise?: boolean }[];
  damage_vulnerabilities?: DamageType[];
  damage_resistances?: DamageType[];
  damage_immunities?: DamageType[];
  damage_notes?: string;
  condition_immunities?: string[];
  senses?: { blindsight?: number; darkvision?: number; tremorsense?: number; truesight?: number; blind_beyond?: boolean };
  languages?: string[];
  languages_note?: string;
  challenge_rating: string;
  traits?: { name: string; text: string; usage?: Usage; source?: Source }[];
  actions?: MonsterAction[];
  bonus_actions?: MonsterAction[];
  reactions?: MonsterAction[];
  legendary_actions?: { per_round?: number; intro?: string; actions: MonsterAction[] };
  lair?: { description?: string; lair_actions?: string[]; regional_effects?: string[] };
  description?: string;
  tactics?: string;
  dm_notes?: { kind: string; text: string }[];
  source: Source;
}
