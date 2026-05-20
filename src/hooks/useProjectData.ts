import { useState, useEffect } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { getTestPlans, getTestCases, getTestExecutions } from '@/services/apiClientService';
import { TestPlan, TestCase, TestExecution } from '@/types';

export const useProjectData = () => {
  const { currentProject, projects } = useProject();
  const [testPlans, setTestPlans] = useState<TestPlan[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [testExecutions, setTestExecutions] = useState<TestExecution[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProjectData = async () => {
    if (!currentProject) {
      setTestPlans([]);
      setTestCases([]);
      setTestExecutions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Carregar dados filtrados por projeto atual
      const [plans, cases, executions] = await Promise.all([
        getTestPlans(currentProject.id),
        getTestCases(currentProject.id),
        getTestExecutions(currentProject.id)
      ]);

      setTestPlans(plans || []);
      setTestCases(cases || []);
      setTestExecutions(executions || []);
    } catch (error) {
      console.error('Erro ao carregar dados do projeto:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjectData();
  }, [currentProject]);

  const refreshData = () => {
    loadProjectData();
  };

  return {
    testPlans,
    testCases,
    testExecutions,
    loading,
    refreshData,
    currentProject
  };
};
