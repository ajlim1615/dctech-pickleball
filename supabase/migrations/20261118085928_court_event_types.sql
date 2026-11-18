-- Manual court control, part 4: event types for live-court changes and Up Next edits.
alter table public.session_events drop constraint session_events_type_check;
alter table public.session_events add constraint session_events_type_check check (type in (
  'session_started', 'session_ended', 'checked_in', 'checked_out',
  'joined_queue', 'left_queue', 'players_added', 'break_started', 'break_ended',
  'moved_in_queue', 'removed_from_queue', 'players_swapped',
  'game_started', 'game_result', 'result_corrected', 'no_show_swapped',
  'court_closed', 'court_reopened',
  'court_player_replaced', 'court_player_removed', 'court_teams_switched',
  'court_slot_filled', 'court_change_undone', 'up_next_edited'
));
