-- PASSmaster seed data for Supabase Postgres
-- Note: Replace password hashes in production.

insert into public.users (name, email, password, role) values
('관리자', 'admin@passmaster.kr', '$2b$10$rYy4VK8Q3y2GXQ3mExdL4O9M.3l12YxYxQ4VhF7h0uM9l2Yxw4xDO', 'admin'),
('김수강', 'student1@passmaster.kr', '$2b$10$0gqjKp7S9jNfd9KjzUx7v.9c/F4k2uXLfmlf5F86eWfYebdwq9sN.', 'user'),
('박학습', 'student2@passmaster.kr', '$2b$10$0gqjKp7S9jNfd9KjzUx7v.9c/F4k2uXLfmlf5F86eWfYebdwq9sN.', 'user')
on conflict (email) do nothing;

insert into public.courses (code, title, category, price, status) values
('forklift', '지게차기능사 국가자격증 필기 문제 풀이', '기능사·장비', 9900, 'open'),
('electric', '전기기능사 국가자격증 필기 문제 풀이', '전기', 9900, 'open'),
('makeup', '메이크업 미용사 국가자격증 필기 문제 풀이', '미용', 9900, 'open')
on conflict (code) do nothing;
