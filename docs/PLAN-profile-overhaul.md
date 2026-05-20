# Plano de Implementação: Reformulação de Perfis e Sincronização de Configurações

## 📝 Visão Geral
Este plano descreve a reformulação completa dos perfis de usuário (visualização e edição), a migração de configurações de preferências para o painel geral e a padronização visual seguindo diretrizes prêmios e minimalistas.

## 🛠️ Objetivos
1. **Minimalismo e Dinamismo**: Redesenhar o `UserProfileModal` (visualização) para ser ultra-minimalista.
2. **Padronização de Tags**: Alinhar tags de "Master" (permissão) e "Grupo/Cargo" lado a lado com estilização idêntica.
3. **Migração de Configurações**: Mover Preferências (notificações) e Histórico de `ProfileModal` para `SettingsModal`.
4. **Metadados de Perfil**: Adicionar suporte a Bio e Skills (metadados informativos).
5. **Debug de Funcionalidades**: Validar a implementação real de notificações e histórico.

---

## 📅 Fases de Implementação

### Fase 1: Análise e Debugging (@debugger)
- [ ] Analisar `ProfileModal.tsx` e validar se a lógica de `notification_preferences` e `activity_logs` está persistindo corretamente no banco de dados.
- [ ] Verificar se o componente de Notificações no `Header.tsx` respeita as preferências do usuário.
- [ ] Identificar a localização exata das rotas de configurações mencionadas pelo usuário.

### Fase 2: Reestruturação do SettingsModal (@frontend-specialist, @backend-specialist)
- [ ] Adicionar seção de "Preferências de Notificação" no `SettingsModal.tsx`.
- [ ] Adicionar aba ou seção de "Histórico de Conta" no `SettingsModal.tsx`.
- [ ] Implementar hooks/serviços para salvar/carregar essas preferências diretamente no painel de configurações.

### Fase 3: Overhaul do UserProfileModal (Visualização) (@frontend-specialist)
- [ ] Redesenhar layout: Focar em tipografia premium, espaços generosos e minimalismo.
- [ ] Tags: Posicionar "Permissão" e "Cargo" lado a lado.
- [ ] Tags: Aplicar formato `( LABEL )` e estilização de grupo em ambas.
- [ ] Links Sociais: Manter lógica condicional (exibir ícone apenas se o link existir).
- [ ] Metadados: Adicionar campos de Bio e Skills na visualização (extraídos da coluna `tags` ou nova coluna de metadados).

### Fase 4: Atualização do ProfileModal (Edição) (@frontend-specialist)
- [ ] Remover abas (History/Preferences) migradas.
- [ ] Simplificar formulário de edição para focar em dados pessoais e links.
- [ ] Adicionar campos de Bio e Skills.

### Fase 5: Segurança e Validação (@security-auditor)
- [ ] Validar sanitização de inputs nos novos campos de metadados.
- [ ] Garantir que a edição de tags Master/Cargo permaneça restrita ao painel administrativo.

### Fase 6: Testes Automatizados (@test-engineer)
- [ ] Criar testes E2E para o novo fluxo de configurações.
- [ ] Validar renderização visual do novo `UserProfileModal`.

---

## 📋 Checklist de Verificação
- [ ] Tags Master e Cargo estão idênticas e lado a lado?
- [ ] Notificações podem ser configuradas no painel de Configurações?
- [ ] O modal de visualização é minimalista e prêmio?
- [ ] Nenhum link social quebrado ou ícone fantasma?

---

## 🤖 Atribuição de Agentes
- **project-planner**: Orquestração e acompanhamento.
- **frontend-specialist**: Implementação UI/UX e componentes.
- **backend-specialist**: Migração de lógica e persistência.
- **debugger**: Validação técnica das preferências.
- **test-engineer**: Garantia de qualidade via Playwright.
