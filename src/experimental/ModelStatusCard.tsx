import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, Settings, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { AIModel } from '@/types';
import * as ModelControlService from '@/services/modelControlService';
import { useNavigate } from 'react-router-dom';

export const ModelStatusCard = () => {
  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = () => {
    try {
      const config = ModelControlService.loadConfig();
      const geminiModels = config.models.filter(model => model.provider === 'gemini');
      setModels(geminiModels);
    } catch (error) {
      console.error('Erro ao carregar modelos:', error);
    } finally {
      setLoading(false);
    }
  };

  const getModelStatusIcon = (model: AIModel) => {
    if (!model.active) {
      return <XCircle className="h-4 w-4 text-gray-400" />;
    }
    
    if (model.version === '2.0-exp') {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
    
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getModelStatusText = (model: AIModel) => {
    if (!model.active) return 'Inativo';
    if (model.version === '2.0-exp') return 'Experimental';
    return 'Ativo';
  };

  const getModelStatusColor = (model: AIModel) => {
    if (!model.active) return 'bg-gray-100 text-gray-800';
    if (model.version === '2.0-exp') return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const activeModels = models.filter(m => m.active);
  const inactiveModels = models.filter(m => !m.active);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            Modelos IA Disponíveis
            <Badge className="bg-blue-100 text-blue-800">
              {activeModels.length} Ativos
            </Badge>
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/model-control')}
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Configurar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Modelos Ativos */}
          {activeModels.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Modelos Ativos</h4>
              <div className="grid gap-3">
                {activeModels.map((model) => (
                  <div 
                    key={model.id} 
                    className="flex items-center justify-between p-3 border rounded-lg bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      {getModelStatusIcon(model)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{model.name}</span>
                          {model.version === '2.0-exp' && (
                            <Badge variant="outline" className="text-purple-600 border-purple-600 text-xs">
                              Experimental
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{model.description}</p>
                      </div>
                    </div>
                    <Badge className={getModelStatusColor(model)}>
                      {getModelStatusText(model)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Modelos Inativos */}
          {inactiveModels.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Modelos Disponíveis (Inativos)</h4>
              <div className="grid gap-2">
                {inactiveModels.map((model) => (
                  <div 
                    key={model.id} 
                    className="flex items-center justify-between p-2 border rounded border-dashed bg-gray-25"
                  >
                    <div className="flex items-center gap-3">
                      {getModelStatusIcon(model)}
                      <div>
                        <span className="text-sm font-medium text-gray-600">{model.name}</span>
                        <p className="text-xs text-gray-500">{model.description}</p>
                      </div>
                    </div>
                    <Badge className={getModelStatusColor(model)}>
                      {getModelStatusText(model)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Informações Adicionais */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-900">API Premium Ativa</p>
                <p className="text-blue-700">
                  Você tem acesso a múltiplos modelos Gemini. Configure no Model Control Panel para otimizar cada tarefa.
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}; 
