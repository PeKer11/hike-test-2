import {
  similarBadgeText,
  supportBadgeText,
  type CommunityAggregates,
  type SocialLang,
} from "@/lib/social/aggregates";

/**
 * Fixed-template community hint for one place. Renders nothing without data, so
 * flag-off or empty aggregates leave the UI exactly as it was.
 */
export function CommunityBadge({
  poiKey,
  data,
  lang,
}: {
  poiKey: string;
  data: CommunityAggregates;
  lang: SocialLang;
}) {
  const bucket = data.support[poiKey];
  const similar = data.similar[poiKey];
  if (!bucket && !similar) return null;
  return (
    <p className="text-xs text-forest/80" data-testid="community-badge">
      {bucket ? <span>🤝 {supportBadgeText(lang, bucket)}</span> : null}
      {bucket && similar ? " · " : null}
      {similar ? <span>{similarBadgeText(lang, similar)}</span> : null}
    </p>
  );
}
