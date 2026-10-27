import { useEffect, useMemo, useRef, useState } from "react";
import { build, deliver, slug } from "./build.js";
import { Icon } from "./icons.js";
import { KIND_RU, creatures } from "./LibraryPage.js";
import type { SavedCard } from "./library.js";
import { exportPdf, type ExportResult } from "./pdf.js";
import type { ExportMode, Settings } from "./settings.js";
import { Check, Modal, Segmented, Switch } from "./ui.js";

interface Props {
  cards: SavedCard[];
  /** Название полки для имени файла по умолчанию. */
  scopeName?: string;
  settings: Settings;
  onClose(): void;
  onToast(text: string): void;
}

const MODES = [
  { value: "print", label: "Постранично · печать" },
  { value: "screen", label: "Целый экран · для устройств" },
];

export function ExportDialog({ cards, scopeName, settings, onClose, onToast }: Props) {
  const [mode, setMode] = useState<ExportMode>(settings.exportMode);
  const [picked, setPicked] = useState<Set<string>>(new Set(cards.map((c) => c.id)));
  const [lss, setLss] = useState(false);
  const base = cards.length === 1 ? cards[0].name : (scopeName ?? "Кодекс");
  const [file, setFile] = useState(`${settings.translit ? slug(base) : base}.pdf`);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const seq = useRef(0);

  const chosen = useMemo(() => cards.filter((c) => picked.has(c.id)), [cards, picked]);
  const chars = chosen.filter((c) => c.kind === "character");

  useEffect(() => {
    const my = ++seq.current;
    setBusy(true);
    setError("");
    exportPdf(chosen, mode)
      .then((r) => my === seq.current && setResult(r))
      .catch((e) => my === seq.current && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => my === seq.current && setBusy(false));
  }, [chosen, mode]);

  const total = chosen.reduce((n, c) => n + (result?.pages[c.id] ?? 0), 0);
  const fileName = file.trim().toLowerCase().endsWith(".pdf") ? file.trim() : `${file.trim() || "kodeks"}.pdf`;

  function toggle(id: string) {
    setPicked((s) => {
      const n = new Set(s);
      if (!n.delete(id)) n.add(id);
      return n;
    });
  }

  async function save() {
    if (!result || !chosen.length) return;
    await deliver(fileName, result.blob);
    if (lss) {
      for (const c of chars) {
        const out = await build(c.json);
        if (out.status === "ok" && out.lssJson) await deliver(`${settings.translit ? slug(c.name) : c.name}.lss.json`, new Blob([out.lssJson], { type: "application/json" }));
      }
    }
    onToast("Файл сохранён");
    onClose();
  }

  const thumbs = chosen.flatMap((c) => Array.from({ length: result?.pages[c.id] ?? 1 }, (_, i) => ({ key: `${c.id}-${i}`, name: c.name, n: 7 + ((c.name.length + i) % 3) * 2 })));

  return (
    <Modal title="Экспорт PDF" onClose={onClose} aside={creatures(cards.length)}>
      <div className="xm m-only">
        <p className="xlb">Как оформить</p>
        <div className="xmodes" role="radiogroup" aria-label="Режим">
          <button type="button" role="radio" aria-checked={mode === "print"} className={`xmode${mode === "print" ? " on" : ""}`} onClick={() => setMode("print")}>
            <span className="xill"><i className="pg" /><i className="pg" /></span>
            <b>Постранично</b>
            <span>Листы A4 для печати, чёрно-белые</span>
          </button>
          <button type="button" role="radio" aria-checked={mode === "screen"} className={`xmode${mode === "screen" ? " on" : ""}`} onClick={() => setMode("screen")}>
            <span className="xill"><i className="pg tall" /></span>
            <b>Целый экран</b>
            <span>Один длинный лист, удобно читать с телефона</span>
          </button>
        </div>
        <p className="xlb">Что войдёт в файл</p>
        <div className="xlist">
          {chosen.map((c) => (
            <div key={c.id} className="xit">
              <span className="av sm">{c.name.trim().charAt(0).toUpperCase()}</span>
              <span className="xnm">{c.name}</span>
              <em>{result ? `${result.pages[c.id] ?? 1} стр.` : "…"}</em>
            </div>
          ))}
          <div className="xit total">
            <span className="xnm">Итого один файл</span>
            <em>{busy ? "считаю…" : `${total} стр.`}</em>
          </div>
        </div>
      </div>
      <div className="d-only">
      <div className="lb dlg-lb">Режим</div>
      <Segmented value={mode} options={MODES} onChange={(v) => setMode(v as ExportMode)} ariaLabel="Режим" />
      <p className="mute small dlg-note">
        {mode === "print" ? "A4, чёрный текст на белом фоне, без водяных знаков и колонтитулов." : "Один длинный лист на существо: удобно читать с телефона и планшета."}
      </p>
      <div className="dlg-cols">
        <div className="grow">
          <div className="lb">
            Что выгрузить · {chosen.length} из {cards.length}
          </div>
          <div className="dlg-list">
            {cards.map((c) => (
              <div key={c.id} className="dlg-row">
                <Check checked={picked.has(c.id)} onChange={() => toggle(c.id)} label={`Выгрузить ${c.name}`} />
                <span className="av sm">{c.name.trim().charAt(0).toUpperCase()}</span>
                <span className="dlg-name">{c.name}</span>
                <span className="mute small">{picked.has(c.id) && result ? `${result.pages[c.id] ?? 1} стр.` : KIND_RU[c.kind]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="dlg-prev">
          <div className="lb">Предпросмотр · {busy ? "считаю…" : `${total} ${total % 10 === 1 && total !== 11 ? "страница" : total % 10 >= 2 && total % 10 <= 4 && (total < 12 || total > 14) ? "страницы" : "страниц"}`}</div>
          <div className="thumbs">
            {thumbs.map((t) => (
              <div key={t.key} className={`thumb${mode === "screen" ? " tall" : ""}`}>
                <div className="tn">{t.name}</div>
                <div className="tr1" />
                {Array.from({ length: t.n }, (_, i) => (
                  <div key={i} className="tl1" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
      {chars.length > 0 && (
        <div className="dlg-opt">
          <Switch checked={lss} onChange={setLss} label="Также файлы для Long Story Short (персонажи)" tone="accent" />
        </div>
      )}
      <label className="fld wide dlg-file d-only">
        <span>Имя файла</span>
        <input className="mono" value={file} onChange={(e) => setFile(e.target.value)} spellCheck={false} />
      </label>
      {error && <p className="errc dlg-note">Не удалось собрать PDF: {error}</p>}
      <button type="button" className="xsave m-only" disabled={busy || !chosen.length || !!error} onClick={() => void save()}>
        <Icon name="share" size={18} /> {busy ? "Собираю…" : "Сохранить или отправить"}
      </button>
      <p className="xfile m-only">Файл: {fileName}</p>
      <div className="modal-foot d-only">
        <button type="button" className="btn" onClick={onClose}>
          Отмена
        </button>
        <button type="button" className="btn accent" disabled={busy || !chosen.length || !!error} onClick={() => void save()}>
          <Icon name="download" /> {busy ? "Собираю…" : "Сохранить PDF"}
        </button>
      </div>
    </Modal>
  );
}
