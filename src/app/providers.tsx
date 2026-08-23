"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState, type ReactNode } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { createQueryClient } from "@/lib/query-client";

/**
 * Client-side context shared by the whole app.
 *
 * Split from `layout.tsx` so the layout itself stays a server component — only this subtree ships
 * to the browser.
 */
export function Providers({ children }: { children: ReactNode }) {
  // `useState` rather than a module-level constant: a shared client would leak one user's cached
  // results into another's request during server rendering.
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        // The table re-renders thousands of cells; animating a colour change across all of them
        // on theme switch is visibly janky.
        disableTransitionOnChange
      >
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
