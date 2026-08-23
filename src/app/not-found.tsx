import { MapPinOff } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-4 py-24 text-center">
      <MapPinOff className="text-muted-foreground size-8" aria-hidden />
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-muted-foreground text-sm text-pretty">
        That address does not exist. The search lives on the home page.
      </p>
      <Button asChild className="mt-2">
        <Link href="/">Back to search</Link>
      </Button>
    </div>
  );
}
