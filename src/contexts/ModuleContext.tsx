import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { ModuleKey, MODULE_CATALOG, PlanTier, TIER_MODULE_PRESETS } from '@/config/modules';

interface ModuleContextType {
  modules: Record<ModuleKey, boolean>;
  isModuleEnabled: (key: ModuleKey) => boolean;
  toggleModule: (key: ModuleKey, enabled?: boolean) => void;
  setPlanTier: (tier: PlanTier) => void;
  activeTier: PlanTier;
  resetToDefaults: () => void;
}

const STORAGE_KEY = 'nexus_active_modules';
const TIER_STORAGE_KEY = 'nexus_plan_tier';

const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

export const ModuleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTier, setActiveTierState] = useState<PlanTier>(() => {
    try {
      const saved = localStorage.getItem(TIER_STORAGE_KEY) as PlanTier;
      if (saved && (saved === 'starter' || saved === 'pro' || saved === 'enterprise')) {
        return saved;
      }
    } catch { /* ignore */ }
    return 'enterprise';
  });

  const [modules, setModules] = useState<Record<ModuleKey, boolean>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch { /* ignore */ }
    
    // Default: initialize from enterprise or catalog defaults
    const initial: Record<string, boolean> = {};
    for (const [key, def] of Object.entries(MODULE_CATALOG)) {
      initial[key] = def.defaultEnabled;
    }
    return initial as Record<ModuleKey, boolean>;
  });

  const persistModules = useCallback((newModules: Record<ModuleKey, boolean>) => {
    setModules(newModules);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newModules));
    } catch { /* ignore */ }
  }, []);

  const isModuleEnabled = useCallback((key: ModuleKey): boolean => {
    return Boolean(modules[key]);
  }, [modules]);

  const toggleModule = useCallback((key: ModuleKey, enabled?: boolean) => {
    setModules((prev) => {
      const target = enabled !== undefined ? enabled : !prev[key];
      const updated = { ...prev, [key]: target };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch { /* ignore */ }
      return updated;
    });
  }, []);

  const setPlanTier = useCallback((tier: PlanTier) => {
    setActiveTierState(tier);
    try {
      localStorage.setItem(TIER_STORAGE_KEY, tier);
    } catch { /* ignore */ }
    const preset = TIER_MODULE_PRESETS[tier];
    if (preset) {
      persistModules(preset);
    }
  }, [persistModules]);

  const resetToDefaults = useCallback(() => {
    setPlanTier('enterprise');
  }, [setPlanTier]);

  const value = useMemo(() => ({
    modules,
    isModuleEnabled,
    toggleModule,
    setPlanTier,
    activeTier,
    resetToDefaults,
  }), [modules, isModuleEnabled, toggleModule, setPlanTier, activeTier, resetToDefaults]);

  return (
    <ModuleContext.Provider value={value}>
      {children}
    </ModuleContext.Provider>
  );
};

export const useModules = (): ModuleContextType => {
  const context = useContext(ModuleContext);
  if (!context) {
    throw new Error('useModules must be used within a ModuleProvider');
  }
  return context;
};
