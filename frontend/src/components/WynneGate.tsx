import { useSyncExternalStore, type ReactNode } from "react";
import { isWynneBanned, subscribeToWynneBan } from "@/lib/wynneBan";

export function WynneGate({ children }: { children: ReactNode }) {
  const isBanned = useSyncExternalStore(subscribeToWynneBan, isWynneBanned);

  if (!isBanned) return children;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-8" aria-labelledby="wynne-ban-title">
      <div className="w-full max-w-sm text-center">
        <img
          src="/wynne-bouncer.jpg"
          alt="A very serious goose in sunglasses holding up a wing to deny entry."
          width={1254}
          height={1254}
          className="mx-auto mb-6 aspect-square w-full max-w-80 rounded-2xl object-cover"
        />
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Access denied</p>
        <h1 id="wynne-ban-title" className="text-3xl font-bold tracking-tight">You’re banned, Wynne.</h1>
        <p className="mt-3 text-muted-foreground">No checks. No entry. Come back when you’re cooler.</p>
      </div>
    </main>
  );
}
