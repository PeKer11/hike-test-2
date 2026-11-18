-- Roll back migration D ("strangers nearby"). Run this file, THEN re-paste B (20261119100000) and C (20261119110000):
-- both are idempotent and put back the friends-only walking_now() and send_walk_request() that D replaced.
revoke execute on function public.send_walk_request_nearby(uuid, text, text, text, numeric, numeric, int) from authenticated;
revoke execute on function public.social_profile_card_by_token(uuid) from authenticated;
drop function if exists public.send_walk_request_nearby(uuid, text, text, text, numeric, numeric, int);
drop function if exists public.social_profile_card_by_token(uuid);
update public.social_profiles set presence_audience = 'friends' where presence_audience = 'public';
delete from public.walk_presence where audience = 'public';
