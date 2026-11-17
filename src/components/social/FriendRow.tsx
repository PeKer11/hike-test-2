"use client";

import { Avatar } from "@/components/social/Avatar";
import type { FriendRow as Friend } from "@/lib/walks/friends";

/** One friend: avatar and name (a link to the profile when they have one). The menu is the caller's. */
export function FriendRow({
  friend,
  onOpen,
  trailing,
  stacked = false,
}: {
  friend: Friend;
  /** Set when the friend has a social profile and profiles are on. */
  onOpen?: () => void;
  trailing?: React.ReactNode;
  /** Put the trailing actions under the name (two big buttons do not fit beside it on a phone). */
  stacked?: boolean;
}) {
  const body = (
    <>
      <Avatar id={friend.avatar} size={40} seed={friend.friendId} />
      <span dir="auto" className="min-w-0 flex-1 truncate text-start text-[17px] font-medium text-tk-ink">
        {friend.label}
      </span>
    </>
  );
  return (
    <div className={stacked ? "space-y-2 py-2" : "flex min-h-14 items-center gap-3"}>
      <div className="flex min-h-12 items-center gap-3">
      {onOpen ? (
        <button type="button" onClick={onOpen} className="flex min-h-12 min-w-0 flex-1 items-center gap-3">
          {body}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{body}</div>
      )}
      {stacked ? null : trailing}
      </div>
      {stacked ? trailing : null}
    </div>
  );
}
