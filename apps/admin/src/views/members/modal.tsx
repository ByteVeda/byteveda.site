"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";

/**
 * The shell the two access dialogs share.
 *
 * `ConfirmProvider` already wraps `<dialog>`, but it answers one question with
 * a yes or a no. These are forms: they hold a draft, they are cancelled rather
 * than declined, and closing one has to throw the draft away. Rather than
 * bending the confirm dialog into a form host, this is the same platform
 * element with the same manners — focus trapped, Escape closes, the page
 * behind it inert, backdrop click dismisses — wrapped around arbitrary
 * children.
 *
 * Mounted only while open, so each opening starts from a fresh draft instead
 * of whatever the last one was left on.
 */
export function Modal({
  title,
  sub,
  onClose,
  children,
  footer,
}: {
  title: string;
  /** Who or what is being edited. Sits under the title, not in it. */
  sub?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // `showModal()` rather than the `open` attribute: only the method makes the
  // page behind inert and gives us the backdrop and the focus trap.
  useEffect(() => {
    const element = dialog.current;
    if (!element?.open) element?.showModal();
  }, []);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the keyboard route out is Escape, handled by onCancel; the click handler only adds pointer dismissal on the backdrop
    <dialog
      ref={dialog}
      className="dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      <div className="dialog-card dialog-card-wide">
        <header className="dialog-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {sub && <p className="dialog-sub">{sub}</p>}
          </div>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Close">
            <X width={15} height={15} aria-hidden />
          </button>
        </header>

        <div className="dialog-body">{children}</div>

        <div className="dialog-actions">{footer}</div>
      </div>
    </dialog>
  );
}
