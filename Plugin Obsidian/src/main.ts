import { Plugin, TFile, TAbstractFile, Notice, Modal, App, Setting } from 'obsidian';
import { AdaptaSettingsTab } from './settings';
import { PluginSettings } from './types';
import { SyncEngine } from './sync-engine';
import { RealtimeListener } from './realtime-listener';
import { SupabaseClientWrapper } from './supabase-client';
import { EmbeddingService } from './embedding-service';
import { LinkSuggesterModal } from './link-suggester';

const DEFAULT_SETTINGS: PluginSettings = {
  supabaseUrl: '',
  supabaseKey: '',
  openaiApiKey: '',
  embeddingModel: 'text-embedding-3-small',
  autoSync: true,
  realtimeSync: true,
  debug: false,
  deleteOnRemoteDelete: false,
  lastSyncStats: { files: 0, sections: 0, cost: 0 }
};

class SearchModal extends Modal {
  plugin: AdaptaSecondBrain;
  private queryInput!: HTMLInputElement;

  constructor(app: App, plugin: AdaptaSecondBrain) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Find Similar Notes (Semantic Search)' });

    new Setting(contentEl)
      .setName('Search query')
      .setDesc('Describe the content you\'re looking for')
      .addText((text) => {
        this.queryInput = text.inputEl;
        text.setPlaceholder('e.g., project ideas or meeting notes');
      })
      .addButton((button) =>
        button
          .setIcon('search')
          .setTooltip('Search notes using OpenAI embeddings')
          .onClick(async () => {
            const query = this.queryInput.value.trim();
            if (query) {
              this.close();
              await this.plugin.findSimilar(query);
            }
          })
      );
  }

  onClose() {
    this.contentEl.empty();
  }
}

class SyncLogModal extends Modal {
  plugin: AdaptaSecondBrain;

  constructor(app: App, plugin: AdaptaSecondBrain) {
    super(app);
    this.plugin = plugin;
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Sync Log' });

    const logDiv = contentEl.createDiv('sync-log-div');
    logDiv.createEl('p', { text: 'Recent sync activity:' });
    
    try {
      if (!this.plugin.supabase.client) {
        logDiv.createEl('p', { text: 'Supabase não configurado.' });
        return;
      }
      const { data } = await this.plugin.supabase.client
        .from('obsidian_sync_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!data || data.length === 0) {
        logDiv.createEl('p', { text: 'No recent activity found.' });
      } else {
        const ul = logDiv.createEl('ul');
        data.forEach((entry: any) => {
          ul.createEl('li', { 
            text: `${entry.file_path || 'Global'}: ${entry.direction === 'local_to_remote' ? '⬆️' : '⬇️'} ${entry.trigger} - ${entry.error ? '❌ ' + entry.error : '✅ success'}` 
          });
        });
      }
    } catch (e) {
      logDiv.createEl('p', { text: `Error loading logs: ${e}`, attr: { style: 'color: red;' } });
    }

    new Setting(contentEl)
      .addButton((button) =>
        button.setButtonText('Close').onClick(() => this.close())
      );
  }

  onClose() {
    this.contentEl.empty();
  }
}

export default class AdaptaSecondBrain extends Plugin {
  settings!: PluginSettings;
  supabase!: SupabaseClientWrapper;
  embeddingService!: EmbeddingService;
  syncEngine!: SyncEngine;
  realtimeListener!: RealtimeListener;
  statusBar!: HTMLElement;
  recentlyUpdatedByRemote = new Set<string>();
  syncStatus = 'idle';

  async onload() {
    await this.loadSettings();

    // Init services
    this.supabase = new SupabaseClientWrapper(this.settings);
    this.embeddingService = new EmbeddingService(this.settings);
    this.syncEngine = new SyncEngine(this.app.vault, this.settings);
    this.realtimeListener = new RealtimeListener(this.app.vault, this.settings, this.supabase, (path) => {
      this.recentlyUpdatedByRemote.add(path);
      setTimeout(() => this.recentlyUpdatedByRemote.delete(path), 5000);
    });

    await this.initRealtime();

    // Settings
    this.addSettingTab(new AdaptaSettingsTab(this.app, this));

    if (!this.settings.supabaseUrl || !this.settings.supabaseKey) {
      new Notice('Adapta: Por favor, configure o Supabase nas opções do plugin.');
    }

    // Status bar
    this.statusBar = this.addStatusBarItem();
    this.statusBar.innerText = '🧠 Sync: idle';
    this.statusBar.classList.add('mod-clickable');
    this.statusBar.addEventListener('click', () => {
      new SyncLogModal(this.app, this).open();
    });

    // Ribbon icon
    this.addRibbonIcon('brain', 'Adapta Second Brain', () => {
      new SearchModal(this.app, this).open();
    });

    // Commands
    this.addCommand({
      id: 'suggest-links',
      name: 'Adapta: Sugerir links para esta nota',
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        if (!file) {
          new Notice('Nenhuma nota ativa');
          return;
        }
        new LinkSuggesterModal(this.app, this.supabase, this.embeddingService, file.path).open();
      }
    });

