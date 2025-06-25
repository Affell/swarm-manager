import { useState, useEffect } from 'react';
import { apiService } from '../services/api';

export interface CleanupEstimate {
  unused_images: number;
  stopped_containers: number;
  unused_networks: number;
  unused_volumes: number;
  total_estimate: number;
}

export interface SystemInfo {
  disk_usage: any;
  system_info: any;
  containers_count: number;
  images_count: number;
  volumes_count: number;
  networks_count: number;
}

export const useCleanup = () => {
  const [estimate, setEstimate] = useState<CleanupEstimate | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEstimate = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getCleanupEstimate();
      setEstimate(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching cleanup estimate');
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getSystemInfo();
      setSystemInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching system info');
    } finally {
      setLoading(false);
    }
  };

  const pruneImages = async () => {
    try {
      setLoading(true);
      setError(null);
      await apiService.pruneImages();
      await fetchEstimate(); // Refresh estimate after cleanup
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error pruning images');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const pruneContainers = async () => {
    try {
      setLoading(true);
      setError(null);
      await apiService.pruneContainers();
      await fetchEstimate(); // Refresh estimate after cleanup
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error pruning containers');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const pruneVolumes = async () => {
    try {
      setLoading(true);
      setError(null);
      await apiService.pruneVolumes();
      await fetchEstimate(); // Refresh estimate after cleanup
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error pruning volumes');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const pruneNetworks = async () => {
    try {
      setLoading(true);
      setError(null);
      await apiService.pruneNetworks();
      await fetchEstimate(); // Refresh estimate after cleanup
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error pruning networks');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const pruneSystem = async (includeVolumes: boolean = false) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiService.pruneSystem(includeVolumes);
      await fetchEstimate(); // Refresh estimate after cleanup
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error pruning system');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEstimate();
    fetchSystemInfo();
  }, []);

  return {
    estimate,
    systemInfo,
    loading,
    error,
    fetchEstimate,
    fetchSystemInfo,
    pruneImages,
    pruneContainers,
    pruneVolumes,
    pruneNetworks,
    pruneSystem,
  };
};
