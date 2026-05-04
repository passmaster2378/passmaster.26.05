-- PASSmaster schema for Supabase Postgres

create table if not exists public.users (
  id bigserial primary key,
  name text not null,
  email text unique not null,
  password text,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  google_id text,
  kakao_id text
);

create unique index if not exists users_google_id_uidx on public.users (google_id) where google_id is not null;
create unique index if not exists users_kakao_id_uidx on public.users (kakao_id) where kakao_id is not null;

create table if not exists public.courses (
  id bigserial primary key,
  code text unique not null,
  title text not null,
  category text not null,
  price integer not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.course_openings (
  id bigserial primary key,
  course_id bigint not null references public.courses(id) on delete cascade,
  start_date date,
  end_date date,
  application_status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists public.enrollments (
  id bigserial primary key,
  user_id bigint not null references public.users(id) on delete cascade,
  course_id bigint not null references public.courses(id) on delete cascade,
  payment_status text not null,
  approval_status text not null,
  progress_percent integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.enrollments add column if not exists opening_id bigint;
alter table public.enrollments add column if not exists application_status text;
alter table public.enrollments add column if not exists learning_status text;

create table if not exists public.payments (
  id bigserial primary key,
  enrollment_id bigint not null references public.enrollments(id) on delete cascade,
  amount integer not null,
  method text not null default 'bank_transfer',
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.faqs (
  id bigserial primary key,
  category text not null,
  question text not null,
  answer text not null,
  view_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.inquiries (
  id bigserial primary key,
  user_name text not null,
  type text not null,
  title text not null,
  content text not null,
  status text not null,
  assignee_name text,
  status_updated_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.inquiry_messages (
  id bigserial primary key,
  inquiry_id bigint not null references public.inquiries(id) on delete cascade,
  author_role text not null,
  author_name text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id bigserial primary key,
  course_code text not null,
  author_name text not null,
  score integer not null,
  content text not null,
  status text not null,
  created_at timestamptz not null default now()
);
