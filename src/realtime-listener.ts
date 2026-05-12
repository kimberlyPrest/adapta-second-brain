import { Vault, TFile, Notice, normalizePath } from 'obsidian';
import { SupabaseClientWrapper } from './supabase-client';
import { PluginSettings } from './types';

export class RealtimeListener {
  private vault: Vault;
  private supabase: SupabaseClientWrapper;
  private settings: PluginSettings;
  private onRemoteUpdate: (path: string) => void;
  private unsubscribe?: () => void;

  constructor(
    vault: Vault,
    settings: PluginSettings,
    supabase: SupabaseClientWrapper,
    onRemoteUpdate: (path: string) => void
  ) {
    this.vault = vault;
    this.settings = settings;
    this.supabase = supabase;
    this.onRemoteUpdate = onRemoteUpdate;
  }

  start() {
    if (!this.supabase) return;
    if (this.unsubscribe) return; // Prevent double start

    this.unsubscribe = this.supabase.subscribeToNoteChanges((payload) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;
      const path = (newRecord || oldRecord)?.file_path;
      if (!path) return;

      switch (eventType) {
        case 'INSERT':
          this.handleRemoteInsert(path, newRecord);
          break;
        case 'UPDATE':
          this.handleRemoteUpdate(path, newRecord);
          break;
        case 'DELETE':
          this.handleRemoteDelete(path);
          break;
      }
    });
  }

  stop() {
    if (this.unsubscribe) this.unsubscribe();
  }

  /** Garante que toda a árvore de pastas existe antes de criar o arquivo */
  private async ensureFolderExists(filePath: string): Promise<void> {
    const normalized = normalizePath(filePath);
    const parts = normalized.split('/');
    parts.pop(); // remove filename
    if (parts.length === 0) return;

    let currentPath = '';
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const existing = this.vault.getAbstractFileByPath(currentPath);
      if (!existing) {
        try {
          await this.vault.createFolder(currentPath);
        } catch (e) {
          // Já existe ou erro — segue adiante
        }
      }
    }
  }

  private async handleRemoteInsert(path: string, record: any) {
    const file = this.vault.getAbstractFileByPath(path);
    if (file) return;

    try {
      await this.ensureFolderExists(path);
      this.onRemoteUpdate(path);
      await this.vault.create(path, record.full_content || '');
      new Notice(`📥 Nota criada via remoto: ${path}`);
    } catch (e) {
      new Notice(`Erro ao criar ${path}: ${e}`);
      console.error('[Realtime] Insert error:', e);
    }
  }

  private async handleRemoteUpdate(path: string, record: any) {
    const file = this.vault.getAbstractFileByPath(path) as TFile;
    if (!file) {
      return this.handleRemoteInsert(path, record);
    }

    try {
      const localContent = await this.vault.read(file);
      const { computeHash } = await import('./hash-utils');
      const localHash = await computeHash(localContent);
      if (localHash === record.hash_full) return;

      this.onRemoteUpdate(path);
      await this.vault.modify(file, record.full_content);
      new Notice(`🔄 Nota atualizada via remoto: ${path}`);
    } catch (e) {
      new Notice(`Erro ao atualizar ${path}: ${e}`);
      console.error('[Realtime] Update error:', e);
    }
  }

  private async handleRemoteDelete(path: string) {
    const file = this.vault.getAbstractFileByPath(path) as TFile;
    if (!file) return;

    try {
      this.onRemoteUpdate(path);
      if (this.settings.deleteOnRemoteDelete) {
        await this.vault.trash(file, true);
        new Notice(`🗑️ Nota deletada via remoto: ${path}`);
      }
    } catch (e) {
      new Notice(`Erro ao deletar ${path}: ${e}`);
      console.error('[Realtime] Delete error:', e);
    }
  }
}
