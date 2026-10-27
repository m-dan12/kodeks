import {
  createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "./icons.js";

/* ---------- Ширина боковых панелей ---------- */

/** Ширина панели запоминается на этом устройстве; значение всегда в пределах min..max. */
export function usePanelWidth(key: string, def: number, min: number, max: number): [number, (v: number) => void, () => void] {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v)));
  const [w, setW] = useState(() => {
    try {
      const raw = Number(localStorage.getItem(`dnd-cards.w.${key}`));
      return raw ? clamp(raw) : def;
    } catch {
      return def;
    }
  });
  const set = useCallback(
    (v: number) => {
      const next = Math.min(max, Math.max(min, Math.round(v)));
      setW(next);
      try {
        localStorage.setItem(`dnd-cards.w.${key}`, String(next));
      } catch {
        /* хранилище недоступно */
      }
    },
    [key, min, max],
  );
  return [w, set, () => set(def)];
}

interface ResizerProps {
  value: number;
  min: number;
  max: number;
  onChange(v: number): void;
  onReset(): void;
  /** left: панель слева от разделителя (тянем вправо, она растёт); right: панель справа (тянем влево, она растёт). */
  side: "left" | "right";
  label: string;
  className?: string;
}

/** Вертикальный разделитель: тянется мышью или пальцем, двигается стрелками, двойной щелчок возвращает ширину по умолчанию. */
export function Resizer({ value, min, max, onChange, onReset, side, label, className = "" }: ResizerProps) {
  const [drag, setDrag] = useState(false);
  const start = useRef({ x: 0, w: 0 });
  const sign = side === "left" ? 1 : -1;

  function onDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, w: value };
    setDrag(true);
    document.body.classList.add("resizing");
  }
  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (drag) onChange(start.current.w + sign * (e.clientX - start.current.x));
  }
  function onUp() {
    setDrag(false);
    document.body.classList.remove("resizing");
  }
  function onKey(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 48 : 16;
    if (e.key === "ArrowLeft") onChange(value - sign * step);
    else if (e.key === "ArrowRight") onChange(value + sign * step);
    else if (e.key === "Home") onChange(min);
    else if (e.key === "End") onChange(max);
    else if (e.key === "Enter") onReset();
    else return;
    e.preventDefault();
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      className={`rz${drag ? " drag" : ""} ${className}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onDoubleClick={onReset}
      onKeyDown={onKey}
    />
  );
}

/* ---------- Выпадающий список ---------- */

export interface Option {
  value: string;
  label: string;
  icon?: IconName;
}

interface DropdownProps {
  value: string;
  options: Option[];
  onChange(value: string): void;
  ariaLabel: string;
  /** Подпись на кнопке вместо выбранного пункта (например, «Переместить»). */
  label?: string;
  icon?: IconName;
  /** pill — кнопка-таблетка как в макете; field — поле формы на всю ширину; ghost — кнопка на тёмной панели. */
  variant?: "pill" | "field" | "ghost";
  placeholder?: string;
}

/** Собственный выпадающий список: меню рисуется поверх страницы, управляется стрелками, Enter и Esc. */
export function Dropdown({ value, options, onChange, ariaLabel, label, icon, variant = "pill", placeholder }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; up: boolean }>({ left: 0, top: 0, width: 0, up: false });
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const current = options.find((o) => o.value === value);

  const close = useCallback((focus = true) => {
    setOpen(false);
    if (focus) btn.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const h = Math.min(options.length * 36 + 12, 320);
    const up = r.bottom + h + 8 > window.innerHeight && r.top > h;
    setPos({ left: r.left, top: up ? r.top - 6 : r.bottom + 6, width: r.width, up });
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    const onDown = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) close(false);
    };
    const onMove = () => close(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", onMove);
    document.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", onMove);
      document.removeEventListener("scroll", onMove, true);
    };
  }, [open, options, value, close]);

  function onKey(e: React.KeyboardEvent) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Home") {
      setActive(0);
    } else if (e.key === "End") {
      setActive(options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(options[active]);
    } else if (e.key === "Tab") {
      close(false);
    }
  }

  function pick(o: Option | undefined) {
    if (!o) return;
    onChange(o.value);
    close();
  }

  const shown = label ?? current?.label ?? placeholder ?? "—";
  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`dd dd-${variant}${open ? " is-open" : ""}`}
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKey}
      >
        {(icon ?? current?.icon) && <Icon name={(icon ?? current?.icon)!} size={16} />}
        <span className="dd-text">{shown}</span>
        <Icon name="chevron" size={14} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={id}
            role="listbox"
            aria-label={ariaLabel}
            className="dd-menu"
            style={{ left: pos.left, minWidth: Math.max(pos.width, 160), ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }) }}
          >
            {options.map((o, i) => (
              <div
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                className={`dd-opt${i === active ? " act" : ""}${o.value === value ? " sel" : ""}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o)}
              >
                {o.icon && <Icon name={o.icon} size={16} />}
                <span>{o.label}</span>
                {o.value === value && <Icon name="check" size={14} />}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

