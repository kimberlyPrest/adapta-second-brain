export interface PluginSettings {
  supabaseUrl: string;
  supabaseKey: string;
  openaiApiKey: string;
  embeddingModel: 'text-embedding-3-small' | 'text-embedding-3-large';
  autoSync: boolean;
  realtimeSync: boolean;
  debug: boolean;
  deleteOnRemoteDelete: boolean;
  lastSyncStats: {
    files: number;
    sections: number;
    cost: number;
  };
}

export interface NoteSection {
  sectionOrder: number;
  heading: string | null;
  content: string;
  contentHash: string;
}

export interface ParsedNote {
  title: string;
  frontmatter: any;
  sections: NoteSection[];
  outboundLinks: string[];
  tags: string[];
  fullContent: string;
  fullHash: string;
}

export interface SyncStats {
  sectionsAdded: number;
  sectionsUpdated: number;
  sectionsUnchanged: number;
  sectionsDeleted: number;
  tokensUsed: number;
  costUsd: number;
}

export interface SimilarSection {
  id: string;
  noteId: string;
  filePath: string;
  title: string;
  sectionOrder: number;
  heading: string;
  score: number;
}

export interface SyncLogEntry {
  direction: 'local_to_remote' | 'remote_to_local';
  trigger: string;
  noteId?: string;
  filePath?: string;
  sectionsAdded?: number;
  sectionsUpdated?: number;
  sectionsUnchanged?: number;
  sectionsDeleted?: number;
  embeddingsConsumed?: number;
  tokensUsed?: number;
  costUsd?: number;
  error?: string;
}
