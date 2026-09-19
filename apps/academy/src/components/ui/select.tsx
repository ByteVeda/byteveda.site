"use client";

import { cn } from "@byteveda/utils";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

export type SelectOption<T extends string> = { value: T; label: string };

type SelectProps<T extends string> = {
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  id?: string;
  labelledBy?: string;
  className?: string;
};

/**
 * A combobox over a listbox, not a native `<select>`.
 *
 * The option popup of a native select is drawn by the platform: it ignores
 * `data-theme`, so on this site's dark default it renders as whatever the OS
 * thinks a menu looks like — white-on-white in one browser, blue highlight
 * with unreadable text in another. Everything else about a select is worth
 * keeping, so this reimplements the keyboard contract rather than the looks.
 */
export function Select<T extends string>({
  value,
  options,
  onChange,
  id,
  labelledBy,
  className,
}: SelectProps<T>) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selected = options[selectedIndex];

  // Pointer, not click: closing on `pointerdown` means a click that lands
  // outside does not also activate whatever was under it a frame later.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function show() {
    setActive(selectedIndex);
    setOpen(true);
  }

  function pick(index: number) {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
    button.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        if (!open) {
          show();
          return;
        }
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActive((current) => (current + step + options.length) % options.length);
        return;
      }
      case "Home":
        if (open) {
          event.preventDefault();
          setActive(0);
        }
        return;
      case "End":
        if (open) {
          event.preventDefault();
          setActive(options.length - 1);
        }
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        if (open) pick(active);
        else show();
        return;
      case "Escape":
        if (open) {
          event.preventDefault();
          setOpen(false);
        }
        return;
      case "Tab":
        setOpen(false);
        return;
      default:
    }
  }

  return (
    <div className={cn("select", className)} ref={root}>
      <button
        type="button"
        id={id}
        ref={button}
        className="select-btn"
        role="combobox"
        aria-controls={listId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-labelledby={labelledBy}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
      >
        <span>{selected?.label}</span>
        <svg
          className="chev"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div
          className="select-list"
          id={listId}
          ref={list}
          role="listbox"
          aria-labelledby={labelledBy}
        >
          {options.map((option, index) => (
            // The listbox owns no focus: the combobox button keeps it and
            // points here with `aria-activedescendant`, so every key press is
            // already handled on the button. Hence no handler on the option.
            // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard lives on the combobox button.
            <div
              key={option.value}
              id={`${listId}-${index}`}
              className="select-opt"
              role="option"
              // Reachable programmatically, never by Tab — focus stays on the button.
              tabIndex={-1}
              aria-selected={option.value === value}
              data-active={index === active}
              onPointerEnter={() => setActive(index)}
              onClick={() => pick(index)}
            >
              {option.label}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
