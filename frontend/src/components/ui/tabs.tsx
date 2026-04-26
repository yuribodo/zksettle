"use client";

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { cn } from "@/lib/cn";

type TabsContextValue = {
  value: string;
  setValue: (next: string) => void;
  baseId: string;
};

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(component: string): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) {
    throw new Error(`${component} must be rendered inside <Tabs>`);
  }
  return ctx;
}

export type TabsProps = Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> & {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
};

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  className,
  children,
  ...rest
}: TabsProps) {
  const [internal, setInternal] = useState(defaultValue);
  const current = value ?? internal;
  const baseId = useId();

  const setValue = useCallback(
    (next: string) => {
      if (value === undefined) setInternal(next);
      onValueChange?.(next);
    },
    [onValueChange, value],
  );

  const ctx = useMemo(() => ({ value: current, setValue, baseId }), [current, setValue, baseId]);

  return (
    <TabsContext.Provider value={ctx}>
      <div className={cn("w-full", className)} {...rest}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export type TabsListProps = HTMLAttributes<HTMLDivElement>;

export const TabsList = forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      role="tablist"
      className={cn(
        "inline-flex items-center gap-6 border-b border-border-subtle",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);
TabsList.displayName = "TabsList";

export type TabsTriggerProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  value: string;
};

export const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, onClick, onKeyDown, type = "button", ...props }, ref) => {
    const ctx = useTabsContext("TabsTrigger");
    const selected = ctx.value === value;

    const handleKey = (event: KeyboardEvent<HTMLButtonElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;

      const list = event.currentTarget.parentElement;
      if (!list) return;
      const triggers = Array.from(
        list.querySelectorAll<HTMLButtonElement>('button[role="tab"]:not([disabled])'),
      );
      if (triggers.length === 0) return;
      const idx = triggers.indexOf(event.currentTarget);
      let next = idx;
      if (event.key === "ArrowLeft") next = (idx - 1 + triggers.length) % triggers.length;
      if (event.key === "ArrowRight") next = (idx + 1) % triggers.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = triggers.length - 1;
      event.preventDefault();
      triggers[next]?.focus();
      triggers[next]?.click();
    };

    return (
      <button
        ref={ref}
        type={type}
        role="tab"
        id={`${ctx.baseId}-trigger-${value}`}
        aria-selected={selected}
        aria-controls={`${ctx.baseId}-content-${value}`}
        tabIndex={selected ? 0 : -1}
        data-state={selected ? "active" : "inactive"}
        onClick={(event) => {
          ctx.setValue(value);
          onClick?.(event);
        }}
        onKeyDown={handleKey}
        className={cn(
          "relative -mb-px inline-flex items-center gap-2 border-b-2 border-transparent px-1 py-3 font-sans text-sm font-medium text-muted transition-colors duration-150 ease-[var(--ease-brand)]",
          "hover:text-ink",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest",
          "disabled:pointer-events-none disabled:opacity-50",
          "data-[state=active]:border-forest data-[state=active]:text-ink",
          className,
        )}
        {...props}
      />
    );
  },
);
TabsTrigger.displayName = "TabsTrigger";

export type TabsContentProps = HTMLAttributes<HTMLDivElement> & {
  value: string;
};

export const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, ...props }, ref) => {
    const ctx = useTabsContext("TabsContent");
    const selected = ctx.value === value;
    if (!selected) return null;
    return (
      <div
        ref={ref}
        role="tabpanel"
        id={`${ctx.baseId}-content-${value}`}
        aria-labelledby={`${ctx.baseId}-trigger-${value}`}
        tabIndex={0}
        className={cn(
          "pt-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest",
          className,
        )}
        {...props}
      />
    );
  },
);
TabsContent.displayName = "TabsContent";
