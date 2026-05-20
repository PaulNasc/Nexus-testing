import React from 'react';
import { Badge } from '@/components/ui/badge';
import KrigzisLogo from '@/components/branding/KrigzisLogo';
import { ExternalLink, GitBranch, Server, Cpu, Calendar, Shield, Sparkles, FileText, Play, BarChart3, Users, Bug, CheckCircle } from 'lucide-react';

const SINGLE_TENANT = String((import.meta as any).env?.VITE_SINGLE_TENANT ?? 'true') === 'true';

const APP_VERSION = '1.0.0';

const CHANGELOG: Array<{ version: string; date: string; changes: string[] }> = [
  {
    version: '1.0.0',
    date: '2026-05-13',
    changes: [
      'Gestão completa de planos, casos e execuções de teste',
      'Sistema de permissões granular por papel',
      'Integração com IA (Google Gemini) para geração de testes',
      'Dashboard com métricas de qualidade',
      'Ciclos de execução (Test Runs) com progresso',
      'Gestão de requisitos e rastreabilidade',
      'Gestão de defeitos vinculados a execuções',
      'Notificações em tempo real',
      'Tema escuro com personalização de cores por projeto',
    ],
  },
];

const TECH_STACK = [
  { name: 'React 18', desc: 'UI Framework' },
  { name: 'TypeScript', desc: 'Tipagem' },
  { name: 'Vite 6', desc: 'Build Tool' },
  { name: 'Tailwind CSS', desc: 'Estilos' },
  { name: 'SQLite', desc: 'Banco Local' },
  { name: 'Express', desc: 'API Server' },
  { name: 'Node 22', desc: 'Runtime' },
];

const FEATURES = [
  { icon: FileText, label: 'Planos de Teste' },
  { icon: CheckCircle, label: 'Casos de Teste' },
  { icon: Play, label: 'Execuções' },
  { icon: Bug, label: 'Defeitos' },
  { icon: BarChart3, label: 'Relatórios' },
  { icon: Users, label: 'Gestão de Usuários' },
  { icon: Sparkles, label: 'Geração com IA' },
  { icon: Shield, label: 'Permissões Granulares' },
];

export const About = () => {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <KrigzisLogo size={36} className="h-9 w-9 shrink-0" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nexus Testing</h1>
          <p className="text-sm text-muted-foreground">Sistema de Gerenciamento de Testes de Software</p>
        </div>
        <Badge variant="outline" className="ml-auto text-xs font-mono">
          v{APP_VERSION}
        </Badge>
      </div>

      {/* Info bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <InfoCard icon={GitBranch} label="Versão" value={`v${APP_VERSION}`} />
        <InfoCard icon={Calendar} label="Build" value={new Date().toLocaleDateString('pt-BR')} />
        <InfoCard icon={Server} label="Modo" value={SINGLE_TENANT ? 'Single-tenant' : 'Multi-tenant'} />
        <InfoCard icon={Cpu} label="Runtime" value={`Node ${22}`} />
      </div>

      {/* Features grid */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recursos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {FEATURES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/40 px-3 py-2.5">
              <Icon className="h-4 w-4 text-brand shrink-0" />
              <span className="text-xs font-medium truncate">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Tech stack */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Stack Tecnológico</h2>
        <div className="flex flex-wrap gap-2">
          {TECH_STACK.map(({ name, desc }) => (
            <span key={name} className="inline-flex items-center gap-1.5 text-xs border border-border/50 rounded-md px-2.5 py-1.5 bg-muted/30">
              <span className="font-medium">{name}</span>
              <span className="text-muted-foreground">· {desc}</span>
            </span>
          ))}
        </div>
      </section>

      {/* Changelog */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Histórico de Versões</h2>
        <div className="space-y-4">
          {CHANGELOG.map((entry) => (
            <div key={entry.version} className="border border-border/50 rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30 border-b border-border/50">
                <Badge variant="outline" className="text-xs font-mono">v{entry.version}</Badge>
                <span className="text-xs text-muted-foreground">{new Date(entry.date).toLocaleDateString('pt-BR')}</span>
                {entry.version === APP_VERSION && (
                  <Badge className="ml-auto text-[10px] bg-brand/10 text-brand border-brand/20">atual</Badge>
                )}
              </div>
              <ul className="px-4 py-3 space-y-1.5">
                {entry.changes.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="text-brand mt-0.5 shrink-0">•</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-border/40">
        <p className="text-[11px] text-muted-foreground/60">
          © {new Date().getFullYear()} Nexus Testing
        </p>
        <a
          href="https://github.com/PaulNasc/Nexus-testing"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-brand transition-colors"
        >
          GitHub <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
};

function InfoCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/40 px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default About;
