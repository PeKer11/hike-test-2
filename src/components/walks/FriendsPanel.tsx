"use client";

import { useCallback, useEffect, useState } from "react";

import {
  acceptFriend,
  getMyFriendCode,
  listFriends,
  listFriendsWalks,
  removeFriendship,
  requestFriend,
  type FriendRow,
  type FriendWalk,
} from "@/lib/walks/friends";

export interface PlannableWalk {
  title: string;
  stops: { name: string; category: string; lat: number; lng: number }[];
}

/** Friends: my code, add by code, requests, friends, and the walks they shared. Renders nothing when signed out. */
export function FriendsPanel({ onPlan, expanded = false }: { onPlan?: (w: PlannableWalk) => void; expanded?: boolean }) {
  const [signedIn, setSignedIn] = useState(false);
  const [openState, setOpen] = useState(false);
  const open = expanded || openState;
  const [code, setCode] = useState<string | null>(null);
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [walks, setWalks] = useState<FriendWalk[]>([]);
  const [input, setInput] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [client, setClient] = useState<import("@supabase/supabase-js").SupabaseClient | null>(null);

  const refresh = useCallback(async (c: import("@supabase/supabase-js").SupabaseClient) => {
    const [f, w] = await Promise.all([listFriends(c), listFriendsWalks(c)]);
    setFriends(f);
    setWalks(w);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const c = createClient();
        const { data } = await c.auth.getUser();
        if (cancelled || !data.user) return;
        setClient(c);
        setSignedIn(true);
        setCode(await getMyFriendCode(c));
        await refresh(c);
      } catch {
        // Signed out or offline: stay silent.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  if (!signedIn || !client) return expanded ? <p className="p-3 text-xs text-charcoal/60">Loading…</p> : null;

  const act = async (fn: () => Promise<boolean>, fail: string) => {
    setNote((await fn()) ? null : fail);
    await refresh(client);
  };

  const incoming = friends.filter((f) => f.status === "pending" && f.incoming);
  const accepted = friends.filter((f) => f.status === "accepted");
  const sent = friends.filter((f) => f.status === "pending" && !f.incoming);
  const btn = "cursor-pointer rounded-md px-2 py-1 text-xs font-medium";

  return (
    <section className="space-y-2 rounded-[10px] border border-charcoal/10 bg-cream/60 p-3">
      {!expanded && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full cursor-pointer items-center justify-between text-sm font-medium text-charcoal/80 hover:text-forest"
        >
          <span>Friends{incoming.length ? ` (${incoming.length} new)` : ""}</span>
          <span aria-hidden="true">{open ? "▲" : "▼"}</span>
        </button>
      )}

      {open && (
        <div className="space-y-3 text-xs text-charcoal/80">
          <div className="flex items-center justify-between gap-2 rounded-md bg-white/70 px-2 py-1.5">
            <span>
              My code: <strong className="font-mono tracking-wider">{code ?? "..."}</strong>
            </span>
            {code && (
              <button
                type="button"
                className={`${btn} bg-forest/10 text-forest`}
                onClick={() => void navigator.clipboard?.writeText(code).catch(() => undefined)}
              >
                Copy
              </button>
            )}
          </div>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const v = input;
              setInput("");
              void act(() => requestFriend(client, v), "Couldn't send that request.");
              if (v.trim()) setNote("Request sent, if the code was valid.");
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={12}
              placeholder="Friend's code"
              aria-label="Friend's code"
              className="min-w-0 flex-1 rounded-md border border-charcoal/15 bg-white px-2 py-1 font-mono uppercase"
            />
            <button type="submit" className={`${btn} bg-forest text-cream`}>
              Add
            </button>
          </form>
          {note && <p role="status" className="text-terra">{note}</p>}

          {incoming.length > 0 && (
            <ul aria-label="Friend requests" className="space-y-1">
              {incoming.map((f) => (
                <li key={f.friendshipId} className="flex items-center justify-between gap-2 rounded-md bg-white/70 px-2 py-1.5">
                  <span>{f.label} wants to be friends</span>
                  <span className="flex gap-1">
                    <button type="button" className={`${btn} bg-forest text-cream`} onClick={() => void act(() => acceptFriend(client, f.friendshipId), "Couldn't accept.")}>
                      Accept
                    </button>
                    <button type="button" className={`${btn} bg-charcoal/10`} onClick={() => void act(() => removeFriendship(client, f.friendshipId), "Couldn't decline.")}>
                      Decline
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {(accepted.length > 0 || sent.length > 0) && (
            <ul aria-label="Friends" className="space-y-1">
              {[...accepted, ...sent].map((f) => (
                <li key={f.friendshipId} className="flex items-center justify-between gap-2 rounded-md bg-white/70 px-2 py-1.5">
                  <span>
                    {f.label}
                    {f.status === "pending" ? " (waiting)" : ""}
                  </span>
                  <button type="button" className={`${btn} bg-charcoal/10`} onClick={() => void act(() => removeFriendship(client, f.friendshipId), "Couldn't remove.")}>
                    {f.status === "pending" ? "Cancel" : "Remove"}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {walks.length > 0 && (
            <div className="space-y-1">
              <p className="font-medium text-charcoal/70">Walks friends shared</p>
              <ul aria-label="Walks friends shared" className="space-y-1">
                {walks.map((w) => (
                  <li key={w.id} className="space-y-1 rounded-md bg-white/70 px-2 py-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-forest">{w.title}</p>
                        <p className="text-charcoal/60">
                          {w.ownerLabel}
                          {w.totalMin !== null ? ` · ${w.totalMin} min` : ""}
                          {w.distanceM !== null ? ` · ${(w.distanceM / 1000).toFixed(1)} km` : ""}
                        </p>
                        {w.stops.length > 0 && <p className="text-charcoal/60">{w.stops.map((s) => s.name).join(" → ")}</p>}
                      </div>
                      {onPlan && w.stops.length > 0 && (
                        <button type="button" className={`${btn} shrink-0 bg-terra text-cream`} onClick={() => onPlan({ title: w.title, stops: w.stops })}>
                          Plan this walk
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
