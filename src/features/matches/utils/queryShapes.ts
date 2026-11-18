/**
 * PostgREST embed for a match's court. `matches` and `courts` have two foreign
 * keys (`matches.court_id` and `courts.current_match_id`), so an unqualified
 * `court:courts (...)` select fails ambiguously; every query must name the key.
 */
export const MATCH_COURT = "court:courts!court_id" as const;
