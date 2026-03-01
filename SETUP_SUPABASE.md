# חיבור נרות + ספר אורחים משותפים (Supabase)

המטרה:
- ספירת נרות **משותפת לכל המבקרים**
- הודעות “כתבו כמה מילים” נשמרות **משותף**, אך מוצגות באתר רק לאחר **אישור** (Moderation)

## 1) יצירת פרויקט
1. היכנסו ל-Supabase וצרו Project חדש.
2. בתפריט Project Settings → API:
   - העתיקו **Project URL**
   - העתיקו **anon public key**

## 2) קונפיגורציה באתר
פתחו `public/assets/backend-config.js` והדביקו:
- `supabaseUrl`
- `supabaseAnonKey`

## 3) יצירת טבלאות + פונקציה (SQL)
בתפריט Supabase → SQL Editor הריצו:

```sql
-- Candles table
create table if not exists public.candles (
  person_id text primary key,
  count bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- Guestbook table (מוצג רק אחרי אישור)
create table if not exists public.guestbook_entries (
  id uuid primary key default gen_random_uuid(),
  person_id text not null,
  by text,
  text text not null,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.candles enable row level security;
alter table public.guestbook_entries enable row level security;

-- Policies:
-- Candles: allow read for everyone
drop policy if exists "candles_read" on public.candles;
create policy "candles_read" on public.candles
for select using (true);

-- Guestbook: allow public to read only approved
drop policy if exists "guestbook_read_approved" on public.guestbook_entries;
create policy "guestbook_read_approved" on public.guestbook_entries
for select using (approved = true);

-- Guestbook: allow public to insert (always approved=false by default)
drop policy if exists "guestbook_insert" on public.guestbook_entries;
create policy "guestbook_insert" on public.guestbook_entries
for insert with check (true);

-- Increment function for candles (atomic)
create or replace function public.increment_candle(pid text)
returns bigint
language plpgsql
security definer
as $$
declare new_count bigint;
begin
  insert into public.candles(person_id, count)
  values (pid, 1)
  on conflict (person_id)
  do update set count = public.candles.count + 1, updated_at = now();

  select count into new_count from public.candles where person_id = pid;
  return new_count;
end;
$$;

-- Allow anon to execute the function
grant execute on function public.increment_candle(text) to anon;
grant execute on function public.increment_candle(text) to authenticated;

-- Allow anon to insert into guestbook_entries and select approved rows
grant select on public.candles to anon;
grant select on public.guestbook_entries to anon;
grant insert on public.guestbook_entries to anon;
```

## 4) אישור הודעות (Moderation)
1. Supabase → Table Editor → `guestbook_entries`
2. מסננים לפי `approved = false`
3. מאשרים ידנית ע״י שינוי `approved` ל-`true`

> שימו לב: משתמשים “ציבוריים” לא יכולים לאשר/לשנות — רק אתם דרך הדשבורד.

## 5) הערה על מניעת ספאם
האתר מגביל הדלקת נר ל**פעם ביום לכל מכשיר** (לא אבטחה מלאה).
אפשר לשדרג בהמשך עם:
- Captcha
- Rate limiting בצד שרת (Edge Function)
- או אימות אנונימי + כללים מתקדמים

