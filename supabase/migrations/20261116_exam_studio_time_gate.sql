-- ============================================================================
-- SocialBank × SOCIALNOCK LAB — ห้องข้อสอบ (Exam Studio) + ประตูจับเวลา (Time-Gate)
-- รันไฟล์นี้ครั้งเดียวใน Supabase SQL Editor (Project > SQL Editor > New query > Run)
-- ต้องรัน 20261116_add_grade_level.sql (ระดับชั้น + source) ก่อนแล้ว
-- รันซ้ำได้ (idempotent) ไม่ลบข้อมูลเดิม
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- 1) items: รหัสคอร์ส/ชุดของ Lab + สถานะข้อที่ต่อยอด (remix)
-- ============================================================================
alter table items add column if not exists course_code text;      -- เช่น P2C7, P3C8, P3C9, KTP, TUC
alter table items add column if not exists set_code text;         -- เช่น EP01, AM1
alter table items add column if not exists is_remixed boolean not null default false;
alter table items add column if not exists parent_item_id text;   -- item_id ต้นฉบับของข้อที่ต่อยอด

create index if not exists idx_items_course_code on items(course_code);
create index if not exists idx_items_parent on items(parent_item_id);

-- เติมรหัสคอร์ส/ชุดจาก item_id ของข้อสอบคอร์สที่นำเข้าไปแล้ว (P2C7-05-022 → P2C7 / EP05)
update items set course_code = substring(item_id from '^(P[0-9]C[0-9]+)-'),
                 set_code = 'EP' || substring(item_id from '^P[0-9]C[0-9]+-([0-9]+)-')
 where course_code is null and item_id ~ '^P[0-9]C[0-9]+-[0-9]+-';
update items set course_code = 'KTP', set_code = substring(item_id from '^KTP[0-9]*-([A-Z]+[0-9]+)-')
 where course_code is null and item_id ~ '^KTP[0-9]*-[A-Z]+[0-9]+-';
update items set course_code = 'TUC', set_code = substring(item_id from '^TUC-([A-Z]+[0-9]+)-')
 where course_code is null and item_id ~ '^TUC-[A-Z]+[0-9]+-';

-- แพ็กข้อสอบปีใหม่ (NOT VALID = ไม่ตรวจแถวเก่า กันรันพังถ้ามีค่าแปลกค้างอยู่)
alter table items drop constraint if exists chk_pack;
alter table items add constraint chk_pack check (pack is null or pack in
  ('PP62-63','PP63-64','PP64-65','PP65-66','PP66-67','PP67-68','PP68-69','PP69-70')) not valid;

-- ============================================================================
-- 2) papers: รหัสคอร์ส/ชุดของ Lab + การตั้งค่าการขาย/เวลาสอบ
-- ============================================================================
alter table papers add column if not exists course_code text;
alter table papers add column if not exists set_code text;
alter table papers add column if not exists visibility text not null default 'course';
alter table papers add column if not exists price numeric(10,2) not null default 0;
alter table papers add column if not exists duration_minutes int not null default 60;
alter table papers add column if not exists max_attempts int not null default 1;
alter table papers add column if not exists valid_days int not null default 30;
alter table papers add column if not exists is_published boolean not null default false;
alter table papers add column if not exists lab_synced_at timestamptz;

alter table papers drop constraint if exists chk_paper_visibility;
alter table papers add constraint chk_paper_visibility check (visibility in ('course','single_sale','bundle_pack'));
alter table papers drop constraint if exists chk_paper_numbers;
alter table papers add constraint chk_paper_numbers check (
  price >= 0 and duration_minutes between 1 and 600 and max_attempts between 1 and 999 and valid_days between 0 and 3650);

create index if not exists idx_papers_course_set on papers(course_code, set_code);

-- ============================================================================
-- 3) ตารางใหม่
-- ============================================================================
-- แพ็กเกจข้อสอบ (มัดรวมหลายชุด)
create table if not exists exam_bundles (
  bundle_id uuid primary key default gen_random_uuid(),
  title text not null,
  paper_ids uuid[] not null default '{}',
  price numeric(10,2) not null default 0,
  valid_days int not null default 30,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  user_id uuid references auth.users(id) default auth.uid()
);

