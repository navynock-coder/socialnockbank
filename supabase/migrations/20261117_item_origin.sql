-- ============================================================================
-- SocialBank — แยก "ที่มา" ของข้อสอบให้ชัด (ข้อสอบจริง / ข้อสอบคอร์ส) + โรงเรียนเป้าหมาย
-- รันไฟล์นี้ใน Supabase SQL Editor หลัง 20261116_exam_studio_time_gate.sql
-- รันซ้ำได้ (idempotent) ไม่ลบข้อมูลเดิม
--
-- ก่อนหน้านี้ระบบเดาที่มาจาก school / source / หัว item_id ทำให้ "คอร์สเข้าเตรียม 69" (TUC)
-- ถูกนับเป็นข้อสอบจริงของเตรียมอุดมฯ ตอนนี้แยกเป็น 2 ช่อง:
--   origin         = 'ข้อสอบจริง' (ข้อสอบเข้าของโรงเรียน: school + year)
--                  | 'ข้อสอบคอร์ส' (ข้อในคอร์สติวครูน็อค: course_code + set_code)
--   target_school  = โรงเรียนที่คอร์สนั้นมุ่งสอบเข้า เช่น TUC → TU (ข้อสอบจริงใช้ school ตามเดิม)
-- ============================================================================

-- โรงเรียนเตรียมอุดมศึกษา (ใช้ทั้งข้อสอบจริง 60–69 และเป้าหมายของคอร์ส TUC)
insert into schools (code, name_th, sort_order) values ('TU', 'เตรียมอุดมศึกษา', 0)
on conflict (code) do nothing;

alter table items add column if not exists origin text;
alter table items add column if not exists target_school text references schools(code);

alter table items drop constraint if exists chk_origin;
alter table items add constraint chk_origin check (origin is null or origin in ('ข้อสอบจริง', 'ข้อสอบคอร์ส')) not valid;

create index if not exists idx_items_origin on items(origin);
create index if not exists idx_items_target_school on items(target_school);

-- ----------------------------------------------------------------------------
-- เติมค่าให้ทุกแถว (ทั้งข้อเก่าและข้อที่นำเข้าใหม่) ด้วย trigger เดียวกัน
-- กติกาเดียวกับ itemOrigin() / itemTargetSchool() ใน src/lib/labItem.ts
-- ----------------------------------------------------------------------------
create or replace function items_fill_origin() returns trigger language plpgsql as $$
begin
  -- รหัสคอร์ส/ชุดจาก item_id (ถ้ายังว่าง)
  if new.course_code is null then
    if new.item_id ~ '^P[0-9]C[0-9]+-[0-9]+-' then
      new.course_code := substring(new.item_id from '^(P[0-9]C[0-9]+)-');
      new.set_code := coalesce(new.set_code, 'EP' || substring(new.item_id from '^P[0-9]C[0-9]+-([0-9]+)-'));
    elsif new.item_id ~ '^KTP[0-9]*-[A-Z]+[0-9]+-' then
      new.course_code := 'KTP';
      new.set_code := coalesce(new.set_code, substring(new.item_id from '^KTP[0-9]*-([A-Z]+[0-9]+)-'));
    elsif new.item_id ~ '^TUC-[A-Z]+[0-9]+-' then
      new.course_code := 'TUC';
      new.set_code := coalesce(new.set_code, substring(new.item_id from '^TUC-([A-Z]+[0-9]+)-'));
    end if;
  end if;

  if new.origin is null then
    new.origin := case
      when new.course_code is not null or coalesce(new.source, '') like 'คอร์ส%' then 'ข้อสอบคอร์ส'
      else 'ข้อสอบจริง'
    end;
  end if;

  if new.target_school is null and new.origin = 'ข้อสอบคอร์ส'
     and (new.course_code = 'TUC' or coalesce(new.source, '') like '%เตรียม%') then
    new.target_school := 'TU';
  end if;
  return new;
end $$;

drop trigger if exists trg_items_fill_origin on items;
create trigger trg_items_fill_origin before insert or update of item_id, source, course_code, origin, target_school
  on items for each row execute function items_fill_origin();

-- ปลุก trigger ให้แถวเดิมทั้งหมด
update items set origin = null where origin is null;

-- ----------------------------------------------------------------------------
-- ตรวจผล: ควรเห็น ม.3 แยกเป็น "ข้อสอบคอร์ส · TUC · เป้า TU" กับ "ข้อสอบจริง · TU" (ถ้านำเข้าแล้ว)
-- ----------------------------------------------------------------------------
-- select grade_level, origin, coalesce(school, target_school) as รร, course_code, count(*)
--   from items group by 1, 2, 3, 4 order by 1, 2, 3, 4;
