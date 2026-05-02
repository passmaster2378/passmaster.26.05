-- PASSmaster schema for Supabase Postgres

create table if not exists public.users (
  id bigserial primary key,
  name text not null,
  email text unique not null,
  password text not null,
  role text not null default 'user',
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id bigserial primary key,
  code text unique not null,
  title text not null,
  category text not null,
  price integer not null,
  status text not null,
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
