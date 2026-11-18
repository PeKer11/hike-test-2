-- Switch OFF "walking now" (migration B). To switch ON again: the three grants at the bottom.
revoke execute on function public.set_my_presence(integer, integer, text, boolean) from authenticated;
revoke execute on function public.clear_my_presence() from authenticated;
revoke execute on function public.walking_now() from authenticated;
delete from public.walk_presence;
-- ON again:
-- grant execute on function public.set_my_presence(integer, integer, text, boolean) to authenticated;
-- grant execute on function public.clear_my_presence() to authenticated;
-- grant execute on function public.walking_now() to authenticated;
