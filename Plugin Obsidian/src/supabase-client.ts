import { createClient, SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import { PluginSettings } from './types';
import { SyncLogEntry } from './types';

export class SupabaseClientWrapper {
  public client: SupabaseClient | null = null;
  private debug: boolean;

  constructor(settings: PluginSettings) {
    this.debug = settings.debug;
    if (settings.supabaseUrl && settings.supabaseKey) {
      this.client = createClient(settings.supabaseUrl, settings.supabaseKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
    }
  }

  private ensureClient(): SupabaseClient {
    if (!this.client) {
      throw new Error('Supabase não configurado. Verifique a URL e a Chave nas configurações do plugin.');
    }
    return this.client;
  }

  private log(msg: string) {
    if (this.debug) console.log('[Supabase]', msg);
  }

  async getNoteByPath(filePath: string) {
    const client = this.ensureClient();
    const { data, error } = await client
      .from('obsidian_notes')
      .select('*')
      .eq('file_path', filePath)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async upsertNote(note: { file_path: string; title: string; frontmatter: any; full_content: string; outbound_links: string[]; tags: string[]; hash_full: string }) {
    const client = this.ensureClient();
    const { error } = await client
      .from('obsidian_notes')
      .upsert(note, { onConflict: 'file_path' })
      .select();
    if (error) throw error;
  }

  async getNoteSections(noteId: string) {
    const client = this.ensureClient();
    const { data, error } = await client
      .from('obsidian_note_sections')
      .select('*')
      .eq('note_id', noteId)
      .order('section_order');
    if (error) throw error;
    return data || [];
  }

  async upsertSections(noteId: string, sections: any[]) {
    const client = this.ensureClient();
    const { error } = await client
      .from('obsidian_note_sections')
      .upsert(sections, { onConflict: 'note_id,section_order' });
    if (error) throw error;
  }

  async deleteSectionsByOrder(noteId: string, orders: number[]) {
    const client = this.ensureClient();
    const { error } = await client
      .from('obsidian_note_sections')
      .delete()
      .eq('note_id', noteId)
      .in('section_order', orders);
    if (error) throw error;
  }

  async deleteNote(filePath: string) {
    const client = this.ensureClient();
    const { error } = await client
      .from('obsidian_notes')
      .delete()
      .eq('file_path', filePath);
    if (error) throw error;
  }

  async logSync(entry: SyncLogEntry) {
    if (!this.client) return; // Skip logs if not configured
    const { error } = await this.client
      .from('obsidian_sync_log')
      .insert(entry);
    if (error) this.log(`Log error: ${error.message}`);
  }

  async searchSimilarSections(embedding: number[], excludeNoteId: string, limit = 10): Promise<any[]> {
    const client = this.ensureClient();
    // Assumes RPC 'match_obsidian_note_sections' exists in Supabase
    const { data, error } = await client.rpc('match_obsidian_note_sections', {
      query_embedding: embedding,
      similarity_threshold: 0.7,
      match_count: limit,
      exclude_note_id: excludeNoteId
    });
    if (error) throw error;
    return data || [];
  }

  subscribeToNoteChanges(callback: (payload: any) => void): () => void {
    // Check if we can even initialize a client
    if (!this.client) {
      console.warn('[Supabase] Cannot subscribe: Missing client');
      return () => {};
    }

    const client = this.ensureClient();
    // Unique channel name to avoid conflicts on re-subscriptions
    const channelId = `obsidian_sync_${Math.random().toString(36).substring(7)}`;
    
    const channel = client.channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'obsidian_notes'
        },
        (payload) => {
          if (this.debug) console.log('[Realtime] Change received:', payload);
          callback(payload);
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Supabase] Realtime subscription active');
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('[Supabase] Realtime error:', err);
        }
      });

    return () => {
      if (this.debug) console.log('[Realtime] Unsubscribing from', channelId);
      client.removeChannel(channel);
    };
  }

  async testConnection(url: string, key: string): Promise<boolean> {
    try {
      const client = this.client || createClient(url, key);
      const { data, error } = await client.from('obsidian_notes').select('id').limit(1);
      if (error) {
        const response = await fetch(`${url}/rest/v1/`, {
          headers: { apikey: key }
        });
        return response.ok;
      }
      return true;
    } catch {
      try {
        const response = await fetch(`${url}/rest/v1/`, {
          headers: { apikey: key }
        });
        return response.ok;
      } catch {
        return false;
      }
    }
  }
}
