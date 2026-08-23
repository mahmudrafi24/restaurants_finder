import { UtensilsCrossed } from "lucide-react";
import Link from "next/link";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";

const REPOSITORY_URL = "https://github.com/mahmudrafi24/cafe_scraping";

export function SiteHeader() {
  return (
    <header className="bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 w-full border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <UtensilsCrossed className="text-primary size-5" aria-hidden />
          <span>Restaurant Finder</span>
        </Link>

        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <a href={REPOSITORY_URL} target="_blank" rel="noreferrer noopener">
              Source
            </a>
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