-- รหัสบัตรเข้าสอบสำหรับผู้ซื้อ (SN-XXXX-XXXX)
create table if not exists exam_access_codes (
  id uuid primary key default gen_random_uuid(),
  access_code text unique not null,
  target_type text not null,
  target_id uuid not null,
  buyer_contact text,
  attempts_used int not null default 0,
  activated_at timestamptz,
  expires_at timestamptz,
  status text not null default 'unused',
  batch_label text,
  created_at timestamptz default now(),
  user_id uuid references auth.users(id) default auth.uid(),
  constraint chk_code_target check (target_type in ('paper','bundle')),
  constraint chk_code_status check (status in ('unused','active','expired'))
);
create index if not exists idx_access_codes_user on exam_access_codes(user_id);
create index if not exists idx_access_codes_target on exam_access_codes(target_type, target_id);

-- รหัสนักเรียนในคอร์สหลัก (ใช้เข้าประตูจับเวลา)
create table if not exists course_students (
  id uuid primary key default gen_random_uuid(),
  student_code text not null,
  full_name text,
  course_code text,            -- null = เข้าได้ทุกชุดแบบ 'course'
  is_active boolean not null default true,
  created_at timestamptz default now(),
  user_id uuid references auth.users(id) default auth.uid(),
  unique (user_id, student_code)
);

-- การเข้าสอบแต่ละครั้ง (แยก student / buyer ชัดเจน)
create table if not exists exam_attempts (
  id uuid primary key default gen_random_uuid(),
  token uuid not null default gen_random_uuid(),     -- ความลับสำหรับส่งคำตอบ/ดูใบสรุปผล
  paper_id uuid not null references papers(id) on delete cascade,
  participant_type text not null,
  student_code text,
  access_code_id uuid references exam_access_codes(id) on delete set null,
  participant_name text,
  participant_contact text,
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  submitted_at timestamptz,
  is_late boolean not null default false,
  answers jsonb not null default '{}'::jsonb,        -- { item_id: 'A' }
  results jsonb not null default '{}'::jsonb,        -- { item_id: true/false }
  score int,
  total int,
  user_id uuid references auth.users(id),            -- เจ้าของชุดข้อสอบ (ครู)
  constraint chk_attempt_type check (participant_type in ('student','buyer'))
);
create index if not exists idx_attempts_paper on exam_attempts(paper_id, participant_type);
create index if not exists idx_attempts_user on exam_attempts(user_id);

-- ============================================================================
-- 4) RLS — ครูเห็น/จัดการเฉพาะของตัวเอง; ผู้สอบ (anon) เข้าได้ผ่านฟังก์ชัน gate_* เท่านั้น
-- ============================================================================
alter table exam_bundles enable row level security;
alter table exam_access_codes enable row level security;
alter table course_students enable row level security;
alter table exam_attempts enable row level security;

drop policy if exists "bundles_own" on exam_bundles;
create policy "bundles_own" on exam_bundles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "access_codes_own" on exam_access_codes;
create policy "access_codes_own" on exam_access_codes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "course_students_own" on course_students;
create policy "course_students_own" on course_students for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "attempts_select_own" on exam_attempts;
create policy "attempts_select_own" on exam_attempts for select using (auth.uid() = user_id);
drop policy if exists "attempts_delete_own" on exam_attempts;
create policy "attempts_delete_own" on exam_attempts for delete using (auth.uid() = user_id);

-- ============================================================================
-- 5) ฟังก์ชันประตูจับเวลา (security definer — ตรวจสิทธิ์เองทุกขั้น ไม่เปิดเฉลยก่อนส่ง)
-- ============================================================================

