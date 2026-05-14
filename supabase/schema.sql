-- ============================================================
-- KajianBaru — Supabase Database Schema
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Table: kajian
-- ============================================================
CREATE TABLE kajian (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kota TEXT NOT NULL,
  tanggal_masehi TEXT NOT NULL,
  tanggal_hijriyah TEXT NOT NULL DEFAULT '',
  materi TEXT NOT NULL,
  pemateri TEXT NOT NULL,
  waktu_mulai TEXT NOT NULL,
  waktu_selesai TEXT NOT NULL DEFAULT 'Selesai',
  tempat TEXT NOT NULL,
  alamat TEXT NOT NULL DEFAULT '',
  maps_url TEXT NOT NULL DEFAULT '',
  kontak TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT 'UMUM' CHECK (audience IN ('UMUM', 'IKHWAN', 'AKHWAT')),
  poster_url TEXT,
  gradient_config JSONB NOT NULL DEFAULT '{"from":"#1a4731","to":"#2d7a4f","angle":135}'::jsonb,
  source_text TEXT NOT NULL DEFAULT '',
  himbauan TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_kajian_tanggal ON kajian (tanggal_masehi);
CREATE INDEX idx_kajian_kota ON kajian (kota);
CREATE INDEX idx_kajian_pemateri ON kajian (pemateri);
CREATE INDEX idx_kajian_kota_tanggal ON kajian (kota, tanggal_masehi);

-- ============================================================
-- Table: admin_users
-- ============================================================
CREATE TABLE admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'ADMIN_KOTA' CHECK (role IN ('SUPER_ADMIN', 'ADMIN_KOTA')),
  kota_access TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Table: user_preferences
-- ============================================================
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kota_list TEXT[] NOT NULL DEFAULT '{}',
  audience_filter TEXT[] NOT NULL DEFAULT '{}',
  push_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  push_subscription JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================================
-- Table: push_subscriptions
-- ============================================================
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================================
-- Triggers: updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_kajian_updated_at
  BEFORE UPDATE ON kajian
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- RLS Policies
-- ============================================================

-- kajian: public read, admin write
ALTER TABLE kajian ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kajian_public_read" ON kajian
  FOR SELECT USING (true);

CREATE POLICY "kajian_admin_insert" ON kajian
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

CREATE POLICY "kajian_admin_update" ON kajian
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

CREATE POLICY "kajian_admin_delete" ON kajian
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid())
  );

-- ============================================================
-- Security Helpers: Memutus rantai Infinite Recursion di RLS
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- Berjalan dengan hak akses admin, membypass RLS!
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
  );
END;
$$;

-- admin_users: only super admin can manage
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- User biasa bisa membaca baris data milik mereka sendiri tanpa perulangan
CREATE POLICY "admin_users_read" ON admin_users
  FOR SELECT USING (auth.uid() = id OR public.is_super_admin());

-- Hanya Super Admin yang bisa mengubah-ubah/menghapus admin lain
CREATE POLICY "admin_users_manage" ON admin_users
  FOR ALL USING (public.is_super_admin());

-- user_preferences: users can only access their own
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_preferences_own" ON user_preferences
  FOR ALL USING (auth.uid() = user_id);

-- push_subscriptions: users can only access their own
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions_own" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);
