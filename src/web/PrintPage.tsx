import { useEffect, useRef, useState } from "react";
import { native } from "./build.js";
import { Icon } from "./icons.js";
import type { SavedCard } from "./library.js";
import { exportPdf } from "./pdf.js";

interface Props {
  card: SavedCard;
  onBack(): void;
  onExport(): void;
}

/** Печатная версия: страницы A4, чёрный текст на белом фоне, как в макете. */
export function PrintPage({ card, onBack, onExport }: Props) {
  const [url, setUrl] = useState("");
  const [pages, setPages] = useState(0);
  const [error, setError] = useState("");
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let alive = true;
    let made = "";
    exportPdf([card], "print")
      .then((r) => {
        if (!alive) return;
        made = URL.createObjectURL(r.blob);
        setUrl(made);
        setPages(r.pages[card.id] ?? 1);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [card]);

  return (
    <>
      <div className="cbar">
        <nav className="crumbs2" aria-label="Путь">
          <button type="button" onClick={onBack}>
            {card.name}
          </button>
          <Icon name="right" size={12} />
          <b>Печать</b>
        </nav>
        <button type="button" className="btn" onClick={onExport}>
          <Icon name="download" /> Сохранить PDF
        </button>
        {!native && (
          <button type="button" className="btn accent" disabled={!url} onClick={() => frame.current?.contentWindow?.print()}>
            <Icon name="print" /> Печать
          </button>
        )}
      </div>
      <div className="lhead">
        <h1 className="ph1">Печатная версия</h1>
        <span className="tag">A4 · ч/б{pages ? ` · ${pages} стр.` : ""}</span>
      </div>
      <div className="printarea">
        {error ? <p className="errc">Не удалось собрать PDF: {error}</p> : url ? <iframe ref={frame} title="Печатная версия" src={url} /> : <p className="mute">Собираю страницы…</p>}
      </div>
    </>
  );
}