-- ตรวจรหัส → คืน owner, ประเภทผู้สอบ และรายการชุดที่เข้าได้ (ใช้ภายในเท่านั้น)
create or replace function public._gate_auth(p_kind text, p_code text, p_contact text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_contact text := lower(regexp_replace(coalesce(p_contact, ''), '[[:space:]-]', '', 'g'));
  v_st course_students%rowtype;
  v_ac exam_access_codes%rowtype;
  v_owner uuid;
  v_days int;
  v_papers uuid[];
begin
  if v_code = '' then
    return jsonb_build_object('error', 'กรุณากรอกรหัส');
  end if;

  if p_kind = 'student' then
    select * into v_st from course_students where upper(student_code) = v_code and is_active
      order by created_at limit 1;
    if not found then
      return jsonb_build_object('error', 'ไม่พบรหัสนักเรียนนี้ หรือถูกปิดใช้งานแล้ว');
    end if;
    select coalesce(array_agg(id order by course_code, set_code, created_at), '{}') into v_papers
      from papers
     where user_id = v_st.user_id and visibility = 'course' and is_published
       and (v_st.course_code is null or papers.course_code is null or papers.course_code = v_st.course_code);
    return jsonb_build_object('participant_type', 'student', 'owner', v_st.user_id,
      'student_code', v_st.student_code, 'display_name', v_st.full_name, 'paper_ids', to_jsonb(v_papers));
  end if;

  if p_kind <> 'access_code' then
    return jsonb_build_object('error', 'ประเภทรหัสไม่ถูกต้อง');
  end if;

  select * into v_ac from exam_access_codes where access_code = v_code for update;
  if not found then
    return jsonb_build_object('error', 'ไม่พบรหัสบัตรเข้าสอบนี้');
  end if;
  if v_contact = '' then
    return jsonb_build_object('error', 'กรุณากรอกเบอร์โทรหรืออีเมลที่ใช้ผูกกับบัตร');
  end if;
  if v_ac.status = 'expired' or (v_ac.expires_at is not null and v_ac.expires_at < now()) then
    update exam_access_codes set status = 'expired' where id = v_ac.id;
    return jsonb_build_object('error', 'รหัสนี้หมดอายุแล้ว');
  end if;

  if v_ac.target_type = 'paper' then
    select user_id, valid_days into v_owner, v_days from papers where id = v_ac.target_id and is_published;
    v_papers := array[v_ac.target_id];
  else
    select user_id, valid_days, paper_ids into v_owner, v_days, v_papers
      from exam_bundles where bundle_id = v_ac.target_id and is_active;
  end if;
  if v_owner is null then
    return jsonb_build_object('error', 'ชุดข้อสอบของรหัสนี้ยังไม่เปิดใช้งาน หรือถูกปิดไปแล้ว');
  end if;

  if v_ac.status = 'unused' then
    update exam_access_codes
       set status = 'active', activated_at = now(), buyer_contact = v_contact,
           expires_at = case when coalesce(v_days, 0) > 0 then now() + make_interval(days => v_days) end
     where id = v_ac.id
     returning * into v_ac;
  elsif v_ac.buyer_contact is distinct from v_contact then
    return jsonb_build_object('error', 'รหัสนี้ถูกผูกกับเบอร์โทร/อีเมลอื่นแล้ว');
  end if;

  return jsonb_build_object('participant_type', 'buyer', 'owner', v_owner,
    'access_code_id', v_ac.id, 'access_code', v_ac.access_code, 'contact', v_contact,
    'expires_at', v_ac.expires_at, 'paper_ids', to_jsonb(v_papers));
end $$;

-- จำนวนครั้งที่ผู้สอบคนนี้ใช้ไปแล้วกับชุดนี้
create or replace function public._gate_attempts(p_auth jsonb, p_paper uuid)
returns setof exam_attempts language sql stable security definer set search_path = public as $$
  select a.* from exam_attempts a
   where a.paper_id = p_paper
     and ((p_auth->>'participant_type' = 'student' and a.participant_type = 'student'
           and a.student_code = p_auth->>'student_code' and a.user_id = (p_auth->>'owner')::uuid)
       or (p_auth->>'participant_type' = 'buyer' and a.access_code_id = (p_auth->>'access_code_id')::uuid))
$$;

-- หน้าเข้าสอบ: ตรวจรหัส แล้วคืนรายการชุดที่เข้าได้ + สถานะครั้งที่ใช้ไป
create or replace function public.gate_login(p_kind text, p_code text, p_contact text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_auth jsonb;
  v_list jsonb;
begin
  v_auth := _gate_auth(p_kind, p_code, p_contact);
  if v_auth ? 'error' then return v_auth; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'paper_name', p.paper_name, 'total_items', p.total_items,
           'duration_minutes', p.duration_minutes, 'max_attempts', p.max_attempts,
           'course_code', p.course_code, 'set_code', p.set_code,
           'attempts', (select coalesce(jsonb_agg(jsonb_build_object(
                          'id', a.id, 'token', a.token, 'started_at', a.started_at, 'deadline_at', a.deadline_at,
                          'submitted_at', a.submitted_at, 'score', a.score, 'total', a.total) order by a.started_at), '[]')
                        from _gate_attempts(v_auth, p.id) a)
         ) order by array_position(ids.arr, p.id)), '[]')
    into v_list
    from papers p,
         (select array(select jsonb_array_elements_text(v_auth->'paper_ids')::uuid) as arr) ids
   where p.id = any(ids.arr);

  return jsonb_build_object(
    'participant_type', v_auth->>'participant_type',
    'display_name', v_auth->>'display_name',
    'student_code', v_auth->>'student_code',
    'access_code', v_auth->>'access_code',
    'expires_at', v_auth->'expires_at',
    'papers', v_list);
