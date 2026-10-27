/** Таблица «Создание монстров» из DMG (2014): ожидаемые показатели по опасности. */

export interface CrRow {
  cr: string;
  value: number;
  proficiency: number;
  ac: number;
  hpMin: number;
  hpMax: number;
  attack: number;
  dprMin: number;
  dprMax: number;
  saveDc: number;
  xp: number;
}

// cr, prof, ac, hpMin, hpMax, attack, dprMin, dprMax, dc, xp
const RAW: [string, number, number, number, number, number, number, number, number, number][] = [
  ["0", 2, 13, 1, 6, 3, 0, 1, 13, 10],
  ["1/8", 2, 13, 7, 35, 3, 2, 3, 13, 25],
  ["1/4", 2, 13, 36, 49, 3, 4, 5, 13, 50],
  ["1/2", 2, 13, 50, 70, 3, 6, 8, 13, 100],
  ["1", 2, 13, 71, 85, 3, 9, 14, 13, 200],
  ["2", 2, 13, 86, 100, 3, 15, 20, 13, 450],
  ["3", 2, 13, 101, 115, 4, 21, 26, 13, 700],
  ["4", 2, 14, 116, 130, 5, 27, 32, 14, 1100],
  ["5", 3, 15, 131, 145, 6, 33, 38, 15, 1800],
  ["6", 3, 15, 146, 160, 6, 39, 44, 15, 2300],
  ["7", 3, 15, 161, 175, 6, 45, 50, 15, 2900],
  ["8", 3, 16, 176, 190, 7, 51, 56, 16, 3900],
  ["9", 4, 16, 191, 205, 7, 57, 62, 16, 5000],
  ["10", 4, 17, 206, 220, 7, 63, 68, 16, 5900],
  ["11", 4, 17, 221, 235, 8, 69, 74, 17, 7200],
  ["12", 4, 17, 236, 250, 8, 75, 80, 17, 8400],
  ["13", 5, 18, 251, 265, 8, 81, 86, 18, 10000],
  ["14", 5, 18, 266, 280, 8, 87, 92, 18, 11500],
  ["15", 5, 18, 281, 295, 8, 93, 98, 18, 13000],
  ["16", 5, 18, 296, 310, 9, 99, 104, 18, 15000],
  ["17", 6, 19, 311, 325, 10, 105, 110, 19, 18000],
  ["18", 6, 19, 326, 340, 10, 111, 116, 19, 20000],
  ["19", 6, 19, 341, 355, 10, 117, 122, 19, 22000],
  ["20", 6, 19, 356, 400, 10, 123, 140, 19, 25000],
  ["21", 7, 19, 401, 445, 11, 141, 158, 20, 33000],
  ["22", 7, 19, 446, 490, 11, 159, 176, 20, 41000],
  ["23", 7, 19, 491, 535, 11, 177, 194, 20, 50000],
  ["24", 7, 19, 536, 580, 12, 195, 212, 21, 62000],
  ["25", 8, 19, 581, 625, 12, 213, 230, 21, 75000],
  ["26", 8, 19, 626, 670, 12, 231, 248, 21, 90000],
  ["27", 8, 19, 671, 715, 13, 249, 266, 22, 105000],
  ["28", 8, 19, 716, 760, 13, 267, 284, 22, 120000],
  ["29", 8, 19, 761, 805, 13, 285, 302, 22, 135000],
  ["30", 8, 19, 806, 850, 14, 303, 320, 23, 155000],
];

export const CR_TABLE: CrRow[] = RAW.map(([cr, proficiency, ac, hpMin, hpMax, attack, dprMin, dprMax, saveDc, xp]) => ({
  cr, value: crValue(cr), proficiency, ac, hpMin, hpMax, attack, dprMin, dprMax, saveDc, xp,
}));

export function crValue(cr: string): number {
  if (cr.includes("/")) {
    const [a, b] = cr.split("/").map(Number);
    return a / b;
  }
  return Number(cr);
}

