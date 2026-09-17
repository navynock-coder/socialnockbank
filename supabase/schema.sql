-- ============================================================================
-- SocialBank — คลังข้อสอบสังคมศึกษา ครูน็อค
-- Supabase schema migration
-- รันไฟล์นี้ทั้งหมดใน Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- 1) ตารางโรงเรียน
-- ============================================================================
create table if not exists schools (
  code text primary key,
  name_th text not null,
  is_active boolean default true,
  sort_order int default 0
);

insert into schools (code, name_th, sort_order) values
('STW','สตรีวิทยา',1),
('BDD1','บดินทรเดชา (สิงห์ สิงหเสนี)',2),
('BDD3','บดินทรเดชา (สิงห์ สิงหเสนี) 3',3),
('SKL','สวนกุหลาบวิทยาลัย',4),
('SSW','สามเสนวิทยาลัย',5),
('SKN','ศึกษานารี',6),
('WPS','วัดพระศรีมหาธาตุ',7),
('SWP','สาธิตวัดพระศรีมหาธาตุ บางเขน ,วัดพระศรีมหาธาตุ ',8),
('RTY','ฤทธิยะวรรณาลัย',9),
('BJR','เบญจมราชาลัย',10)
on conflict (code) do nothing;

-- ============================================================================
-- 2) ตารางคลังข้อสอบ (ตารางหลัก)
-- user_id ใช้คู่กับ Row Level Security — ผู้ใช้แต่ละคนเห็นเฉพาะข้อมูลของตัวเอง
-- ============================================================================
create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  item_id text unique not null,
  school text references schools(code),
  year int not null,
  pack text,
  exam_date date,
  strand text not null,
  topic text,
  subtopic text,
  bloom text not null,
  difficulty int check (difficulty between 1 and 5),
  stem text not null,
  choice_a text, choice_b text, choice_c text,
  choice_d text, choice_e text,
  answer text not null,
  explanation text,
  trap_type text,
  media_url text,
  stimulus_id text,
  status text default 'ใช้งาน',
  p_value numeric,
  times_used int default 0,
  created_at timestamptz default now(),
  user_id uuid references auth.users(id) default auth.uid(),

  -- Controlled Vocabulary — บังคับที่ระดับฐานข้อมูล ห้ามค่านอกรายการหลุดเข้ามา
  constraint chk_strand check (strand in ('ศาสนา','หน้าที่พลเมือง','เศรษฐศาสตร์','ประวัติศาสตร์','ภูมิศาสตร์')),
  constraint chk_bloom check (bloom in ('จำ','เข้าใจ','วิเคราะห์')),
  constraint chk_trap_type check (trap_type is null or trap_type in ('ไม่ใช่/ยกเว้น','ถูกครึ่งเดียว','อ่านตาราง-แผนภูมิ','สลับตัวเลข-ศักราช','คำใกล้เคียง','ไม่มีกับดัก')),
  constraint chk_status check (status in ('ใช้งาน','พักไว้','เก็บประวัติ')),
  constraint chk_answer check (answer in ('A','B','C','D','E')),
  constraint chk_pack check (pack is null or pack in ('PP62-63','PP63-64','PP64-65','PP65-66','PP66-67','PP67-68'))
);

create index if not exists idx_items_school on items(school);
create index if not exists idx_items_strand on items(strand);
create index if not exists idx_items_year on items(year);
create index if not exists idx_items_status on items(status);
create index if not exists idx_items_user on items(user_id);

-- ============================================================================
-- 3) ตารางบทความ/สิ่งเร้าที่ใช้ร่วมหลายข้อ
-- ============================================================================
create table if not exists stimulus (
  stimulus_id text primary key,
  school text,
  year int,
  content text,
  media_url text,
  user_id uuid references auth.users(id) default auth.uid()
);

