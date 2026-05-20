import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DatabaseSetupService, DatabaseSetupRequest } from '@/services/databaseSetupService';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Database, Settings, CheckCircle, AlertCircle, Info, Loader2, Download } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export const DatabaseSetup = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState<DatabaseSetupRequest>({
    supabaseUrl: '',
    supabaseKey: '',
    aiApiKey: ''
  });

  useEffect(() => {
    if (user) {
      checkDatabaseSetup();
    }
  }, [user]);

  const checkDatabaseSetup = async () => {
    if (!user) return;

    try {
      const needsSetupResult = await DatabaseSetupService.needsDatabaseSetup(user.id);
      setNeedsSetup(needsSetupResult);

      if (!needsSetupResult) {
        const config = await DatabaseSetupService.getUserDatabaseConfig(user.id);
        setCurrentConfig(config);
      }
    } catch (error) {
      console.error('Error checking database setup:', error);
    }
  };

  const handleInputChange = (field: keyof DatabaseSetupRequest, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: 'Erro',
        description: 'Usuário não autenticado',
        variant: 'destructive'
      });
      return;
    }

    if (!formData.supabaseUrl || !formData.supabaseKey) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha a URL e a chave do Supabase',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      const result = await DatabaseSetupService.setupUserDatabase(user.id, formData);

      if (result.success) {
        toast({
          title: 'Sucesso!',
          description: result.message || 'Estrutura de base validada com sucesso!',
        });

        await checkDatabaseSetup();
        
        setFormData({
          supabaseUrl: '',
          supabaseKey: '',
          aiApiKey: ''
        });
      } else {
        toast({
          title: 'Erro',
          description: result.error || 'Erro ao configurar base de dados',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error setting up database:', error);
      toast({
        title: 'Erro',
        description: 'Erro inesperado ao configurar base de dados',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveConfig = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const success = await DatabaseSetupService.removeDatabaseConfig(user.id);
      
      if (success) {
        toast({
          title: 'Configuração removida',
          description: 'A configuração da base de dados foi removida',
        });
        await checkDatabaseSetup();
      } else {
        toast({
          title: 'Erro',
          description: 'Erro ao remover configuração',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error removing config:', error);
      toast({
        title: 'Erro',
        description: 'Erro inesperado ao remover configuração',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadSQLFile = () => {
    const sqlContent = `-- Krigzis-TCMS - Database Setup Script (versão simplificada, sem Organizações/To-Do)
-- Execute este script no Supabase SQL Editor

-- 1. Criar enum de roles
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('master', 'admin', 'manager', 'tester', 'viewer');
    END IF;
END $$;

-- 2. Tabela de perfis
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    email TEXT,
    role user_role DEFAULT 'viewer',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de permissões (escopo global por usuário)
CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    can_manage_users BOOLEAN DEFAULT FALSE,
    can_manage_plans BOOLEAN DEFAULT FALSE,
    can_manage_cases BOOLEAN DEFAULT FALSE,
    can_manage_executions BOOLEAN DEFAULT FALSE,
    can_view_reports BOOLEAN DEFAULT FALSE,
    can_use_ai BOOLEAN DEFAULT FALSE,
    can_access_model_control BOOLEAN DEFAULT FALSE,
    can_configure_ai_models BOOLEAN DEFAULT FALSE,
    can_test_ai_connections BOOLEAN DEFAULT FALSE,
    can_manage_ai_templates BOOLEAN DEFAULT FALSE,
    can_select_ai_models BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Habilitar RLS (políticas completas no arquivo de configuração principal)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
`;

    const blob = new Blob([sqlContent], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'krigzis-tcms-database-setup.sql';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Arquivo SQL baixado',
      description: 'Execute o arquivo no Supabase SQL Editor',
    });
  };

  // Se já tem configuração, mostrar status
  if (!needsSetup && currentConfig) {
    return (
      <div className="container mx-auto py-8 max-w-4xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <CheckCircle className="h-12 w-12 text-green-600" />
            <div>
              <h1 className="text-3xl font-bold text-green-600">Base de Dados Configurada</h1>
              <p className="text-muted-foreground">Sua base de dados está pronta para uso</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Informações da Configuração
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground">URL do Supabase</Label>
                <p className="font-mono text-sm break-all">{currentConfig.supabaseUrl}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Status</Label>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-green-600 font-medium">Ativo</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                Zona de Perigo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Remover a configuração irá desconectar você da base de dados atual. 
                  Esta ação não pode ser desfeita.
                </AlertDescription>
              </Alert>
              <div className="mt-4">
                <Button 
                  variant="destructive" 
                  onClick={handleRemoveConfig}
                  disabled={loading}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Remover Configuração
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Formulário de configuração
  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Settings className="h-12 w-12 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold">Configurar Base de Dados</h1>
            <p className="text-muted-foreground">Configure sua própria base de dados Supabase</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Instruções de Configuração
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">1. Criar projeto no Supabase</h4>
              <p className="text-sm text-muted-foreground">
                Acesse <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">supabase.com</a> e crie um novo projeto
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">2. Baixar e executar script SQL</h4>
              <Button variant="outline" onClick={downloadSQLFile} className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Baixar Script SQL
              </Button>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">3. Configurar credenciais</h4>
              <p className="text-sm text-muted-foreground">
                Preencha o formulário abaixo com as credenciais do seu projeto Supabase
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dados da Configuração</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="supabaseUrl">URL do Supabase *</Label>
                <Input
                  id="supabaseUrl"
                  type="url"
                  placeholder="https://xxx.supabase.co"
                  value={formData.supabaseUrl}
                  onChange={(e) => handleInputChange('supabaseUrl', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supabaseKey">Chave Anônima do Supabase *</Label>
                <Input
                  id="supabaseKey"
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={formData.supabaseKey}
                  onChange={(e) => handleInputChange('supabaseKey', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="aiApiKey">Chave da API de IA (Opcional)</Label>
                <Input
                  id="aiApiKey"
                  type="password"
                  placeholder="Chave para Google Gemini ou OpenAI"
                  value={formData.aiApiKey}
                  onChange={(e) => handleInputChange('aiApiKey', e.target.value)}
                />
              </div>

              <Separator />

              <Button type="submit" disabled={loading} className="w-full">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Configurar Base de Dados
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}; 
