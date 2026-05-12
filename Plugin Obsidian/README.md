# Adapta Second Brain - Obsidian Plugin

O **Adapta Second Brain** é um plugin para Obsidian que integra seu "Segundo Cérebro" no **Obsidian** diretamente com o **Supabase**. Ele permite sincronização em tempo real, busca semântica (vetorial) e sugestão de links inteligentes, transformando seu vault em uma base de conhecimento dinâmica e conectada.

## 🚀 Funcionalidades

- **Sincronização Bidirecional Realtime**: Edite no Obsidian e veja no banco de dados (e vice-versa) instantaneamente via WebSockets.
- **Busca Híbrida e Semântica**: Encontre notas não apenas por palavras-chave, mas pelo *significado* do conteúdo.
- **Sugestão de Links Inteligentes**: O plugin sugere notas relacionadas para vincular à sua nota ativa com base no contexto.
- **Log de Sincronização**: Acompanhe o status de cada nota enviada ou recebida na tabela `obsidian_sync_log`.
- **Proteção Anti-Loop**: Sistema inteligente que evita loops infinitos de sincronização entre local e remoto.
- **Debounce de Escrita**: Sincroniza apenas após 30 segundos de inatividade, garantindo fluidez enquanto você escreve.

## ✨ Wishlist

1. **NL -> SQL** - Consultar o segundo cérebro em linguagem natural com tradução automática para SQL.
2. **Painel Cliente 360 (Sidebar)** - Ao entrar na nota do cliente abrirá um Sidebar contextual no Obsidian que mostra status WhatsApp (última interação, pendências de resposta), resumo IA, "to do" com pendência de entrega, links úteis, deals e notas relacionadas ao abrir uma nota de cliente.
3. **Auto-sugestão de wikilinks** - Plugin sugere [[links]] automáticos via similaridade semântica quando você cria/edita uma nota.
4. (Uma feature de cada vez!) 

Se você tiver alguma ideia, me avise!


## 🛠️ Instalação

Para usar este plugin, você precisará de uma instância do Supabase configurada com o schema adequado.

### Pré-requisitos
1. **Supabase URL & Key**: Um projeto Supabase. Obtenha suas credenciais no painel do Supabase.
   1. **URL do projeto**: EX: `https://[id_projeto].supabase.co`
   2. **Chave service_role**: Vá em **Project Settings > API** e pegue a credencial `service_role`. 
      > [!CAUTION]
      > **ALERTA DE SEGURANÇA**: Esta chave ignora as políticas de segurança (RLS). Nunca a compartilhe, nunca a envie para o GitHub e use-a apenas localmente no Obsidian.
2. **OpenAI Key**: Uma chave de API para gerar os embeddings - ([OpenAI API keys](https://platform.openai.com/account/api-keys)).
   - **Modelos compatíveis (1536 dimensões)**: `text-embedding-3-small` (recomendado) ou `text-embedding-ada-002`.
3. **Vault**: No Obsidian, tenha um vault (COFRE) criado, recomendo que seja na pasta de documentos.

---

### 📦 Passo 1: Configure o Banco de Dados (Supabase)

Você precisa criar 3 tabelas (`obsidian_notes`, `obsidian_note_sections`, `obsidian_sync_log`) e habilitar extensões como o `pgvector`. Para isso você pode escolher uma das opções abaixo:

#### A. Manualmente (Mais fácil e rápido)
1. No painel do Supabase, vá em **Database > Extensions** e certifique-se de que a extensão **vector** está ativa.
2. Acesse o **SQL Editor**.
3. Copie o conteúdo do arquivo de migração: `supabase/migrations/20260512000001_init_obsidian_plugin.sql`.
4. Execute a query e verifique no **Table Editor** se as tabelas foram criadas.
5. **Realtime**: Vá em **Database > Replication > supabase_realtime** e confirme se as tabelas `obsidian_notes` e `obsidian_note_sections` estão com o switch **ON**.

#### B. Via CLI do Supabase
1. Instale a CLI do Supabase ([Instruções](https://supabase.com/docs/guides/cli)).
2. Faça login
   ```bash
   supabase login
   ```
3. Vincule seu projeto
   ```bash
   supabase link --project-ref <id-do-projeto>
   # You can get <project-id> from your project's dashboard URL: https://supabase.com/dashboard/project/<project-id>   
   ```
4. Envie as tabelas
   ```bash
   supabase db push
   ```

---

### 📦 Passo 2: Instale o Plugin no Obsidian

Agora, vamos colocar o plugin dentro da sua pasta do Obsidian.

#### A. Via Terminal (Recomendado)
1. Navegue até a pasta de plugins do seu vault:
   ```bash
   cd path/to/your/vault/.obsidian/plugins/
   ```
2. Clone o repositório:
   ```bash
   git clone https://github.com/kimberlyPrest/adapta-second-brain.git
   cd adapta-second-brain
   ```
3. Instale e compile:
   ```bash
   npm install && npm run build
   ```

#### B. Manualmente (Via Downgit)
1. Use o [Downgit](https://downgit.github.io/) para baixar a pasta com esse link: https://github.com/kimberlyPrest/adapta-second-brain/tree/main/Plugin%20Obsidian
2. Extraia o arquivo `.zip` baixado.
3. No seu computador, navegue até a pasta do seu Vault do Obsidian.
4. Entre na pasta oculta `.obsidian` e entre na pasta `plugins`.
   > [!NOTE]
   > No Mac, use `Cmd + Shift + .` para ver pastas ocultas.
   > No Windows, você pode precisar ir na aba "Exibir" e marcar "Itens ocultos"
   > Se a pasta `plugins` não existir, crie-a.
5. Mova a pasta baixada para dentro de `plugins` e renomeie para `adapta-second-brain` ou o nome que preferir.

---

### 📦 Passo 3: Configure o Plugin no Obsidian

1. No Obsidian, vá em **Configurações** → **Plugins Não Oficiais** e na seção 'Plugin Instalados' ative o plugin **Adapta Second Brain**.
2. Abra as configurações do plugin e preencha:
   - **Supabase URL**: Sua URL do projeto.
   - **Supabase Service Role Key**: Sua chave secreta (service_role).
   - **OpenAI API Key**: Sua chave para gerar buscas inteligentes.
3. Verifique se o status no final da página indica `✨ [Adapta] Ready`.

**Configurações Recomendadas:**
- **Auto Sync**: ATIVE (Sincroniza após 30s de pausa na escrita).
- **Realtime Sync**: ATIVE (Recebe mudanças do banco na hora).
- **Debug Mode**: Deixe desativado (usado apenas para desenvolvimento).

---

## 🚀 Uso

- **Ícone de Cérebro (Sidebar Left)**: Clique para abrir o buscador semântico.
- **Barra de Status (Canto Inferior)**: Mostra o status da sincronização em tempo real.
- **Comandos (`Cmd/Ctrl + P`)**:
    - `Adapta Second Brain: Semantic Search`: Busca inteligente por significado.
    - `Adapta Second Brain: Sync Active Note`: Força a sincronização da nota aberta.
    - `Adapta Second Brain: Refresh Index`: Recalcula todos os índices (útil na primeira vez).

## 📄 Licença

MIT License.