-- ============================================================================
-- 4) ตารางชุดข้อสอบที่สร้างแล้ว
-- ============================================================================
create table if not exists papers (
  id uuid primary key default gen_random_uuid(),
  paper_name text not null,
  mode text,
  config jsonb,
  item_ids text[],
  total_items int,
  created_at timestamptz default now(),
  user_id uuid references auth.users(id) default auth.uid()
);

create index if not exists idx_papers_user on papers(user_id);

-- ============================================================================
-- 5) Row Level Security
-- schools: อ่านได้ทุกคนที่ล็อกอิน (ข้อมูลอ้างอิงกลาง ไม่ผูกผู้ใช้)
-- items / stimulus / papers: เห็น/แก้/ลบเฉพาะแถวของตัวเอง (user_id = auth.uid())
-- ============================================================================
alter table schools enable row level security;
alter table items enable row level security;
alter table stimulus enable row level security;
alter table papers enable row level security;

drop policy if exists "schools_select_authenticated" on schools;
create policy "schools_select_authenticated" on schools
  for select using (auth.role() = 'authenticated');

drop policy if exists "items_select_own" on items;
create policy "items_select_own" on items
  for select using (auth.uid() = user_id);

drop policy if exists "items_insert_own" on items;
create policy "items_insert_own" on items
  for insert with check (auth.uid() = user_id);

drop policy if exists "items_update_own" on items;
create policy "items_update_own" on items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "items_delete_own" on items;
create policy "items_delete_own" on items
  for delete using (auth.uid() = user_id);

drop policy if exists "stimulus_select_own" on stimulus;
create policy "stimulus_select_own" on stimulus
  for select using (auth.uid() = user_id);
drop policy if exists "stimulus_insert_own" on stimulus;
create policy "stimulus_insert_own" on stimulus
  for insert with check (auth.uid() = user_id);
drop policy if exists "stimulus_update_own" on stimulus;
create policy "stimulus_update_own" on stimulus
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "stimulus_delete_own" on stimulus;
create policy "stimulus_delete_own" on stimulus
  for delete using (auth.uid() = user_id);

drop policy if exists "papers_select_own" on papers;
create policy "papers_select_own" on papers
  for select using (auth.uid() = user_id);
drop policy if exists "papers_insert_own" on papers;
create policy "papers_insert_own" on papers
  for insert with check (auth.uid() = user_id);
drop policy if exists "papers_update_own" on papers;
create policy "papers_update_own" on papers
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "papers_delete_own" on papers;
create policy "papers_delete_own" on papers
  for delete using (auth.uid() = user_id);

-- ============================================================================
-- 6) Storage bucket สำหรับรูปภาพประกอบข้อสอบ
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('exam-media', 'exam-media', true)
on conflict (id) do nothing;

drop policy if exists "exam_media_read_public" on storage.objects;
create policy "exam_media_read_public" on storage.objects
  for select using (bucket_id = 'exam-media');

drop policy if exists "exam_media_insert_own" on storage.objects;
create policy "exam_media_insert_own" on storage.objects
  for insert with check (bucket_id = 'exam-media' and auth.role() = 'authenticated');

drop policy if exists "exam_media_update_own" on storage.objects;
create policy "exam_media_update_own" on storage.objects
  for update using (bucket_id = 'exam-media' and owner = auth.uid());

drop policy if exists "exam_media_delete_own" on storage.objects;
create policy "exam_media_delete_own" on storage.objects
  for delete using (bucket_id = 'exam-media' and owner = auth.uid());

-- ============================================================================
-- เสร็จสิ้น: ตาราง schools มีข้อมูล 10 โรงเรียนพร้อมใช้
-- ตาราง items / stimulus / papers ว่างเปล่า — ห้ามใส่ข้อมูลตัวอย่างที่แต่งขึ้นเอง
-- นำเข้าข้อมูลจริงผ่านหน้า "นำเข้าข้อมูล" ในแอปเท่านั้น
-- ============================================================================
