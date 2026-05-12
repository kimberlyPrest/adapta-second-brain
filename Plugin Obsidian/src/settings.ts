import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type AdaptaSecondBrain from './main';
import { PluginSettings } from './types';

export class AdaptaSettingsTab extends PluginSettingTab {
  plugin: AdaptaSecondBrain;

  constructor(app: App, plugin: AdaptaSecondBrain) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Configurações Adapta Second Brain' });

    new Setting(containerEl)
      .setName('URL do Supabase')
      .setDesc('URL do seu projeto Supabase')
      .addText(text => text
        .setPlaceholder('https://xyz.supabase.co')
        .setValue(this.plugin.settings.supabaseUrl)
        .onChange(async (value) => {
          this.plugin.settings.supabaseUrl = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Chave service_role Supabase')
      .setDesc('Chave de serviço (não anon). Mantenha segura!')
      .addText(text => {
        text.inputEl.type = 'password';
        text
          .setPlaceholder('eyJ...')
          .setValue(this.plugin.settings.supabaseKey)
          .onChange(async (value: string) => {
            this.plugin.settings.supabaseKey = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('Chave API OpenAI')
      .setDesc('Sua chave da OpenAI')
      .addText(text => {
        text.inputEl.type = 'password';
        text
          .setPlaceholder('sk-...')
          .setValue(this.plugin.settings.openaiApiKey)
          .onChange(async (value: string) => {
            this.plugin.settings.openaiApiKey = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('Modelo de embedding')
      .addDropdown(dropdown =>
        dropdown
          .addOption('text-embedding-3-small', 'text-embedding-3-small (barato)')
          .addOption('text-embedding-3-large', 'text-embedding-3-large (melhor)')
          .setValue(this.plugin.settings.embeddingModel)
          .onChange(async (value: any) => {
            this.plugin.settings.embeddingModel = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Sync automático ao salvar')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoSync)
        .onChange(async (value) => {
          this.plugin.settings.autoSync = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Sync realtime ativado')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.realtimeSync)
        .onChange(async (value) => {
          this.plugin.settings.realtimeSync = value;
          if (value) {
            this.plugin.realtimeListener?.start();
          } else {
            this.plugin.realtimeListener?.stop();
          }
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Deletar local ao deletar remoto')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.deleteOnRemoteDelete)
        .onChange(async (value) => {
          this.plugin.settings.deleteOnRemoteDelete = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Modo debug')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.debug)
        .onChange(async (value) => {
          this.plugin.settings.debug = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Testar conexão')
      .addButton(button => button
        .setButtonText('Testar Supabase e OpenAI')
        .onClick(async () => {
          try {
            const sbOk = await this.plugin.supabase.testConnection(this.plugin.settings.supabaseUrl, this.plugin.settings.supabaseKey);
            // Test OpenAI
            const emb = await this.plugin.embeddingService.embedBatch(['teste']);
            new Notice(sbOk && emb.embeddings.length > 0 ? '✅ Conexões OK!' : '❌ Falha no teste');
          } catch (e) {
            new Notice(`❌ Erro: ${e}`);
          }
        }));

    new Setting(containerEl)
      .setName('Últimas estatísticas de sync')
      .addText(text => text
        .setDisabled(true)
        .setValue(JSON.stringify(this.plugin.settings.lastSyncStats)));
  }
}
