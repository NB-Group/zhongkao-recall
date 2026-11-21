create or replace function public.apply_review_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_state public.learning_states%rowtype;
  next_interval integer;
  next_status public.learning_status;
  next_due timestamptz;
begin
  select * into current_state
  from public.learning_states
  where user_id = new.user_id and card_id = new.card_id
  for update;

  if not found then
    current_state.user_id := new.user_id;
    current_state.card_id := new.card_id;
    current_state.status := 'new';
    current_state.interval_days := 0;
    current_state.lapse_count := 0;
  end if;

  if current_state.status in ('review', 'mastered') then
    if new.grade = 'again' then
      next_interval := 0;
      next_status := 'learning';
      next_due := new.created_at + interval '10 minutes';
    elsif new.grade = 'hard' then
      next_interval := greatest(1, round(current_state.interval_days * 1.5));
      next_status := 'review';
      next_due := ((new.created_at at time zone new.time_zone) + make_interval(days => next_interval)) at time zone new.time_zone;
    elsif new.grade = 'good' then
      next_interval := greatest(1, round(current_state.interval_days * 2.3));
      next_status := 'review';
      next_due := ((new.created_at at time zone new.time_zone) + make_interval(days => next_interval)) at time zone new.time_zone;
    else
      next_interval := greatest(3, round(current_state.interval_days * 3.5));
      next_status := 'review';
      next_due := ((new.created_at at time zone new.time_zone) + make_interval(days => next_interval)) at time zone new.time_zone;
    end if;
  elsif new.grade = 'again' then
    next_interval := 0;
    next_status := 'learning';
    next_due := new.created_at + interval '10 minutes';
  elsif new.grade = 'easy' then
    next_interval := greatest(3, round(greatest(1, current_state.interval_days) * 3.5));
    next_status := 'review';
    next_due := ((new.created_at at time zone new.time_zone) + make_interval(days => next_interval)) at time zone new.time_zone;
  elsif current_state.interval_days = 0 then
    next_interval := 1;
    next_status := 'learning';
    next_due := ((new.created_at at time zone new.time_zone) + interval '1 day') at time zone new.time_zone;
  elsif current_state.interval_days = 1 then
    next_interval := 3;
    next_status := 'learning';
    next_due := ((new.created_at at time zone new.time_zone) + interval '3 days') at time zone new.time_zone;
  else
    next_interval := 7;
    next_status := 'review';
    next_due := ((new.created_at at time zone new.time_zone) + interval '7 days') at time zone new.time_zone;
  end if;

  insert into public.learning_states (
    user_id, card_id, status, due_at, interval_days, lapse_count, last_grade, updated_at
  ) values (
    new.user_id,
    new.card_id,
    next_status,
    next_due,
    next_interval,
    current_state.lapse_count + case when new.grade = 'again' and current_state.status <> 'new' then 1 else 0 end,
    new.grade,
    new.created_at
  )
  on conflict (user_id, card_id) do update set
    status = excluded.status,
    due_at = excluded.due_at,
    interval_days = excluded.interval_days,
    lapse_count = excluded.lapse_count,
    last_grade = excluded.last_grade,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

create trigger review_event_updates_learning_state
after insert on public.review_events
for each row execute function public.apply_review_event();
