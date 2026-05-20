---
description: README
---
# Workflows do .agent

Esta pasta e a **fonte de verdade** dos workflows do projeto. Cada `.md` aqui vira
um slash command no Windsurf apos rodar a sincronizacao.

## Como funciona

1. Voce cria/edita um arquivo aqui: `.agent/workflows/<nome>.md`
2. Roda o sync: `npm run sync:workflows`
3. O arquivo e copiado para `.windsurf/workflows/<nome>.md` (gerado, nao editar la)
4. O Windsurf passa a reconhecer `/<nome>` como slash command

## Formato esperado

Frontmatter YAML opcional (o sync adiciona se faltar):

```markdown
---
description: Texto curto que descreve quando usar este workflow
---

# Titulo

Passos detalhados que o agente deve seguir...
```

## Comandos

```powershell
# Sync unico
npm run sync:workflows

# Preview (sem aplicar)
pwsh -File .agent/scripts/sync-workflows.ps1 -DryRun

# Modo watch (re-sincroniza ao salvar)
pwsh -File .agent/scripts/sync-workflows.ps1 -Watch
```

## Regras

- **Nao edite** `.windsurf/workflows/*.md` â€” sao gerados automaticamente.
- Arquivos em `.windsurf/workflows/` sem o marcador `<!-- generated from .agent/workflows -->`
  sao preservados (workflows manuais legados).
- Apagar um arquivo aqui remove o slash command no proximo sync.
