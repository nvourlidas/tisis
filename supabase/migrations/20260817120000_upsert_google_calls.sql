-- Mirrors upsert_google_tasks but for call-linked calendar events: only updates
-- calls that are already linked to a google_event_id (calls are never created
-- from a calendar event — only tasks are).
create or replace function upsert_google_calls(p_tenant_id uuid, p_events jsonb)
returns integer
language plpgsql
as $$
declare
  v_count integer := 0;
begin
  with events as (
    select
      (e->>'google_event_id') as google_event_id,
      nullif(e->>'caller_name', '') as caller_name,
      (e->>'description') as description,
      nullif(e->>'due_date', '')::date as due_date,
      nullif(e->>'due_time', '')::time as due_time
    from jsonb_array_elements(p_events) as e
  ),
  updated as (
    update calls c
    set
      caller_name = coalesce(ev.caller_name, c.caller_name),
      description = ev.description,
      created_at = case
        when ev.due_date is null then c.created_at
        else (ev.due_date + coalesce(ev.due_time, (c.created_at at time zone 'Europe/Athens')::time))
          at time zone 'Europe/Athens'
      end
    from events ev
    where c.tenant_id = p_tenant_id
      and c.google_event_id = ev.google_event_id
    returning c.id
  )
  select count(*) into v_count from updated;

  return v_count;
end;
$$;
