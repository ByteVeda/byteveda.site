"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export type ConfirmOptions = {
  title: string;
  /** What will happen, and what cannot be undone. */
  body?: string;
  /** Names the action, matching the button that opened the dialog. */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive. */
  destructive?: boolean;
};

type Ask = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Ask | null>(null);

/**
 * Replaces `window.confirm`, which cannot be styled, blocks the main thread,
 * and in some browsers renders a checkbox letting the person suppress every
 * future one — including the next destructive prompt.
 *
 * Built on `<dialog>` so focus trapping, Escape, inertness of the page behind,
 * and the backdrop come from the platform rather than from us.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const decide = useRef<((confirmed: boolean) => void) | null>(null);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);

  const ask = useCallback<Ask>((next) => {
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      decide.current = resolve;
    });
  }, []);

  useEffect(() => {
    if (options) dialog.current?.showModal();
  }, [options]);

  const settle = useCallback((confirmed: boolean) => {
    decide.current?.(confirmed);
    decide.current = null;
    dialog.current?.close();
    setOptions(null);
  }, []);

  return (
    <ConfirmContext.Provider value={ask}>
      {children}

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: the keyboard route out is Escape, handled by onCancel; the click handler only adds pointer dismissal on the backdrop */}
      <dialog
        ref={dialog}
        className="dialog"
        aria-labelledby="confirm-title"
        // Escape and the close button both land here, so a dismissed dialog
        // always resolves rather than leaving the caller awaiting forever.
        onCancel={(event) => {
          event.preventDefault();
          settle(false);
        }}
        onClose={() => decide.current?.(false)}
        // The dialog element fills the viewport; a click that lands on it
        // rather than on the card is a click on the backdrop.
        onClick={(event) => {
          if (event.target === dialog.current) settle(false);
        }}
      >
        {options && (
          <div className="dialog-card">
            <h2 id="confirm-title">{options.title}</h2>
            {options.body && <p>{options.body}</p>}

            <div className="dialog-actions">
              <button type="button" className="abtn abtn-quiet" onClick={() => settle(false)}>
                {options.cancelLabel ?? "Cancel"}
              </button>
              <button
                type="button"
                className={`abtn ${options.destructive ? "abtn-danger-solid" : "abtn-primary"}`}
                onClick={() => settle(true)}
                // The dialog opens because someone chose an action; the
                // confirming button is where their attention already is.
                // biome-ignore lint/a11y/noAutofocus: focus belongs in the dialog on open
                autoFocus
              >
                {options.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </ConfirmContext.Provider>
  );
}

/** Returns a function that resolves true when the operator confirms. */
export function useConfirm(): Ask {
  const ask = useContext(ConfirmContext);
  if (!ask) throw new Error("useConfirm must be used inside a ConfirmProvider.");
  return ask;
}