end $$;

-- เริ่มทำข้อสอบ (หรือกลับเข้าครั้งที่ยังไม่หมดเวลา) — คืนโจทย์โดยไม่มีเฉลย
create or replace function public.gate_start(p_kind text, p_code text, p_contact text, p_paper_id uuid, p_name text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_auth jsonb;
  v_paper papers%rowtype;
  v_att exam_attempts%rowtype;
  v_used int;
  v_items jsonb;
begin
  v_auth := _gate_auth(p_kind, p_code, p_contact);
  if v_auth ? 'error' then return v_auth; end if;
  if not exists (select 1 from jsonb_array_elements_text(v_auth->'paper_ids') x where x::uuid = p_paper_id) then
    return jsonb_build_object('error', 'รหัสนี้ไม่มีสิทธิ์เข้าชุดข้อสอบนี้');
  end if;
  select * into v_paper from papers where id = p_paper_id;

  -- ครั้งที่เริ่มไว้แล้วแต่ยังไม่ส่งและยังไม่หมดเวลา → ทำต่อ (ไม่เสียสิทธิ์เพิ่ม)
  select * into v_att from _gate_attempts(v_auth, p_paper_id) a
   where a.submitted_at is null and a.deadline_at > now() order by a.started_at desc limit 1;

  if not found then
    select count(*) into v_used from _gate_attempts(v_auth, p_paper_id);
    if v_used >= v_paper.max_attempts then
      return jsonb_build_object('error', format('ใช้สิทธิ์ทำชุดนี้ครบ %s ครั้งแล้ว', v_paper.max_attempts));
    end if;
    insert into exam_attempts (paper_id, participant_type, student_code, access_code_id,
                               participant_name, participant_contact, deadline_at, user_id)
    values (p_paper_id, v_auth->>'participant_type', v_auth->>'student_code',
            (v_auth->>'access_code_id')::uuid,
            coalesce(nullif(trim(p_name), ''), v_auth->>'display_name'), v_auth->>'contact',
            now() + make_interval(mins => v_paper.duration_minutes), v_paper.user_id)
    returning * into v_att;
    if v_auth->>'participant_type' = 'buyer' then
      update exam_access_codes set attempts_used = attempts_used + 1 where id = (v_auth->>'access_code_id')::uuid;
    end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'no', t.ord, 'item_id', i.item_id, 'stem', i.stem, 'media_url', i.media_url, 'strand', i.strand,
           'choices', (select coalesce(jsonb_agg(jsonb_build_object('key', c.k, 'text', c.v) order by c.k), '[]')
                         from (values ('A', i.choice_a), ('B', i.choice_b), ('C', i.choice_c),
                                      ('D', i.choice_d), ('E', i.choice_e)) c(k, v)
                        where coalesce(c.v, '') <> '')
         ) order by t.ord), '[]')
    into v_items
    from unnest(v_paper.item_ids) with ordinality t(item_id, ord)
    join items i on i.item_id = t.item_id and i.user_id = v_paper.user_id;

  return jsonb_build_object('attempt_id', v_att.id, 'token', v_att.token,
    'paper_name', v_paper.paper_name, 'duration_minutes', v_paper.duration_minutes,
    'started_at', v_att.started_at, 'deadline_at', v_att.deadline_at,
    'answers', v_att.answers, 'items', v_items);