export const crRow = (cr: string): CrRow => {
  const row = CR_TABLE.find((r) => r.cr === cr);
  if (!row) throw new Error(`Неизвестная опасность: ${cr}`);
  return row;
};

const indexOfCr = (cr: string): number => CR_TABLE.findIndex((r) => r.cr === cr);

/** Строка таблицы по хитам; за пределами диапазона берётся крайняя. */
function rowByHp(hp: number): number {
  const i = CR_TABLE.findIndex((r) => hp <= r.hpMax);
  return i === -1 ? CR_TABLE.length - 1 : i;
}

function rowByDpr(dpr: number): number {
  const i = CR_TABLE.findIndex((r) => dpr <= r.dprMax);
  return i === -1 ? CR_TABLE.length - 1 : i;
}

const clamp = (i: number) => Math.max(0, Math.min(CR_TABLE.length - 1, i));
/** DMG: за каждые 2 единицы отклонения ± одна ступень. */
const steps = (diff: number) => Math.trunc(diff / 2);

export interface CrCheck {
  declared: string;
  defensive: string;
  offensive: string;
  calculated: string;
  /** Разница по числу ступеней между заявленной и расчётной опасностью. */
  difference: number;
  status: "ok" | "tolerable" | "mismatch";
  /** Пояснения для вывода. */
  details: string[];
}

export interface CrInputs {
  hp: number;
  ac: number;
  /** Урон за раунд при попадании всеми атаками (мультиатака или лучшее действие). */
  damagePerRound: number;
  /** Бонус атаки основной атаки или Сл эффекта, который даёт этот урон. */
  offensiveValue: number;
  offensiveKind: "attack" | "save";
  declaredCr: string;
}

export function checkCr(i: CrInputs): CrCheck {
  const details: string[] = [];

  let d = rowByHp(i.hp);
  const expectedAc = CR_TABLE[d].ac;
  d = clamp(d + steps(i.ac - expectedAc));
  details.push(`Хиты ${i.hp} дают опасность ${CR_TABLE[rowByHp(i.hp)].cr}; КД ${i.ac} против ожидаемых ${expectedAc} сдвигает защиту до ${CR_TABLE[d].cr}.`);

  let o = rowByDpr(i.damagePerRound);
  const expected = i.offensiveKind === "attack" ? CR_TABLE[o].attack : CR_TABLE[o].saveDc;
  const label = i.offensiveKind === "attack" ? "бонус атаки" : "Сл";
  o = clamp(o + steps(i.offensiveValue - expected));
  details.push(`Урон за раунд ${round1(i.damagePerRound)} даёт опасность ${CR_TABLE[rowByDpr(i.damagePerRound)].cr}; ${label} ${i.offensiveValue} против ожидаемых ${expected} сдвигает нападение до ${CR_TABLE[o].cr}.`);

  const avg = (CR_TABLE[d].value + CR_TABLE[o].value) / 2;
  const calcIndex = nearestIndexByValue(avg);
  const declaredIndex = indexOfCr(i.declaredCr);
  const difference = declaredIndex - calcIndex;
  const abs = Math.abs(difference);
  const status = abs === 0 ? "ok" : abs <= 1 ? "tolerable" : "mismatch";
  return {
    declared: i.declaredCr,
    defensive: CR_TABLE[d].cr,
    offensive: CR_TABLE[o].cr,
    calculated: CR_TABLE[calcIndex].cr,
    difference,
    status,
    details,
  };
}

/** Среднее значений CR округляется до ближайшей строки таблицы (середина идёт вверх). */
function nearestIndexByValue(v: number): number {
  let best = 0;
  let bestDist = Infinity;
  CR_TABLE.forEach((r, idx) => {
    const dist = Math.abs(r.value - v);
    if (dist < bestDist || (dist === bestDist && r.value > CR_TABLE[best].value)) {
      best = idx;
      bestDist = dist;
    }
  });
  return best;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
