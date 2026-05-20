import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Loader2, AlertTriangle, Zap } from 'lucide-react';
import { generateText } from '@/integrations/gemini/client';

export const ApiTestPanel = () => {
  const [testPrompt, setTestPrompt] = useState('Diga olá em português.');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    response?: string;
    error?: string;
  } | null>(null);

  const getCurrentApiKey = () => {
    try {
      const config = localStorage.getItem('mcp_config');
      if (config) {
        const parsedConfig = JSON.parse(config);
        const geminiModel = parsedConfig.models?.find((m: any) => m.provider === 'gemini');
        return geminiModel?.apiKey || '';
      }
    } catch (error) {
      console.warn('Failed to load API key from storage:', error);
    }
    return '';
  };

  const testApiConnection = async () => {
    setLoading(true);
    setResult(null);

    try {
      // Update API key in local storage if provided
      if (apiKey.trim()) {
        const config = localStorage.getItem('mcp_config');
        if (config) {
          const parsedConfig = JSON.parse(config);
          const geminiModelIndex = parsedConfig.models?.findIndex((m: any) => m.provider === 'gemini');
          if (geminiModelIndex !== -1) {
            parsedConfig.models[geminiModelIndex].apiKey = apiKey.trim();
            localStorage.setItem('mcp_config', JSON.stringify(parsedConfig));
          }
        }
      }

      const response = await generateText(testPrompt);
      
      setResult({
        success: true,
        message: 'Conexão com a API do Gemini estabelecida com sucesso!',
        response: response
      });
    } catch (error: any) {
      setResult({
        success: false,
        message: 'Falha na conexão com a API do Gemini',
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const currentKey = getCurrentApiKey();

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-blue-600" />
          Teste de Conectividade - API Gemini
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="current-key">Chave API Atual</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                id="current-key"
                type="password"
                value={currentKey}
                disabled
                placeholder="Nenhuma chave configurada"
              />
              <Badge variant={currentKey ? "default" : "secondary"}>
                {currentKey ? "Configurada" : "Não configurada"}
              </Badge>
            </div>
          </div>

          <div>
            <Label htmlFor="test-key">Nova Chave API (Opcional)</Label>
            <Input
              id="test-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Cole uma nova chave API para testar"
            />
            <p className="text-sm text-gray-500 mt-1">
              Se fornecida, esta chave será salva e usada para o teste
            </p>
          </div>

          <div>
            <Label htmlFor="test-prompt">Prompt de Teste</Label>
            <Textarea
              id="test-prompt"
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              placeholder="Digite um prompt simples para testar a API"
              rows={3}
            />
          </div>

          <Button 
            onClick={testApiConnection} 
            disabled={loading || (!currentKey && !apiKey.trim())}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testando Conexão...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Testar Conexão com Gemini
              </>
            )}
          </Button>
        </div>

        {result && (
          <Alert className={result.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
            <div className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription className="flex-1">
                <div className="space-y-2">
                  <p className={result.success ? "text-green-800" : "text-red-800"}>
                    {result.message}
                  </p>
                  
                  {result.response && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-green-700">Resposta da API:</p>
                      <div className="mt-1 p-2 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded text-sm">
                        {result.response}
                      </div>
                    </div>
                  )}
                  
                  {result.error && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-red-700">Detalhes do Erro:</p>
                      <div className="mt-1 p-2 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded text-sm font-mono">
                        {result.error}
                      </div>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </div>
          </Alert>
        )}

        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="space-y-2">
              <h4 className="font-medium text-blue-900 dark:text-blue-400">
                Como Obter uma Chave API do Gemini
              </h4>
              <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                <p>1. Acesse <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline">Google AI Studio</a></p>
                <p>2. Faça login com sua conta Google</p>
                <p>3. Clique em "Create API Key"</p>
                <p>4. Copie a chave gerada e cole no campo acima</p>
                <p>5. Configure no Model Control Panel para uso permanente</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}; 
