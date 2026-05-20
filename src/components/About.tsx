import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const About: React.FC = () => {
  const { user } = useAuth();
  const SINGLE_TENANT = String((import.meta as any).env?.VITE_SINGLE_TENANT ?? 'true') === 'true';
  const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || '-';
  const buildInfo = {
    version: '1.0.0',
    mode: SINGLE_TENANT ? 'Single-tenant (uso particular)' : 'Multi-tenant',
    technologies: 'React, TypeScript, Supabase, Tailwind CSS',
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <Info className="h-5 w-5" /> Sobre o Sistema
          </CardTitle>
          <CardDescription>Informações precisas e atualizadas do aplicativo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Versão</div>
              <div className="font-medium">{buildInfo.version}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Modo</div>
              <div>
                <Badge>{buildInfo.mode}</Badge>
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="text-sm text-muted-foreground">Tecnologias</div>
              <div className="font-medium">{buildInfo.technologies}</div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Usuário atual</div>
              <div className="font-medium">{user?.email ?? '-'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Supabase URL (env)</div>
              <div className="font-mono break-all">{SUPABASE_URL}</div>
            </div>
          </div>

          <Alert>
            <AlertDescription>
              Operando em modo single-tenant: permissões e papéis são gerenciados localmente para o usuário master.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};

export default About;