/* ---------- Переключатель и флажок ---------- */

export function Switch({ checked, onChange, label, tone = "dark" }: { checked: boolean; onChange(v: boolean): void; label?: string; tone?: "dark" | "accent" }) {
  return (
    <label className={`switch ${tone}`}>
      {label}
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <i aria-hidden="true" />
    </label>
  );
}

export function Check({ checked, onChange, label }: { checked: boolean; onChange(v: boolean): void; label: string }) {
  return (
    <label className="cbx">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span className="cbx-box" aria-hidden="true">
        <Icon name="check" size={13} />
      </span>
    </label>
  );
}

/** Сегментный переключатель из макета настроек и экспорта. */
export function Segmented({ value, options, onChange, ariaLabel }: { value: string; options: { value: string; label: string }[]; onChange(v: string): void; ariaLabel: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className={o.value === value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Окна ---------- */

export function Modal({ title, onClose, children, width = 760, aside }: { title: string; onClose(): void; children: ReactNode; width?: number; aside?: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>("[data-autofocus], button, input, select, textarea")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "Tab" && box.current) {
        const items = [...box.current.querySelectorAll<HTMLElement>("button:not(:disabled), input, select, textarea, [tabindex]:not([tabindex='-1'])")];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      prev?.focus?.();
    };
  }, [onClose]);
  return createPortal(
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} role="dialog" aria-modal="true" aria-label={title} className="modal" style={{ width }}>
        <div className="modal-head">
          <h2>{title}</h2>
          {aside && <span className="modal-aside">{aside}</span>}
          <button type="button" className="ib bd" aria-label="Закрыть" data-tip="Закрыть" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

interface ConfirmOptions {
  title?: string;
  ok?: string;
  danger?: boolean;
}
type Ask = (message: string, opts?: ConfirmOptions) => Promise<boolean>;
const ConfirmCtx = createContext<Ask>(async () => false);

export const useConfirm = (): Ask => useContext(ConfirmCtx);

/** Подтверждение в стиле приложения вместо системного окна confirm(). */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ message: string; opts: ConfirmOptions; done(v: boolean): void } | null>(null);
  const ask: Ask = useCallback((message, opts = {}) => new Promise((resolve) => setState({ message, opts, done: resolve })), []);
  const finish = (v: boolean) => {
    state?.done(v);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      {state && (
        <Modal title={state.opts.title ?? "Подтвердите действие"} onClose={() => finish(false)} width={460}>
          <p className="confirm-text">{state.message}</p>
          <div className="modal-foot">
            <button type="button" className="btn" onClick={() => finish(false)}>
              Отмена
            </button>
            <button type="button" className={`btn ${state.opts.danger ? "danger" : "dark"}`} data-autofocus onClick={() => finish(true)}>
              {state.opts.ok ?? "Да"}
            </button>
          </div>
        </Modal>
      )}
    </ConfirmCtx.Provider>
  );
}
