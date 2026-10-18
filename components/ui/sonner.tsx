"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/** El Toaster de shadcn/ui, fijo en tema oscuro (el panel /demo no cambia de tema). */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
