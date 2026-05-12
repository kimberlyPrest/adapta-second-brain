-- 1. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Tabela principal de notas
CREATE TABLE IF NOT EXISTS obsidian_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    file_path text NOT NULL UNIQUE,
    title text NOT NULL,
    frontmatter jsonb NOT NULL DEFAULT '{}'::jsonb,
    full_content text NOT NULL DEFAULT '',
    outbound_links text[] NOT NULL DEFAULT ARRAY[]::text[],
    tags text[] NOT NULL DEFAULT ARRAY[]::text[],
    hash_full text,
    last_synced_at timestamptz DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    client_id uuid,
    related_message_ids text[] DEFAULT ARRAY[]::text[],
    origin_type text DEFAULT 'manual'
);

-- 3. Tabela de seções (para busca semântica granular)
CREATE TABLE IF NOT EXISTS obsidian_note_sections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id uuid NOT NULL REFERENCES obsidian_notes(id) ON DELETE CASCADE,
    section_order int NOT NULL,
    heading text,
    content text NOT NULL,
    content_hash text NOT NULL,
    embedding vector(1536), -- Compatível com OpenAI text-embedding-3-small
    embedded_at timestamptz,
    UNIQUE(note_id, section_order)
);

-- 4. Tabela de Logs de Sincronização
CREATE TABLE IF NOT EXISTS obsidian_sync_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    file_path text NOT NULL,
    status text NOT NULL, -- 'success', 'error'
    message text,
    timestamp timestamptz DEFAULT now()
);

-- 5. Função de Busca Semântica (RPC)
CREATE OR REPLACE FUNCTION match_obsidian_note_sections (
  query_embedding vector(1536),
  similarity_threshold float,
  match_count int,
  exclude_note_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  note_id uuid,
  heading text,
  content text,
  similarity float,
  file_path text,
  title text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sections.id,
    sections.note_id,
    sections.heading,
    sections.content,
    1 - (sections.embedding <=> query_embedding) AS similarity,
    notes.file_path,
    notes.title
  FROM obsidian_note_sections AS sections
  JOIN obsidian_notes AS notes ON sections.note_id = notes.id
  WHERE (1 - (sections.embedding <=> query_embedding) > similarity_threshold)
    AND (exclude_note_id IS NULL OR sections.note_id <> exclude_note_id)
  ORDER BY sections.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 6. Índices para Performance
CREATE INDEX IF NOT EXISTS obsidian_notes_file_path_idx ON obsidian_notes (file_path);
CREATE INDEX IF NOT EXISTS obsidian_note_sections_note_id_idx ON obsidian_note_sections (note_id);

-- Índice HNSW para busca semântica ultra-rápida
-- Nota: Pode demorar alguns segundos para criar se houver muitos dados
CREATE INDEX IF NOT EXISTS obsidian_note_sections_embedding_idx ON obsidian_note_sections 
USING hnsw (embedding vector_cosine_ops);

-- 7. Configuração do Realtime
-- Adiciona as tabelas à publicação de realtime (se já existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE obsidian_notes;
    ALTER PUBLICATION supabase_realtime ADD TABLE obsidian_note_sections;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;
