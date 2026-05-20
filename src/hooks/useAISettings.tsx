
import { useState, useEffect } from 'react';

interface AISettings {
  batchGenerationEnabled: boolean;
  batchCaseGenerationEnabled: boolean;
  // Modelo preferido para os modais de geração por IA. "default" usa o modelo base do painel.
  preferredModel?: string; // id do modelo ou "default"
  hideInactiveModels?: boolean;
}

const DEFAULT_SETTINGS: AISettings = {
  batchGenerationEnabled: false,
  batchCaseGenerationEnabled: false,
  preferredModel: 'default',
  hideInactiveModels: false,
};

export const useAISettings = () => {
  const [settings, setSettings] = useState<AISettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const saved = localStorage.getItem('ai-settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Garantir defaults para novos campos
        setSettings({ ...DEFAULT_SETTINGS, ...(parsed || {}) });
      } catch (error) {
        console.error('Erro ao carregar configurações da IA:', error);
      }
    }
  }, []);

  const updateSettings = (newSettings: Partial<AISettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem('ai-settings', JSON.stringify(updated));
  };

  return { settings, updateSettings };
};
