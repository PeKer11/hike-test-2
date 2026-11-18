-- Switch OFF walk requests (migration C). To switch ON again: the five grants at the bottom.
revoke execute on function public.send_walk_request(uuid, text, text, text, numeric, numeric, int) from authenticated;
revoke execute on function public.respond_walk_request(uuid, boolean) from authenticated;
revoke execute on function public.cancel_walk_request(uuid) from authenticated;
revoke execute on function public.set_walk_request_note(uuid, text) from authenticated;
revoke execute on function public.my_walk_requests() from authenticated;
-- ON again:
-- grant execute on function public.send_walk_request(uuid, text, text, text, numeric, numeric, int) to authenticated;
-- grant execute on function public.respond_walk_request(uuid, boolean) to authenticated;
-- grant execute on function public.cancel_walk_request(uuid) to authenticated;
-- grant execute on function public.set_walk_request_note(uuid, text) to authenticated;
-- grant execute on function public.my_walk_requests() to authenticated;