end $$;

-- ใบสรุปผล (ดึงเฉลย + คำอธิบายจากคลัง) — ต้องมี token ของครั้งนั้น และต้องส่งแล้ว
create or replace function public.gate_report(p_attempt_id uuid, p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_att exam_attempts%rowtype;
  v_paper papers%rowtype;
  v_items jsonb;
  v_strands jsonb;
  v_group_avg numeric;
begin
  select * into v_att from exam_attempts where id = p_attempt_id and token = p_token;
  if not found then return jsonb_build_object('error', 'ไม่พบผลสอบนี้'); end if;
  if v_att.submitted_at is null then return jsonb_build_object('error', 'ยังไม่ได้ส่งข้อสอบ'); end if;
  select * into v_paper from papers where id = v_att.paper_id;

  with q as (
    select t.ord, i.item_id, i.stem, i.strand, i.topic, i.answer, i.explanation, i.trap_type, i.media_url,
           i.choice_a, i.choice_b, i.choice_c, i.choice_d, i.choice_e,
           upper(coalesce(v_att.answers->>i.item_id, '')) as chosen
      from unnest(v_paper.item_ids) with ordinality t(item_id, ord)
      join items i on i.item_id = t.item_id and i.user_id = v_paper.user_id
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'no', ord, 'item_id', item_id, 'stem', stem, 'strand', strand, 'topic', topic,
      'answer', answer, 'chosen', nullif(chosen, ''), 'correct', chosen = answer,
      'explanation', explanation, 'trap_type', trap_type, 'media_url', media_url,
      'choices', jsonb_strip_nulls(jsonb_build_object('A', nullif(choice_a, ''), 'B', nullif(choice_b, ''),
                 'C', nullif(choice_c, ''), 'D', nullif(choice_d, ''), 'E', nullif(choice_e, '')))
    ) order by ord), '[]'),
    (select coalesce(jsonb_agg(jsonb_build_object('strand', s.strand, 'correct', s.c, 'total', s.n) order by s.strand), '[]')
       from (select strand, count(*) n, count(*) filter (where chosen = answer) c from q group by strand) s)
  into v_items, v_strands
  from q;

  select round(avg(score::numeric * 100 / nullif(total, 0)), 1) into v_group_avg
    from exam_attempts
   where paper_id = v_att.paper_id and participant_type = v_att.participant_type and submitted_at is not null;

  return jsonb_build_object(
    'attempt_id', v_att.id, 'paper_name', v_paper.paper_name, 'participant_type', v_att.participant_type,
    'participant_name', v_att.participant_name, 'started_at', v_att.started_at, 'submitted_at', v_att.submitted_at,
    'is_late', v_att.is_late, 'score', v_att.score, 'total', v_att.total, 'group_avg_percent', v_group_avg,
    'strands', v_strands, 'items', v_items);
end $$;

