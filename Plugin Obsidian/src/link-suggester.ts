import { App, Modal, Notice } from 'obsidian';
import { SupabaseClientWrapper } from './supabase-client';
import { EmbeddingService } from './embedding-service';
import { SimilarSection } from './types';

export class LinkSuggesterModal extends Modal {
  private supabase: SupabaseClientWrapper;
  private embeddings: EmbeddingService;
  private currentFilePath: string;
  similarSections: SimilarSection[] = [];
  selected: Set<string> = new Set();

  constructor(app: App, supabase: SupabaseClientWrapper, embeddings: EmbeddingService, currentFilePath: string) {
    super(app);
    this.supabase = supabase;
    this.embeddings = embeddings;
    this.currentFilePath = currentFilePath;
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.addClass('modal');

    contentEl.createEl('h2', { text: 'Sugerir links para esta nota' });
    contentEl.createEl('p', { text: 'Carregando sugestões semânticas...' });

    await this.loadSimilar();
    
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Sugerir links para esta nota' });

    const listEl = contentEl.createEl('div');
    if (this.similarSections.length === 0) {
      listEl.createEl('p', { text: 'Nenhuma sugestão encontrada.' });
    }

    this.similarSections.slice(0, 10).forEach((sec) => {
      const div = listEl.createEl('div', { cls: 'similar-section' });
      const cb = div.createEl('input', { attr: { type: 'checkbox' } });
      cb.onchange = () => {
        if (cb.checked) {
          this.selected.add(sec.filePath);
        } else {
          this.selected.delete(sec.filePath);
        }
      };
      div.createEl('span', { text: `${sec.title} - ${sec.heading || 'Sem título'} (similaridade: ${(sec.score * 100).toFixed(1)}%)` });
    });

    const btnDiv = contentEl.createEl('div', { attr: { style: 'text-align: right; margin-top: 20px;' } });
    const insertBtn = btnDiv.createEl('button', { text: 'Inserir links selecionados', cls: 'mod-cta' });
    insertBtn.onclick = () => this.insertLinks();

    const cancelBtn = btnDiv.createEl('button', { text: 'Cancelar' });
    cancelBtn.onclick = () => this.close();
  }

  private async loadSimilar() {
    try {
      // Get current note
      const currentNote = await this.supabase.getNoteByPath(this.currentFilePath);
      if (!currentNote) return;

      const sections = await this.supabase.getNoteSections(currentNote.id);
      if (!sections.length) return;

      // Embed top 3 sections
      const contents = sections.slice(0, 3).map(s => s.content);
      const { embeddings } = await this.embeddings.embedBatch(contents);

      // Search for each
      const allSimilar: any[] = [];
      for (const emb of embeddings) {
        const sim = await this.supabase.searchSimilarSections(emb, currentNote.id, 5);
        allSimilar.push(...sim);
      }

      // Dedup and sort
      const noteScores = new Map<string, number>();
      const sectionData = new Map<string, any>();

      allSimilar.forEach(s => {
        const score = s.similarity || 0;
        const existingScore = noteScores.get(s.note_id) || 0;
        if (score > existingScore) {
          noteScores.set(s.note_id, score);
          sectionData.set(s.note_id, s);
        }
      });

      this.similarSections = Array.from(noteScores.entries())
        .map(([noteId, score]) => {
          const s = sectionData.get(noteId);
          return {
            id: s.id,
            noteId: noteId,
            filePath: s.file_path,
            title: s.title,
            sectionOrder: s.section_order,
            heading: s.heading,
            score: score
          };
        })
        .sort((a, b) => b.score - a.score);
    } catch (e) {
      new Notice(`Erro ao carregar similares: ${e}`);
    }
  }

  private async insertLinks() {
    if (this.selected.size === 0) {
      new Notice('Nenhum link selecionado');
      return;
    }

    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) return;

    let content = await this.app.vault.read(activeFile);

    const links = Array.from(this.selected).map(p => `- [[${p.split('/').pop()!.replace('.md', '')}]]`).join('\n');
    
    // Check if section exists
    const relatedHeader = '## Notas relacionadas';
    if (content.includes(relatedHeader)) {
      content = content.replace(new RegExp(`${relatedHeader}\\n[\\s\\S]*?(?=\\n## |$)`, 'i'), `${relatedHeader}\n${links}`);
    } else {
      content += `\n\n${relatedHeader}\n${links}`;
    }

    await this.app.vault.modify(activeFile, content);
    new Notice(`${this.selected.size} links inseridos`);
    this.close();
  }

  onClose() {
    this.contentEl.empty();
  }
}
