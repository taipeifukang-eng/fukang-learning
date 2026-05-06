-- 建立課程封面圖 Storage Bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-covers',
  'course-covers',
  true,
  5242880,  -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- 允許已登入使用者上傳
create policy "auth users can upload course covers"
on storage.objects for insert
to authenticated
with check (bucket_id = 'course-covers');

-- 允許所有人讀取（public bucket）
create policy "anyone can read course covers"
on storage.objects for select
to public
using (bucket_id = 'course-covers');

-- 允許已登入使用者更新/刪除
create policy "auth users can update course covers"
on storage.objects for update
to authenticated
using (bucket_id = 'course-covers');

create policy "auth users can delete course covers"
on storage.objects for delete
to authenticated
using (bucket_id = 'course-covers');
