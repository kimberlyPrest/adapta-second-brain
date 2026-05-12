# Adapta Second Brain - Obsidian Plugin

O **Adapta Second Brain** é um plugin para Obsidian que integra seu "Segundo Cérebro" diretamente com o **Supabase**. Ele permite sincronização em tempo real, busca semântica (vetorial) e sugestão de links inteligentes, transformando seu vault em uma base de conhecimento dinâmica e conectada.

## 🚀 Funcionalidades

- **Sincronização Bidirecional Realtime**: Edite no Obsidian e veja no banco de dados (e vice-versa) instantaneamente via WebSockets.
- **Busca Híbrida e Semântica**: Encontre notas não apenas por palavras-chave, mas pelo *significado* do conteúdo.
- **Sugestão de Links Inteligentes**: O plugin sugere notas relacionadas para vincular à sua nota ativa com base no contexto.
- **Log de Sincronização**: Acompanhe o status de cada nota enviada ou recebida.
- **Proteção Anti-Loop**: Sistema inteligente que evita loops infinitos de sincronização entre local e remoto.
- **Debounce de Escrita**: Sincroniza apenas após 30 segundos de inatividade, garantindo fluidez enquanto você escreve.

## 🛠️ Configuração

Para usar este plugin, você precisará de uma instância do Supabase configurada com o schema adequado.

1. **Supabase URL & Key**: Obtenha suas credenciais no painel do Supabase (Project Settings > API).
2. **Schema do Banco**: Certifique-se de que a tabela `obsidian_notes` e `obsidian_sections` existam (com suporte a vetores `pgvector`).
3. **Realtime**: Habilite o "Postgres Changes" para a tabela `obsidian_notes` na publicação `supabase_realtime`.

## 📦 Instalação (Desenvolvimento)

1. Clone este repositório na sua pasta de plugins do Obsidian:
   ```bash
   cd path/to/your/vault/.obsidian/plugins/
   git clone <url-do-repositorio> adapta-second-brain
   ```
2. Instale as dependências:
   ```bash
   cd adapta-second-brain
   npm install
   ```
3. Compile o plugin:
   ```bash
   npm run build
   ```
4. Ative o plugin nas configurações do Obsidian.

## ⚙️ Configurações do Plugin

- **Auto Sync**: Ativa/desativa a sincronização automática ao modificar notas.
- **Realtime Sync**: Ativa o recebimento de atualizações do Supabase em tempo real.
- **Debug Mode**: Ativa logs detalhados no console (Ctrl+Shift+I).

## 📄 Licença

MIT License.
