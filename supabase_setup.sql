-- =====================================================
-- AMARANTA VISOR — Supabase Database Setup (Roles: Admin y Comisionista)
-- Ejecutar en: Dashboard → SQL Editor → New query
-- =====================================================

-- 1. Tabla de perfiles y roles de usuario
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT,
  nombre     TEXT,
  rol        TEXT NOT NULL DEFAULT 'comisionista'
               CHECK (rol IN ('admin', 'comisionista')),
  activo     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Asegurar columna email si la tabla ya existía
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN email TEXT;
  END IF;
END $$;

-- 2. Tabla de estado comercial de lotes
CREATE TABLE IF NOT EXISTS public.lotes (
  id_lote     TEXT PRIMARY KEY,
  estado      TEXT NOT NULL DEFAULT 'DISPONIBLE'
                CHECK (estado IN ('DISPONIBLE', 'SEPARADO', 'VENDIDO')),
  propietario TEXT,
  documento   TEXT,
  telefono    TEXT,
  precio      NUMERIC,
  vendedor    TEXT,
  observacion TEXT,
  fecha_sep   DATE,
  fecha_venta DATE,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_by  UUID REFERENCES auth.users(id)
);

-- 3. Función para obtener el rol del usuario autenticado actual
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT COALESCE((SELECT rol FROM public.profiles WHERE id = auth.uid()), 'comisionista');
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- 4. Activar Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes    ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS — Profiles
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_insert_auth" ON public.profiles;
CREATE POLICY "profiles_insert_auth" ON public.profiles
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "profiles_update_admin_or_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_admin_or_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR public.get_my_role() = 'admin')
  WITH CHECK (auth.uid() = id OR public.get_my_role() = 'admin');

-- 6. Políticas RLS — Lotes (Lectura pública / comisionistas, edición para Administradores y autenticados)
DROP POLICY IF EXISTS "lotes_select_all" ON public.lotes;
DROP POLICY IF EXISTS "lotes_select_authenticated" ON public.lotes;
CREATE POLICY "lotes_select_all" ON public.lotes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "lotes_insert_auth" ON public.lotes;
CREATE POLICY "lotes_insert_auth" ON public.lotes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "lotes_update_auth" ON public.lotes;
DROP POLICY IF EXISTS "lotes_update_admin_vendedor" ON public.lotes;
CREATE POLICY "lotes_update_auth" ON public.lotes
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 7. Trigger: crear perfil automáticamente al registrar un usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  users_count INT;
  initial_role TEXT;
BEGIN
  -- Si es el primer usuario en la app, asignarlo como admin. Los siguientes como comisionista.
  SELECT COUNT(*) INTO users_count FROM public.profiles;
  IF users_count = 0 THEN
    initial_role := 'admin';
  ELSE
    initial_role := 'comisionista';
  END IF;

  INSERT INTO public.profiles (id, email, nombre, rol)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', REPLACE(NEW.email, '@amaranta.local', '')),
    initial_role
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        nombre = COALESCE(EXCLUDED.nombre, public.profiles.nombre);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Insertar los 99 lotes con estado inicial DISPONIBLE
INSERT INTO public.lotes (id_lote) VALUES
  ('L-001'), ('L-002'), ('L-003'), ('L-004'), ('L-005'),
  ('L-006'), ('L-007'), ('L-008'), ('L-009'), ('L-010'),
  ('L-011'), ('L-012'), ('L-013'), ('L-014'), ('L-015'),
  ('L-016'), ('L-017'), ('L-018'), ('L-019'), ('L-020'),
  ('L-021'), ('L-022'), ('L-023'), ('L-024'), ('L-025'),
  ('L-026'), ('L-027'), ('L-028'), ('L-029'), ('L-030'),
  ('L-031'), ('L-032'), ('L-033'), ('L-034'), ('L-035'),
  ('L-036'), ('L-037'), ('L-038'), ('L-039'), ('L-040'),
  ('L-041'), ('L-042'), ('L-043'), ('L-044'), ('L-045'),
  ('L-046'), ('L-047'), ('L-048'), ('L-049'), ('L-050'),
  ('L-051'), ('L-052'), ('L-053'), ('L-054'), ('L-055'),
  ('L-056'), ('L-057'), ('L-058'), ('L-059'), ('L-060'),
  ('L-061'), ('L-062'), ('L-063'), ('L-064'), ('L-065'),
  ('L-066'), ('L-067'), ('L-068'), ('L-069'), ('L-070'),
  ('L-071'), ('L-072'), ('L-073'), ('L-074'), ('L-075'),
  ('L-076'), ('L-077'), ('L-078'), ('L-079'), ('L-080'),
  ('L-081'), ('L-082'), ('L-083'), ('L-084'), ('L-085'),
  ('L-086'), ('L-087'), ('L-088'), ('L-089'), ('L-090'),
  ('L-091'), ('L-092'), ('L-093'), ('L-094'), ('L-095'),
  ('L-096'), ('L-097'), ('L-098'), ('L-099')
ON CONFLICT (id_lote) DO NOTHING;

-- 9. Configurar Realtime
ALTER TABLE public.lotes REPLICA IDENTITY FULL;
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE public.lotes;

-- =====================================================
-- PARA ASIGNAR TU USUARIO COMO ADMIN:
-- UPDATE public.profiles SET rol = 'admin' WHERE email = 'tu-email@gmail.com';
-- =====================================================