    this.addCommand({
      id: 'adapta-sync-all-notes',
      name: 'Adapta: Sync all notes',
      callback: () => {
        this.syncEngine.reindexVault();
      },
    });

    this.addCommand({
      id: 'adapta-find-similar-notes',
      name: 'Adapta: Find similar notes',
      callback: () => {
        new SearchModal(this.app, this).open();
      },
    });

    this.addCommand({
      id: 'adapta-show-sync-log',
      name: 'Adapta: Show sync log',
      callback: () => {
        new SyncLogModal(this.app, this).open();
      },
    });

    // File watchers - Aumentado para 30 segundos (conforme solicitado)
    const debouncedSync = this.debounce(this.syncFile.bind(this), 30000);

    this.registerEvent(
      this.app.vault.on('modify', (file: TAbstractFile) => {
        if (!(file instanceof TFile)) return;
        if (this.recentlyUpdatedByRemote.has(file.path)) return;
        if (this.settings.autoSync) {
          debouncedSync(file);
        }
      })
    );

    this.registerEvent(
      this.app.vault.on('create', (file: TAbstractFile) => {
        if (!(file instanceof TFile)) return;
        if (file.extension === 'md' && this.settings.autoSync) {
          this.syncFile(file);
        }
      })
    );

    this.registerEvent(
      this.app.vault.on('delete', (file: TAbstractFile) => {
        if (!(file instanceof TFile)) return;
        if (file.extension === 'md' && this.settings.autoSync) {
          this.syncEngine.deleteFile(file.path);
        }
      })
    );

    this.registerEvent(
      this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
        if (!(file instanceof TFile)) return;
        if (this.settings.autoSync) {
          this.syncEngine.queue.push({ type: 'rename', path: file.path, oldPath });
          this.syncEngine.processQueue();
        }
      })
    );

    // Queue processor

    // Queue processor
    this.registerInterval(
      window.setInterval(() => this.syncEngine.processQueue(), 30000)
    );

    this.updateStatus('ok');
  }

  async findSimilar(query: string) {
    const notice = new Notice(`Searching for: "${query}"`, 0);
    try {
      const embeddings = await this.embeddingService.embed([query]);
      if (embeddings.length === 0) throw new Error('Failed to generate embedding');

      const results = await this.supabase.searchSimilarSections(embeddings[0], '');
      notice.hide();

      if (results.length === 0) {
        new Notice('No similar notes found.');
        return;
      }

      // Display results
      class ResultsModal extends Modal {
        results: any[];
        constructor(app: App, results: any[]) {
          super(app);
          this.results = results;
        }
        onOpen() {
          const { contentEl } = this;
          contentEl.createEl('h2', { text: 'Search Results' });
          const list = contentEl.createEl('div');
          this.results.forEach(res => {
            const item = list.createEl('div', { cls: 'search-result-item', attr: { style: 'margin-bottom: 10px; padding: 5px; border-bottom: 1px solid #ccc;' } });
            item.createEl('strong', { text: res.title });
            item.createEl('p', { text: res.content.slice(0, 200) + '...' });
            item.addEventListener('click', () => {
              // Open file?
              this.close();
            });
          });
        }
      }
      new ResultsModal(this.app, results).open();
    } catch (e) {
      notice.hide();
      new Notice(`Error: ${e}`);
    }
  }

  private debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeout: any;
    return (...args) => {
      clearTimeout(timeout);
      timeout = window.setTimeout(() => func(...args), delay);
    };
  }

  private async syncFile(file: TFile) {
    this.updateStatus('syncing');
    try {
      await this.syncEngine.syncFile(file);
      this.updateStatus('ok');
    } catch (e) {
      this.updateStatus('error');
      console.error('Sync error:', e);
    }
  }

  private updateStatus(status: string) {
    this.syncStatus = status;
    const texts = {
      idle: '🧠 Sync: idle',
      syncing: '🧠 Sync: indexando...',
      ok: '🧠 Sync: ✅ ok',
      error: '🧠 Sync: ❌ erro'
    };
    this.statusBar.innerText = (texts[status as keyof typeof texts] || texts.idle);
  }

  async saveSettings() {
    await this.saveData(this.settings);
    // Refresh services
    this.supabase = new SupabaseClientWrapper(this.settings);
    this.embeddingService = new EmbeddingService(this.settings);
    this.syncEngine = new SyncEngine(this.app.vault, this.settings);
    
    // Stop old listener and start new one with fresh settings/client
    if (this.realtimeListener) {
      this.realtimeListener.stop();
      this.realtimeListener = new RealtimeListener(this.app.vault, this.settings, this.supabase, (path) => {
        this.recentlyUpdatedByRemote.add(path);
        setTimeout(() => this.recentlyUpdatedByRemote.delete(path), 5000);
      });
      await this.initRealtime();
    }
  }

  async initRealtime() {
    if (this.settings.realtimeSync) {
      console.log('[Adapta] Starting Realtime...');
      this.realtimeListener.start();
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  onunload() {
    this.realtimeListener?.stop();
  }
}

