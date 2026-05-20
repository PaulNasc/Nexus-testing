import React, { useState, useEffect } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Database, CheckCircle, AlertCircle, Loader2, ExternalLink, Copy } from 'lucide-react';
import { DatabaseSetupService } from '@/services/databaseSetupService';
import { useAuth } from '@/hooks/useAuth';

const DatabaseSetup: React.FC = () => {
  const [formData, setFormData] = useState({
    supabaseUrl: '',
    supabaseKey: '',
    aiApiKey: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [databaseStatus, setDatabaseStatus] = useState<any>(null);
  const [showSqlHelp, setShowSqlHelp] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadDatabaseStatus();
    }
  }, [user]);

  const loadDatabaseStatus = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const status = await DatabaseSetupService.getDatabaseStatus(user.id);
      setDatabaseStatus(status);
      
      if (!status.tablesExist) {
        setShowSqlHelp(true);
        toast({
          title: "Configuração Necessária",
          description: "As tabelas da base de dados não foram encontradas. Execute o SQL de configuração primeiro.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error loading database status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async () => {
    if (!formData.supabaseUrl || !formData.supabaseKey) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha a URL e chave do Supabase.",
        variant: "destructive",
      });
      return;
    }

    setIsTestingConnection(true);
    try {
      const isValid = await DatabaseSetupService.testDatabaseConnection(
        formData.supabaseUrl,
        formData.supabaseKey
      );

      if (isValid) {
        const hasRequiredTables = await DatabaseSetupService.validateDatabaseStructure(
          formData.supabaseUrl,
          formData.supabaseKey
        );

        if (hasRequiredTables) {
          setConnectionStatus('success');
          toast({
            title: "Conexão bem-sucedida!",
            description: "Conexão estabelecida e todas as tabelas encontradas.",
          });
        } else {
          setConnectionStatus('error');
          setShowSqlHelp(true);
          toast({
            title: "Tabelas não encontradas",
            description: "Conexão OK, mas as tabelas necessárias não existem. Execute o SQL primeiro.",
            variant: "destructive",
          });
        }
      } else {
        setConnectionStatus('error');
        toast({
          title: "Falha na conexão",
          description: "Não foi possível conectar com essas credenciais.",
          variant: "destructive",
        });
      }
    } catch (error) {
      setConnectionStatus('error');
      toast({
        title: "Erro",
        description: "Erro ao testar conexão: " + (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Erro",
        description: "Usuário não encontrado",
        variant: "destructive",
      });
      return;
    }

    if (connectionStatus !== 'success') {
      toast({
        title: "Teste a conexão primeiro",
        description: "Por favor, teste e confirme a conexão antes de prosseguir.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await DatabaseSetupService.setupUserDatabase(user.id, formData as any);
      
      if (result.success) {
        toast({
          title: "Sucesso!",
          description: result.message,
        });
        
        // Recarregar status local
        await loadDatabaseStatus();
      } else {
        toast({
          title: "Erro na configuração",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro inesperado: " + (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sqlMigrations = `-- Execute este SQL no SQL Editor do seu Supabase Dashboard

-- Criar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Criar enum para roles
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('master', 'admin', 'manager', 'tester', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tabela de perfis
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    display_name TEXT,
    email TEXT,
    avatar_url TEXT,
    role user_role DEFAULT 'viewer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de permissões (escopo global por usuário)
CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Habilitar RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Políticas básicas
CREATE POLICY "Users can manage own profile" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users can manage own permissions" ON user_permissions FOR ALL USING (user_id = auth.uid());

-- Criar perfil automático
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, email)
    VALUES (new.id, new.raw_user_meta_data->>'display_name', new.email);
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar perfil
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "SQL copiado para a área de transferência.",
    });
  };

  if (isLoading && !databaseStatus) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Verificando configuração da base de dados...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="text-center mb-8">
        <Database className="h-12 w-12 mx-auto mb-4 text-blue-600" />
        <h1 className="text-3xl font-bold">Configuração da Base de Dados</h1>
        <p className="text-muted-foreground mt-2">
          Configure sua base de dados Supabase para começar a usar o sistema
        </p>
      </div>

      {/* Status da base de dados */}
      {databaseStatus && (
        <Alert className={`mb-6 ${databaseStatus.tablesExist ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          {databaseStatus.tablesExist ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600" />
          )}
          <AlertDescription className={databaseStatus.tablesExist ? 'text-green-800' : 'text-red-800'}>
            <strong>Status:</strong> {databaseStatus.tablesExist 
              ? 'Tabelas encontradas na base de dados' 
              : 'Tabelas não encontradas - Execute o SQL de configuração primeiro'
            }
            {databaseStatus.errorMessage && (
              <div className="mt-2">
                <strong>Detalhes:</strong> {databaseStatus.errorMessage}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* SQL de configuração */}
      {showSqlHelp && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="h-5 w-5" />
              <span>1. Execute o SQL de Configuração</span>
            </CardTitle>
            <CardDescription>
              Primeiro, você precisa criar as tabelas no seu Supabase
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Execute este SQL no SQL Editor do seu Supabase Dashboard antes de configurar a conexão.
              </AlertDescription>
            </Alert>
            
            <div className="relative">
              <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto max-h-64 border">
                <code>{sqlMigrations}</code>
              </pre>
              <Button
                variant="outline"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard(sqlMigrations)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir Supabase Dashboard
              </Button>
              <Button
                variant="outline"
                onClick={loadDatabaseStatus}
              >
                Verificar Novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Formulário de configuração */}
      <Card>
        <CardHeader>
          <CardTitle>2. Configurar Conexão</CardTitle>
          <CardDescription>
            Insira as credenciais da sua base de dados Supabase
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="supabase-url">URL do Supabase *</Label>
                <Input
                  id="supabase-url"
                  type="url"
                  placeholder="https://seu-projeto.supabase.co"
                  value={formData.supabaseUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, supabaseUrl: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="supabase-key">Chave Anônima *</Label>
                <Input
                  id="supabase-key"
                  type="password"
                  placeholder="sua-chave-anonima-aqui"
                  value={formData.supabaseKey}
                  onChange={(e) => setFormData(prev => ({ ...prev, supabaseKey: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="ai-api-key">Chave da API de IA (Opcional)</Label>
              <Input
                id="ai-api-key"
                type="password"
                placeholder="sk-..."
                value={formData.aiApiKey}
                onChange={(e) => setFormData(prev => ({ ...prev, aiApiKey: e.target.value }))}
              />
            </div>

            <div className="flex space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={testConnection}
                disabled={isTestingConnection}
                className="flex-1"
              >
                {isTestingConnection ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : connectionStatus === 'success' ? (
                  <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                ) : connectionStatus === 'error' ? (
                  <AlertCircle className="h-4 w-4 mr-2 text-red-600" />
                ) : (
                  <Database className="h-4 w-4 mr-2" />
                )}
                Testar Conexão
              </Button>

              <Button
                type="submit"
                disabled={isLoading || connectionStatus !== 'success'}
                className="flex-1"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Configurar Sistema
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default DatabaseSetup; 
