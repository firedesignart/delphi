-- Delphi — Schema do Banco de Dados
-- Execute no Supabase SQL Editor

-- Tabela de projetos (cada vídeo enviado vira um projeto)
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Assets de mídia (vídeos enviados)
CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  original_filename TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size BIGINT NOT NULL,
  duration FLOAT,
  width INTEGER,
  height INTEGER,
  fps FLOAT,
  status TEXT NOT NULL DEFAULT 'UPLOADED'
    CHECK (status IN ('UPLOADING','UPLOADED','PROCESSING','READY','FAILED')),
  storage_path TEXT NOT NULL,
  thumbnail_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Clips detectados pela IA
CREATE TABLE IF NOT EXISTS clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_asset_id UUID REFERENCES media_assets(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time FLOAT NOT NULL,
  end_time FLOAT NOT NULL,
  duration FLOAT NOT NULL,
  hook_score INTEGER NOT NULL DEFAULT 0,
  emotion_score INTEGER NOT NULL DEFAULT 0,
  narrative_score INTEGER NOT NULL DEFAULT 0,
  energy_score INTEGER NOT NULL DEFAULT 0,
  total_score INTEGER NOT NULL DEFAULT 0,
  transcript TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Itens de conteúdo (aprovados para publicação)
CREATE TABLE IF NOT EXISTS content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id UUID REFERENCES clips(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL DEFAULT 'default',
  title TEXT NOT NULL,
  description TEXT,
  hashtags TEXT[] DEFAULT '{}',
  platforms TEXT[] DEFAULT '{"youtube"}',
  status TEXT NOT NULL DEFAULT 'NEEDS_REVIEW'
    CHECK (status IN ('GENERATED','NEEDS_REVIEW','APPROVED','SCHEDULED','PUBLISHED','FAILED','ARCHIVED')),
  quality_score INTEGER,
  virality_score INTEGER,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  youtube_video_id TEXT,
  youtube_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Storage bucket (crie manualmente no painel do Supabase)
-- Nome: "media"
-- Tipo: Public (para thumbnails) ou Private (para vídeos)

-- RLS básico (habilite conforme necessário)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas para desenvolvimento (restrinja em produção)
CREATE POLICY "allow_all_projects" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_media" ON media_assets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_clips" ON clips FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_content" ON content_items FOR ALL USING (true) WITH CHECK (true);
