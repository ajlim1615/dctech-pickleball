-- DCTECH | Pickleball: add 55 Matina Shanghai employees missing from profiles
-- Source: Matina Shanghai Employees.xlsx. Applied to prod 2026-11-16. Default password: dctech123
-- Skipped: Michelle Gonzales (sheet email is placeholder test@dctechmicro.com)
-- Idempotent: skips emails that already have an auth user. The handle_new_user trigger creates
-- each profile; the final update sets display name / starting rating.
begin;

create temp table _seed(email text, full_name text, display_name text) on commit drop;
insert into _seed values
  ('rtuyor@dctechmicro.com', 'Rolando Tuyor', 'Rolando T.'),
  ('elim@dctechmicro.com', 'Eduardo Lim', 'Eduardo L.'),
  ('mjdespabiladeras@dctechmicro.com', 'Michael Jan Despabiladeras', 'Michael D.'),
  ('mmante@dctechmicro.com', 'Marlinint Mante', 'Marlinint M.'),
  ('djaglipa@dctechmicro.com', 'Daisy Jean Aglipa', 'Daisy A.'),
  ('ellabore@dctechmicro.com', 'Emmanuel Llabore Jr.', 'Emmanuel L.'),
  ('cmcervera@dctechmicro.com', 'Charles Maethor Cervera', 'Charles C.'),
  ('xrcodilla@dctechmicro.com', 'Xenia Ross Codilla', 'Xenia C.'),
  ('grvarquez@dctechmicro.com', 'Gerhart Royce Varquez', 'Gerhart V.'),
  ('rellazo@dctechmicro.com', 'Roderick Ellazo', 'Roderick E.'),
  ('mmorales@dctechmicro.com', 'Miguel Morales', 'Miguel M.'),
  ('game@dctechmicro.com', 'Ghilprim Ame', 'Ghilprim A.'),
  ('jrabellana@dctechmicro.com', 'Jhon Rey Abellana', 'Jhon A.'),
  ('rjzartiga@dctechmicro.com', 'Ryan Justin Zartiga', 'Ryan Z.'),
  ('gsanchez@dctechmicro.com', 'Gabriel Sanchez', 'Gabriel S.'),
  ('enudalo@dctechmicro.com', 'Elizer Nudalo', 'Elizer N.'),
  ('aestrelloso@dctechmicro.com', 'Anniecle Estrelloso', 'Anniecle E.'),
  ('cjdupilas@dctechmicro.com', 'Christine Dupilas', 'Christine D.'),
  ('mjcordova@dctechmicro.com', 'Mark Jayzel Cordova', 'Mark C.'),
  ('jgutierrez@dctechmicro.com', 'Julius Gutierrez', 'Julius G.'),
  ('btaojo@dctechmicro.com', 'Berfel Taojo', 'Berfel T.'),
  ('jmagudo@dctechmicro.com', 'Jelly Mae Agudo', 'Jelly A.'),
  ('mcabuyao@dctechmicro.com', 'Margie Cabuyao', 'Margie C.'),
  ('jmsunga@dctechmicro.com', 'John Marko Sunga', 'John S.'),
  ('jvaldez@dctechmicro.com', 'Jake Valdez', 'Jake V.'),
  ('mlrodriguez@dctechmicro.com', 'Myrrh Love Rodriguez', 'Myrrh R.'),
  ('lnaquila@dctechmicro.com', 'Loreto Naquila', 'Loreto N.'),
  ('gcnucum@dctechmicro.com', 'Gene Christian Nucum', 'Gene N.'),
  ('bpgulde@dctechmicro.com', 'Brent Paolo Gulde', 'Brent G.'),
  ('jmjuarez@dctechmicro.com', 'Jayfred Mark Juarez', 'Jayfred J.'),
  ('cperalta@dctechmicro.com', 'Claribel Peralta', 'Claribel P.'),
  ('aomandam@dctechmicro.com', 'Angelline Omandam', 'Angelline O.'),
  ('kbblancia@dctechmicro.com', 'Kurt Bernstein Blancia', 'Kurt B.'),
  ('jrnhualde@dctechmicro.com', 'Jeanroy Napoleon Hualde', 'Jeanroy H.'),
  ('aparescal@dctechmicro.com', 'Axel Parescal', 'Axel P.'),
  ('jmabano@dctechmicro.com', 'James Mabano', 'James M.'),
  ('msilagan@dctechmicro.com', 'Mabelle Silagan', 'Mabelle S.'),
  ('maquijano@dctechmicro.com', 'Maria Andrea Quijano', 'Maria Q.'),
  ('aibanez@dctechmicro.com', 'Alfer Ibañez', 'Alfer I.'),
  ('bbcanuto@dctechmicro.com', 'Beverly Babe Canuto', 'Beverly C.'),
  ('kgutierrez@dctechmicro.com', 'Kristine Gutierrez', 'Kristine G.'),
  ('rgementiza@dctechmicro.com', 'Rocelyn Gementiza', 'Rocelyn G.'),
  ('ammondoyo@dctechmicro.com', 'Alma Mae Mondoyo', 'Alma M.'),
  ('jgcunanan@dctechmicro.com', 'John Greggory Cunanan', 'John C.'),
  ('hhernani@dctechmicro.com', 'Hector Hernani', 'Hector H.'),
  ('ehernandez@dctechmicro.com', 'Eduardo Hernandez', 'Eduardo H.'),
  ('carevalo@dctechmicro.com', 'Cyril Arevalo', 'Cyril A.'),
  ('jsagudaquil@dctechmicro.com', 'Justin Sagudaquil', 'Justin S.'),
  ('jtutor@dctechmicro.com', 'Joven Tutor', 'Joven T.'),
  ('jmaraon@dctechmicro.com', 'Junie Maraon', 'Junie M.'),
  ('jtorres@dctechmicro.com', 'Jedidiah Torres', 'Jedidiah T.'),
  ('eabejuela@dctechmicro.com', 'Erika Abejuela', 'Erika A.'),
  ('mysilagan@dctechmicro.com', 'Myrez Silagan', 'Myrez S.'),
  ('rufrancisco@dctechmicro.com', 'Russell Francisco', 'Russell F.'),
  ('cjdiscaya@dctechmicro.com', 'Christian Jayson Discaya', 'Christian D.');

create temp table _new on commit drop as
select s.* from _seed s where not exists (select 1 from auth.users x where lower(x.email) = s.email);

insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', n.email,
       crypt('dctech123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('full_name', n.full_name), now(), now(), '', '', '', ''
from _new n;

insert into auth.identities (id,user_id,identity_data,provider,provider_id,created_at,updated_at)
select gen_random_uuid(), u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', u.id::text, now(), now()
from auth.users u join _new n on n.email = lower(u.email)
on conflict (provider, provider_id) do nothing;

update public.profiles p set full_name = n.full_name, display_name = n.display_name,
       role = 'player', skill_rating = 2.25, is_active = true
from auth.users u join _new n on n.email = lower(u.email)
where p.id = u.id;

commit;
