"use client";

import { useCallback, useEffect, useState } from "react";

import { Accessory } from "@/components/ui/Accessory";
import { EmptyState } from "@/components/ui/EmptyState";
import { BTN_PRIMARY, BTN_SOFT, FIELD, PANEL, PANEL_SUB, PANEL_TITLE, ROW } from "@/components/ui/panel-style";
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

  if (!signedIn || !client) return expanded ? <p className="p-3 text-xs text-tk-sage">Loading…</p> : null;

  const act = async (fn: () => Promise<boolean>, fail: string) => {
    setNote((await fn()) ? null : fail);
    await refresh(client);
  };

  const incoming = friends.filter((f) => f.status === "pending" && f.incoming);
  const accepted = friends.filter((f) => f.status === "accepted");
  const sent = friends.filter((f) => f.status === "pending" && !f.incoming);
  

  return (
    <section className={`${PANEL} space-y-3`}>
      {expanded && (
        <>
          <Accessory name="tent" className="absolute -right-1 top-1 w-[72px]" />
          <div className="pr-16">
            <h2 className={PANEL_TITLE}>Friends</h2>
            <p className={PANEL_SUB}>Share walks and plan the next one together.</p>
          </div>
        </>
      )}
      {!expanded && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full cursor-pointer items-center justify-between font-display text-[17px] text-tk-ink"
        >
          <span>Friends{incoming.length ? ` (${incoming.length} new)` : ""}</span>
          <span aria-hidden="true">{open ? "▲" : "▼"}</span>
        </button>
      )}

      {open && (
        <div className="space-y-3 text-[13px]">
          <div className={`${ROW} flex items-center justify-between gap-2 !py-2`}>
            <span className="text-tk-sage">
              My code: <strong className="font-mono tracking-wider text-tk-ink">{code ?? "..."}</strong>
            </span>
            {code && (
              <button
                type="button"
                className={BTN_SOFT}
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
              className={`${FIELD} font-mono uppercase`}
            />
            <button type="submit" className={BTN_PRIMARY}>
              Add
            </button>
          </form>
          {note && <p role="status" className="text-xs text-tk-check">{note}</p>}

          {incoming.length > 0 && (
            <ul aria-label="Friend requests" className="space-y-1">
              {incoming.map((f) => (
                <li key={f.friendshipId} className={`${ROW} flex items-center justify-between gap-2 !py-2`}>
                  <span>{f.label} wants to be friends</span>
                  <span className="flex gap-1">
                    <button type="button" className={BTN_PRIMARY} onClick={() => void act(() => acceptFriend(client, f.friendshipId), "Couldn't accept.")}>
                      Accept
                    </button>
                    <button type="button" className={BTN_SOFT} onClick={() => void act(() => removeFriendship(client, f.friendshipId), "Couldn't decline.")}>
                      Decline
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {accepted.length === 0 && sent.length === 0 && incoming.length === 0 && (
            <EmptyState image="empty-friends.png" title="No friends yet" hint="Share your code, or enter a friend's code above." />
          )}
          {(accepted.length > 0 || sent.length > 0) && (
            <ul aria-label="Friends" className="space-y-1">
              {[...accepted, ...sent].map((f) => (
                <li key={f.friendshipId} className={`${ROW} flex items-center gap-2.5 !py-2`}>
                  <Accessory name="hat" className="w-7 shrink-0" />
                  <span className="min-w-0 flex-1 font-medium text-tk-ink">
                    {f.label}
                    {f.status === "pending" ? " (waiting)" : ""}
                  </span>
                  <button type="button" className={BTN_SOFT} onClick={() => void act(() => removeFriendship(client, f.friendshipId), "Couldn't remove.")}>
                    {f.status === "pending" ? "Cancel" : "Remove"}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {walks.length > 0 && (
            <div className="space-y-1">
              <p className="font-display text-[15px] text-tk-ink">Walks friends shared</p>
              <ul aria-label="Walks friends shared" className="space-y-1">
                {walks.map((w) => (
                  <li key={w.id} className={`${ROW} space-y-1`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-display text-[15px] text-tk-ink">{w.title}</p>
                        <p className="text-tk-sage">
                          {w.ownerLabel}
                          {w.totalMin !== null ? ` · ${w.totalMin} min` : ""}
                          {w.distanceM !== null ? ` · ${(w.distanceM / 1000).toFixed(1)} km` : ""}
                        </p>
                        {w.stops.length > 0 && <p className="text-tk-sage">{w.stops.map((s) => s.name).join(" → ")}</p>}
                      </div>
                      {onPlan && w.stops.length > 0 && (
                        <button type="button" className={`${BTN_PRIMARY} shrink-0 !bg-tk-send`} onClick={() => onPlan({ title: w.title, stops: w.stops })}>
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
