import { apiClient as supabase } from '@/lib/api';

export type ReportType = 'trend-analysis' | 'failure-analysis' | 'requirements-defects';

export interface TrendAnalysisFilters {
  dateFrom?: string; // yyyy-mm-dd
  dateTo?: string;   // yyyy-mm-dd
  granularity?: 'day' | 'week' | 'month';
}

export interface FailureAnalysisFilters {
  dateFrom?: string;
  dateTo?: string;
}

export interface RequirementsDefectsFilters {
  dateFrom?: string;
  dateTo?: string;
}

export interface TrendAnalysisResponse {
  type: 'trend-analysis';
  generatedAt: string;
  data: {
    series: Array<{
      bucket: string;
      passed: number;
      failed: number;
      blocked: number;
      not_tested: number;
      total: number;
    }>;
    totals: { passed: number; failed: number; blocked: number; not_tested: number; total: number };
    granularity: 'day' | 'week' | 'month';
  };
}

export interface FailureAnalysisResponse {
  type: 'failure-analysis';
  generatedAt: string;
  data: {
    totals: {
      totalExecutions: number;
      failedExecutions: number;
      failureRate: number; // 0..1
      lastFailedAt: string | null;
    };
    topCases: Array<{ id: string; title: string; count: number }>;
    topPlans: Array<{ id: string; title: string; count: number }>;
  };
}

export interface RequirementsDefectsResponse {
  type: 'requirements-defects';
  generatedAt: string;
  data: {
    totals: { requirements: number; defects: number };
    requirementsByStatus: Record<string, number>;
    requirementsByPriority: Record<string, number>;
    defectsBySeverity: Record<string, number>;
    defectsByStatus: Record<string, number>;
  };
}

export async function invokeReportsAggregator<T = any>(payload: {
  type: ReportType;
  filters?: Record<string, any>;
}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('reports-aggregator', {
    body: payload,
  });
  if (error) {
    console.error('Erro ao invocar reports-aggregator:', error);
    throw error;
  }
  return data as T;
}

export const getTrendAnalysis = async (filters: TrendAnalysisFilters = {}): Promise<TrendAnalysisResponse> => {
  return invokeReportsAggregator<TrendAnalysisResponse>({ type: 'trend-analysis', filters });
};

export const getFailureAnalysis = async (filters: FailureAnalysisFilters = {}): Promise<FailureAnalysisResponse> => {
  return invokeReportsAggregator<FailureAnalysisResponse>({ type: 'failure-analysis', filters });
};

export const getRequirementsDefects = async (filters: RequirementsDefectsFilters = {}): Promise<RequirementsDefectsResponse> => {
  return invokeReportsAggregator<RequirementsDefectsResponse>({ type: 'requirements-defects', filters });
};
