# 📋 Plano de Implementação: Fluxo Unificado de Criação (T03)

## 1. Visão Geral
Atualmente, a criação de planos e casos de teste é feita de forma fragmentada. O objetivo desta fase é unificar essa jornada em um fluxo atômico e intuitivo, permitindo que o usuário defina o contexto do plano e já gere ou adicione casos de teste em uma única operação.

## 2. Requisitos de Negócio
- **Atomicidade**: Plano e casos devem ser salvos juntos.
- **Eficiência**: Integração nativa com IA para sugerir casos com base no plano.
- **UX Premium**: Interface limpa, sem distrações e com feedback visual de progresso.

## 3. Design da Interface (UI/UX)
- **Componente Principal**: `src/components/UnifiedTestCreation.tsx`.
- **Estrutura**: Modal multi-etapas (Stepper):
    1. **Passo 1: Definição do Plano**: Nome, Projeto, Objetivo.
    2. **Passo 2: Construção dos Casos**: 
        - Interface de "Draft" (Rascunho).
        - Botão "Gerar com IA" que popula a lista de rascunhos.
        - Edição rápida inline dos casos sugeridos.
    3. **Passo 3: Revisão**: Verificação final antes de persistir.
- **Visual**: Uso de animações suaves entre passos e tons de Slate/Cyan (Nexus branding).

## 4. Arquitetura Técnica

### Frontend
- **State Management**: `useReducer` para gerenciar o estado do rascunho.
- **Services**: Criação de `saveUnifiedPlan(data)` em `supabaseService.ts` que envia o payload completo para o novo endpoint.
- **IA**: Refatoração do `AIGeneratorForm` para suportar o modo "Callback" (retornar dados em vez de salvar).

### Backend (API)
- **Novo Endpoint**: `POST /api/mutate/unified`
- **Lógica de Transação**:
  ```javascript
  db.transaction(() => {
    const plan = insertPlan(data.plan);
    for (const testCase of data.cases) {
      insertCase({ ...testCase, plan_id: plan.id });
    }
  })();
  ```
- **Segurança**: Validação de RBAC (User/Admin) e verificação de `project_id`.

## 5. Plano de Testes
- **Playwright**: `tests/unified_flow.spec.ts`.
- **Cenário Principal**: 
  - Login -> Abrir Fluxo Unificado.
  - Preencher dados do Plano.
  - Clicar em "Gerar com IA" -> Verificar se os cards de casos aparecem.
  - Ajustar um caso manualmente.
  - Clicar em "Finalizar".
  - Verificar se o Plano e os Casos aparecem nas listas e no Dashboard.

---

## 6. Próximos Passos (Após Aprovação)
1. Criar o endpoint de transação no backend.
2. Desenvolver o componente de UI multi-etapas.
3. Integrar com o motor de IA.
4. Validar com testes E2E.
