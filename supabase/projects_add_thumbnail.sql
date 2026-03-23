alter table public.projects
add column if not exists thumbnail_data_url text;

comment on column public.projects.thumbnail_data_url is 'Small data URL thumbnail preview for quick project recognition in the projects grid.';
