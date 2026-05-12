import { TFile, Vault } from 'obsidian';
import { parseNote, computeSectionHashes } from './note-parser';
import { computeHash } from './hash-utils';
import { SupabaseClientWrapper } from './supabase-client';
import { EmbeddingService } from './embedding-service';
import { PluginSettings } from './types';
import { SyncStats, SyncLogEntry, ParsedNote, NoteSection } from './types';

export class SyncEngine {
  private vault: Vault;
  private supabase: SupabaseClientWrapper;
  private embeddings: EmbeddingService;
  private settings: PluginSettings;
  public queue: Array<{ type: 'sync' | 'delete' | 'rename'; path: string; oldPath?: string }> = [];
  private isProcessingQueue = false;

  constructor(vault: Vault, settings: PluginSettings) {
    this.vault = vault;
    this.settings = settings;
    this.supabase = new SupabaseClientWrapper(settings);
    this.embeddings = new EmbeddingService(settings);
  }

  async processQueue() {
    if (this.isProcessingQueue || !this.queue.length) return;
    this.isProcessingQueue = true;
    while (this.queue.length > 0) {
      const op = this.queue.shift()!;
      try {
        if (op.type === 'sync') {
          await this.syncFileByPath(op.path);
        } else if (op.type === 'delete') {
          await this.deleteFile(op.path);
        } else if (op.type === 'rename') {
          await this.deleteFile(op.oldPath!);
          await this.syncFileByPath(op.path);
        }
      } catch (e) {
        console.error('Queue op failed:', e);
        // Requeue?
      }
    }
    this.isProcessingQueue = false;
  }

  private async syncFileByPath(path: string) {
    const file = this.vault.getAbstractFileByPath(path) as TFile | null;
    if (!file || file.extension !== 'md') return;
    return this.syncFile(file);
  }

  async syncFile(file: TFile): Promise<SyncStats | null> {
    try {
      const content = await this.vault.read(file);
      let parsed = await parseNote(content, file.path);
      const fullParsed = await computeSectionHashes(parsed);

      const existingNote = await this.supabase.getNoteByPath(file.path);
      if (existingNote && existingNote.hash_full === fullParsed.fullHash) {
        await this.supabase.logSync({
          direction: 'local_to_remote',
          trigger: 'file_save',
          filePath: file.path,
          sectionsUnchanged: fullParsed.sections.length
        });
        return {
          sectionsAdded: 0,
          sectionsUpdated: 0,
          sectionsUnchanged: fullParsed.sections.length,
          sectionsDeleted: 0,
          tokensUsed: 0,
          costUsd: 0
        };
      }

      // Get existing sections
      let existingSectionsMap: Map<number, any> = new Map();
      let noteId = existingNote?.id;
      if (existingNote) {
        const existingSecs = await this.supabase.getNoteSections(existingNote.id);
        existingSecs.forEach(s => existingSectionsMap.set(s.section_order, s));
      } else {
        // New note, create
        await this.supabase.upsertNote({
          file_path: file.path,
          title: fullParsed.title,
          frontmatter: fullParsed.frontmatter,
          full_content: fullParsed.fullContent,
          outbound_links: fullParsed.outboundLinks,
          tags: fullParsed.tags,
          hash_full: fullParsed.fullHash
        });
        const newNote = await this.supabase.getNoteByPath(file.path);
        noteId = newNote!.id;
      }

      // Diff sections
      const currentSectionsMap = new Map(fullParsed.sections.map(s => [s.sectionOrder, s]));
      const existingOrders = Array.from(existingSectionsMap.keys()).sort((a,b)=>a-b);
      const currentOrders = Array.from(currentSectionsMap.keys()).sort((a,b)=>a-b);

      const added: NoteSection[] = [];
      const updated: NoteSection[] = [];
      let unchanged = 0;
      const deleted: number[] = [];

      // Detect added/updated/deleted
      for (const order of currentOrders) {
        const curr = currentSectionsMap.get(order)!;
        const exist = existingSectionsMap.get(order);
        if (!exist || exist.content_hash !== curr.contentHash) {
          if (exist) {
            updated.push(curr as NoteSection);
          } else {
            added.push(curr as NoteSection);
          }
        } else {
          unchanged++;
        }
      }

      for (const order of existingOrders) {
        if (!currentSectionsMap.has(order)) {
          deleted.push(order);
        }
      }

      // Embed changed
      let embedStats = { embeddings: [] as number[][], tokens: 0, cost: 0 };
      const toEmbed = [...added, ...updated].map(s => s.content);
      if (toEmbed.length > 0) {
        embedStats = await this.embeddings.embedBatch(toEmbed);
      }

      // Prepare sections for upsert
      const upsertSections = [...added, ...updated].map((s, idx) => ({
        note_id: noteId!,
        section_order: s.sectionOrder,
        heading: s.heading,
        content: s.content,
        content_hash: s.contentHash,
        embedding: embedStats.embeddings[idx]
      }));

      // Upsert note with updated full_content etc
      await this.supabase.upsertNote({
        file_path: file.path,
        title: fullParsed.title,
        frontmatter: fullParsed.frontmatter,
        full_content: fullParsed.fullContent,
        outbound_links: fullParsed.outboundLinks,
        tags: fullParsed.tags,
        hash_full: fullParsed.fullHash
      });

      if (upsertSections.length > 0) {
        await this.supabase.upsertSections(noteId!, upsertSections);
      }
      if (deleted.length > 0) {
        await this.supabase.deleteSectionsByOrder(noteId!, deleted);
      }

      const stats: SyncStats = {
        sectionsAdded: added.length,
        sectionsUpdated: updated.length,
        sectionsUnchanged: unchanged,
        sectionsDeleted: deleted.length,
        tokensUsed: embedStats.tokens,
        costUsd: embedStats.cost
      };

      await this.supabase.logSync({
        direction: 'local_to_remote',
        trigger: 'file_save',
        noteId: noteId!,
        filePath: file.path,
        ...stats,
        embeddingsConsumed: toEmbed.length
      });

      return stats;
    } catch (error: any) {
      console.error('Sync error:', error);
      await this.supabase.logSync({
        direction: 'local_to_remote',
        trigger: 'file_save',
        filePath: file.path,
        error: error.message
      });
      this.queue.push({ type: 'sync', path: file.path });
      throw error;
    }
  }

  async deleteFile(path: string) {
    try {
      await this.supabase.deleteNote(path);
      await this.supabase.logSync({
        direction: 'local_to_remote',
        trigger: 'file_delete',
        filePath: path
      });
    } catch (error: any) {
      this.queue.push({ type: 'delete', path });
      throw error;
    }
  }

  async reindexVault(): Promise<{ totalFiles: number; totalSections: number; totalCost: number }> {
    const files = this.vault.getMarkdownFiles();
    let totalFiles = 0;
    let totalSections = 0;
    let totalCost = 0;

    for (const file of files) {
      const stats = await this.syncFile(file);
      if (stats) {
        totalSections += stats.sectionsAdded + stats.sectionsUpdated + stats.sectionsUnchanged + stats.sectionsDeleted;
        totalCost += stats.costUsd;
        totalFiles++;
      }
    }

    return { totalFiles, totalSections, totalCost };
  }

  async reindexCurrent(app: any) {
    const activeFile = app.workspace.getActiveFile();
    if (!activeFile) throw new Error('Nenhuma nota ativa');
    await this.syncFile(activeFile);
  }
}
