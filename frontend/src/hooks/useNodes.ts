import { useState, useEffect } from 'react';
import { apiService, Node } from '../services/api';

interface UseNodesResult {
  nodes: Node[];
  loading: boolean;
  error: string | null;
  refreshNodes: () => Promise<void>;
  drainNode: (nodeId: string) => Promise<void>;
  activateNode: (nodeId: string) => Promise<void>;
}

export const useNodes = (): UseNodesResult => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNodes = async () => {
    try {
      setLoading(true);
      setError(null);
      const nodesData = await apiService.getNodes();
      setNodes(nodesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const refreshNodes = async () => {
    await fetchNodes();
  };

  const drainNode = async (nodeId: string) => {
    try {
      await apiService.drainNode(nodeId);
      await fetchNodes(); // Refresh the nodes list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du drain du nœud');
    }
  };

  const activateNode = async (nodeId: string) => {
    try {
      await apiService.activateNode(nodeId);
      await fetchNodes(); // Refresh the nodes list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'activation du nœud');
    }
  };

  useEffect(() => {
    fetchNodes();
  }, []);

  return {
    nodes,
    loading,
    error,
    refreshNodes,
    drainNode,
    activateNode,
  };
};
