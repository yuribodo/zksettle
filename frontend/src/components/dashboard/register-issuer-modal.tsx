"use client";

import { Xmark } from "iconoir-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

export function RegisterIssuerModal() {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (dialog.open) dialog.close();
    setIsOpen(false);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => setIsOpen(false);
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  return (
    <>
      <Button variant="primary" size="sm" onClick={open}>
        Register issuer →
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby="register-issuer-title"
        className="rounded-[var(--radius-10)] border border-border-subtle bg-canvas p-0 text-ink backdrop:bg-ink/40"
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
      >
        {isOpen ? (
          <div className="flex min-w-[340px] flex-col gap-6 p-6 md:min-w-[440px]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="register-issuer-title" className="font-display text-2xl text-ink">
                  Register a new issuer
                </h2>
                <p className="mt-1 text-sm text-stone">
                  Bind a KYC provider to your workspace. Available to private-beta participants.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="inline-flex size-8 items-center justify-center rounded-[2px] text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
              >
                <Xmark className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-col gap-4 rounded-[var(--radius-6)] border border-border-subtle bg-surface p-4">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
                  Display name
                </span>
                <span className="text-sm text-quill">e.g. Acme Compliance</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
                  Issuer pubkey
                </span>
                <span className="font-mono text-xs text-quill">8xgN…r19c</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
                  Merkle root
                </span>
                <span className="font-mono text-xs text-quill">0xa3f8…c91b</span>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border-subtle pt-4">
              <span className="text-xs text-muted">Available in private beta</span>
              <Button variant="ghost" size="sm" onClick={close}>
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
