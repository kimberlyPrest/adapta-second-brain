# Adapta Second Brain - Obsidian Plugin

O **Adapta Second Brain** é um plugin para Obsidian que integra seu "Segundo Cérebro" no **Obsidian** diretamente com o **Supabase**. Ele permite sincronização em tempo real, busca semântica (vetorial) e sugestão de links inteligentes, transformando seu vault em uma base de conhecimento dinâmica e conectada.

## 🚀 Funcionalidades

- **Sincronização Bidirecional Realtime**: Edite no Obsidian e veja no banco de dados (e vice-versa) instantaneamente via WebSockets.
- **Busca Híbrida e Semântica**: Encontre notas não apenas por palavras-chave, mas pelo *significado* do conteúdo.
- **Sugestão de Links Inteligentes**: O plugin sugere notas relacionadas para vincular à sua nota ativa com base no contexto.
- **Log de Sincronização**: Acompanhe o status de cada nota enviada ou recebida.
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
   1. **URL do projeto**: EX: https://[id_projeto].supabase.co
   2. **Chave service_role Supabase**: Chave de serviço (não anônima). Vá em Project Settings > API > Legacy anon, service_role API keys e pegue a credencial 'service_role'.
2. **OpenAI Key**: Uma chave de API da OpenAI ([OpenAI API keys](https://platform.openai.com/account/api-keys)).
3. **Vault**: No Obsidian, tenha um vault (COFRE) criado, recomendo que seja na pasta de documentos.
4. **Realtime**: No Supabase, habilite o "Postgres Changes" para a tabela `obsidian_notes` na publicação `supabase_realtime`.

---

### 📦 Passo 1: Configure o Banco de Dados (Supabase)

Você precisa criar as tabelas necessárias no seu projeto Supabase. Escolha uma das opções:

#### A. Manualmente (Mais fácil e rápido)
1. No painel do Supabase, acesse o **SQL Editor**.
2. Crie uma nova query.
3. Copie o conteúdo do arquivo de migração (disponível na pasta `supabase/migrations` deste repositório).
4. Execute a query e verifique se as tabelas `obsidian_notes` e `obsidian_sections` aparecem no **Table Editor**.

#### B. Via CLI do Supabase
1. Instale a CLI do Supabase ([Instruções](https://supabase.com/docs/guides/cli)).
2. Faça login
   ```bash
   supabase login
   ```
3. Vincule seu projeto
   ```bash
   supabase link --project-ref <id-do-projeto>
   # Você pode pegar o <id-do-projeto> no dashboard do seu projeto: https://supabase.com/dashboard/project/<id-do-projeto>   
   ```
4. Envie as tabelas
   ```bash
   supabase db push
   ```

---

### 📦 Passo 2: Instale o Plugin no Obsidian

Agora, vamos colocar o plugin dentro da sua pasta do Obsidian.

#### A. Via Terminal (Recomendado)
1. Abra o terminal e navegue até a pasta de plugins do seu vault:
   ```bash
   cd path/to/your/vault/.obsidian/plugins/
   ```
2. Clone o repositório:
   ```bash
   git clone https://github.com/kimberlyPrest/adapta-second-brain.git
   cd adapta-second-brain
   ```
3. Instale as dependências e compile o plugin:
   ```bash
   npm install
   npm run build
   ```

#### B. Manualmente (Via Downgit)
1. Use o [Downgit](https://downgit.github.io/) para baixar apenas a pasta do plugin e use o link - https://github.com/kimberlyPrest/adapta-second-brain/tree/main/Plugin%20Obsidian
2. Extraia o arquivo `.zip` baixado.
3. No seu computador, navegue até a pasta do seu Vault do Obsidian.
4. Entre na pasta oculta `.obsidian` e depois na pasta `plugins`.
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