-- ส่งคำตอบ → ตรวจที่ฝั่งเซิร์ฟเวอร์ → คืนใบสรุปผลทันที (ส่งซ้ำได้ จะได้ผลเดิม)
create or replace function public.gate_submit(p_attempt_id uuid, p_token uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_att exam_attempts%rowtype;
  v_paper papers%rowtype;
  v_score int;
  v_total int;
  v_results jsonb;
begin
  select * into v_att from exam_attempts where id = p_attempt_id and token = p_token for update;
  if not found then return jsonb_build_object('error', 'ไม่พบการสอบครั้งนี้'); end if;

  if v_att.submitted_at is null then
    select * into v_paper from papers where id = v_att.paper_id;
    select count(*),
           count(*) filter (where upper(coalesce(p_answers->>i.item_id, '')) = i.answer),
           coalesce(jsonb_object_agg(i.item_id, upper(coalesce(p_answers->>i.item_id, '')) = i.answer), '{}')
      into v_total, v_score, v_results
      from unnest(v_paper.item_ids) t(item_id)
      join items i on i.item_id = t.item_id and i.user_id = v_paper.user_id;

    update exam_attempts
       set answers = coalesce(p_answers, '{}'::jsonb), results = v_results, score = v_score, total = v_total,
           submitted_at = now(), is_late = now() > deadline_at + interval '2 minutes'
     where id = v_att.id;
  end if;

  return gate_report(p_attempt_id, p_token);
end $$;

-- บันทึกคำตอบระหว่างทำ (กันเน็ตหลุด/รีเฟรชหน้า)
create or replace function public.gate_save_progress(p_attempt_id uuid, p_token uuid, p_answers jsonb)
returns boolean language sql security definer set search_path = public as $$
  update exam_attempts set answers = coalesce(p_answers, '{}'::jsonb)
   where id = p_attempt_id and token = p_token and submitted_at is null and deadline_at > now()
  returning true
$$;

revoke all on function public._gate_auth(text, text, text) from public, anon, authenticated;
revoke all on function public._gate_attempts(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.gate_login(text, text, text) to anon, authenticated;
grant execute on function public.gate_start(text, text, text, uuid, text) to anon, authenticated;
grant execute on function public.gate_submit(uuid, uuid, jsonb) to anon, authenticated;
grant execute on function public.gate_report(uuid, uuid) to anon, authenticated;
grant execute on function public.gate_save_progress(uuid, uuid, jsonb) to anon, authenticated;

-- ============================================================================
-- 6) สถิติสำหรับ SOCIALNOCK LAB — คะแนนแยกกลุ่ม, ความยากรายข้อรวมทุกกลุ่ม
-- ============================================================================
create or replace view lab_score_summary with (security_invoker = true) as
select a.user_id, a.paper_id, p.paper_name, p.course_code, p.set_code, a.participant_type,
       count(*) as attempts,
       round(avg(a.score::numeric * 100 / nullif(a.total, 0)), 1) as avg_percent,
       max(a.score) as max_score, min(a.score) as min_score
  from exam_attempts a join papers p on p.id = a.paper_id
 where a.submitted_at is not null
 group by a.user_id, a.paper_id, p.paper_name, p.course_code, p.set_code, a.participant_type;

create or replace view lab_item_stats with (security_invoker = true) as
select a.user_id, r.key as item_id,
       count(*) as answered,
       count(*) filter (where r.value = 'true'::jsonb) as correct,
       count(*) filter (where a.participant_type = 'student') as answered_student,
       count(*) filter (where a.participant_type = 'buyer') as answered_buyer,
       round(count(*) filter (where r.value = 'true'::jsonb)::numeric / nullif(count(*), 0), 3) as p_value
  from exam_attempts a, jsonb_each(a.results) r
 where a.submitted_at is not null
 group by a.user_id, r.key;

-- อัปเดต items.p_value จากผลสอบจริง (รวมทุกกลุ่ม) — ใช้กับตัวกรอง "ข้อที่เด็กผิดบ่อย"
create or replace function public.refresh_item_p_values(p_min_answers int default 5)
returns int language sql security invoker set search_path = public as $$
  with s as (select item_id, p_value from lab_item_stats where user_id = auth.uid() and answered >= p_min_answers),
  u as (update items i set p_value = s.p_value from s where i.item_id = s.item_id and i.user_id = auth.uid() returning 1)
  select count(*)::int from u
$$;
grant execute on function public.refresh_item_p_values(int) to authenticated;

-- ตรวจผล
select course_code, count(*) from items group by course_code order by course_code;
