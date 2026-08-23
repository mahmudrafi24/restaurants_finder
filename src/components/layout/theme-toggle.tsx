"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const THEMES = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change theme">
          {/*
            The active theme is unknown during server rendering, so it is expressed in CSS rather
            than JS: next-themes puts the resolved `dark` class on <html> before React hydrates, and
            these two icons key off it. A `mounted` state flag would work too, but it costs an extra
            render pass on every visit and flashes the wrong icon first.
          */}
          <Sun className="size-4 dark:hidden" aria-hidden />
          <Moon className="hidden size-4 dark:block" aria-hidden />
        </Button>
      </DropdownMenuTrigger>

      {/* Radix mounts this only while open — always after hydration — so `theme` is safe to read. */}
      <DropdownMenuContent align="end">
        {THEMES.map(({ value, label, Icon }) => (
          <DropdownMenuItem key={value} onSelect={() => setTheme(value)}>
            <Icon className="size-4" aria-hidden />
            {label}
            {theme === value ? (
              <span className="text-muted-foreground ml-auto text-xs">Active</span>
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
