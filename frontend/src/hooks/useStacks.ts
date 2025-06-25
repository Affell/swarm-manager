import { useState, useEffect } from 'react';
import { apiService, Stack, Service } from '../services/api';

interface UseStacksResult {
  stacks: Stack[];
  loading: boolean;
  error: string | null;
  refreshStacks: () => Promise<void>;
  stopStack: (stackName: string) => Promise<void>;
  startStack: (stackName: string) => Promise<void>;
}

interface UseStackDetailResult {
  services: Service[];
  loading: boolean;
  error: string | null;
  refreshServices: () => Promise<void>;
  stopService: (serviceId: string) => Promise<void>;
  restartService: (serviceId: string) => Promise<void>;
}

export const useStacks = (): UseStacksResult => {
  const [stacks, setStacks] = useState<Stack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStacks = async () => {
    try {
      setLoading(true);
      setError(null);
      const stacksData = await apiService.getStacks();
      setStacks(stacksData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const refreshStacks = async () => {
    await fetchStacks();
  };

  const stopStack = async (stackName: string) => {
    try {
      await apiService.stopStack(stackName);
      await fetchStacks(); // Refresh the stacks list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'arrêt de la stack');
    }
  };

  const startStack = async (stackName: string) => {
    try {
      await apiService.startStack(stackName);
      await fetchStacks(); // Refresh the stacks list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du démarrage de la stack');
    }
  };

  useEffect(() => {
    fetchStacks();
  }, []);

  return {
    stacks,
    loading,
    error,
    refreshStacks,
    stopStack,
    startStack,
  };
};

export const useStackDetail = (stackName: string): UseStackDetailResult => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServices = async () => {
    if (!stackName) return;
    
    try {
      setLoading(true);
      setError(null);
      const servicesData = await apiService.getStack(stackName);
      setServices(servicesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const refreshServices = async () => {
    await fetchServices();
  };

  const stopService = async (serviceId: string) => {
    try {
      await apiService.stopService(serviceId);
      await fetchServices(); // Refresh the services list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'arrêt du service');
    }
  };

  const restartService = async (serviceId: string) => {
    try {
      await apiService.restartService(serviceId);
      await fetchServices(); // Refresh the services list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du redémarrage du service');
    }
  };

  useEffect(() => {
    fetchServices();
  }, [stackName]);

  return {
    services,
    loading,
    error,
    refreshServices,
    stopService,
    restartService,
  };
};
