-- AlumniCar · convertir una cuenta en administradora
-- 1. Primero crea el usuario en Supabase → Authentication → Users → Add user
--    (correo + contraseña, con "Auto Confirm User" activado).
-- 2. Cambia el correo de abajo por el de esa cuenta y corre este archivo.

insert into public.admins (user_id)
select id from auth.users where email = 'CAMBIA-ESTE-CORREO@ejemplo.com'
on conflict (user_id) do nothing;

-- Para quitarle el acceso a alguien:
-- delete from public.admins where user_id = (select id from auth.users where email = 'correo@ejemplo.com');
