import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SwarmLayout } from "@/components/SwarmLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useNodes } from "@/hooks/useNodes";
import { apiService } from "@/services/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Loader2,
  RefreshCw,
  Play,
  Pause,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Container,
} from "lucide-react";

interface Service {
  id: string;
  name: string;
  image: string;
  desired_count: number;
  current_count: number;
}

const SwarmNodes = () => {
  const navigate = useNavigate();
  const { nodes, loading, error, refreshNodes, drainNode, activateNode } =
    useNodes();
  const { toast } = useToast();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [nodeServices, setNodeServices] = useState<Record<string, Service[]>>(
    {},
  );
  const [loadingServices, setLoadingServices] = useState<Set<string>>(
    new Set(),
  );

  const handleNodeToggle = async (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);

    if (expandedNodes.has(nodeId)) {
      // Collapse node
      newExpanded.delete(nodeId);
    } else {
      // Expand node and load services
      newExpanded.add(nodeId);

      if (!nodeServices[nodeId]) {
        setLoadingServices((prev) => new Set(prev).add(nodeId));
        try {
          const services = await apiService.getNodeServices(nodeId);
          setNodeServices((prev) => ({ ...prev, [nodeId]: services }));
        } catch (err) {
          toast({
            title: "Erreur",
            description: "Impossible de charger les services de ce nœud.",
            variant: "destructive",
          });
        } finally {
          setLoadingServices((prev) => {
            const updated = new Set(prev);
            updated.delete(nodeId);
            return updated;
          });
        }
      }
    }

    setExpandedNodes(newExpanded);
  };

  const handleServiceClick = (serviceId: string) => {
    navigate(`/service/${serviceId}`);
  };

  const getServiceStatusBadge = (current: number, desired: number) => {
    const isHealthy = current === desired && current > 0;
    const isStopped = current === 0;

    return (
      <Badge
        variant="secondary"
        className={
          isHealthy
            ? "bg-green-900 text-green-300 border-green-700"
            : isStopped
              ? "bg-gray-700 text-gray-300 border-gray-600"
              : "bg-yellow-900 text-yellow-300 border-yellow-700"
        }
      >
        {current}/{desired}
      </Badge>
    );
  };

  const handleDrain = async (nodeId: string, hostname: string) => {
    try {
      await drainNode(nodeId);
      toast({
        title: "Nœud drainé",
        description: `Le nœud ${hostname} a été drainé avec succès.`,
      });
    } catch (err) {
      toast({
        title: "Erreur",
        description: `Impossible de drainer le nœud ${hostname}.`,
        variant: "destructive",
      });
    }
  };

  const handleActivate = async (nodeId: string, hostname: string) => {
    try {
      await activateNode(nodeId);
      toast({
        title: "Nœud activé",
        description: `Le nœud ${hostname} a été activé avec succès.`,
      });
    } catch (err) {
      toast({
        title: "Erreur",
        description: `Impossible d'activer le nœud ${hostname}.`,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const isReady = status.toLowerCase() === "ready";
    return (
      <Badge
        variant="secondary"
        className={
          isReady
            ? "bg-green-900 text-green-300 border-green-700"
            : "bg-red-900 text-red-300 border-red-700"
        }
      >
        {status}
      </Badge>
    );
  };

  const getAvailabilityBadge = (availability: string) => {
    const isActive = availability.toLowerCase() === "active";
    const isDrain = availability.toLowerCase() === "drain";

    return (
      <Badge
        variant="secondary"
        className={
          isActive
            ? "bg-blue-900 text-blue-300 border-blue-700"
            : isDrain
              ? "bg-orange-900 text-orange-300 border-orange-700"
              : "bg-gray-700 text-gray-300 border-gray-600"
        }
      >
        {availability}
      </Badge>
    );
  };

  const getRoleBadge = (role: string) => {
    const isManager = role.toLowerCase() === "manager";
    return (
      <Badge
        variant={isManager ? "default" : "secondary"}
        className={
          isManager
            ? "bg-purple-900 text-purple-300 border-purple-700"
            : "bg-gray-700 text-gray-300 border-gray-600"
        }
      >
        {role}
      </Badge>
    );
  };

  if (loading) {
    return (
      <SwarmLayout>
        <div className="p-6">
          <h1 className="text-2xl font-semibold text-white mb-6">Nodes</h1>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-300">Chargement des nœuds...</span>
          </div>
        </div>
      </SwarmLayout>
    );
  }

  if (error) {
    return (
      <SwarmLayout>
        <div className="p-6">
          <h1 className="text-2xl font-semibold text-white mb-6">Nodes</h1>
          <Alert className="bg-red-900 border-red-700">
            <AlertDescription className="text-red-300">
              Erreur lors du chargement des nœuds: {error}
            </AlertDescription>
          </Alert>
          <Button
            onClick={refreshNodes}
            className="mt-4 bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Réessayer
          </Button>
        </div>
      </SwarmLayout>
    );
  }

  return (
    <SwarmLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-white">Nodes</h1>
          <Button
            onClick={refreshNodes}
            variant="outline"
            size="sm"
            className="border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-700 hover:bg-gray-800">
                <TableHead className="text-gray-300 font-medium">
                  Hostname
                </TableHead>
                <TableHead className="text-gray-300 font-medium">
                  Status
                </TableHead>
                <TableHead className="text-gray-300 font-medium">
                  Availability
                </TableHead>
                <TableHead className="text-gray-300 font-medium">
                  Role
                </TableHead>
                <TableHead className="text-gray-300 font-medium">CPU</TableHead>
                <TableHead className="text-gray-300 font-medium">
                  Memory
                </TableHead>
                <TableHead className="text-gray-300 font-medium">
                  IP Address
                </TableHead>
                <TableHead className="text-gray-300 font-medium">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nodes.map((node) => (
                <TableRow
                  key={node.id}
                  className="border-gray-700 hover:bg-gray-750"
                >
                  <TableCell className="text-white font-mono">
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-1 h-auto w-auto text-gray-400 hover:text-white"
                        onClick={() => handleNodeToggle(node.id)}
                      >
                        {expandedNodes.has(node.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                      <span>{node.hostname}</span>
                      {loadingServices.has(node.id) && (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      )}
                    </div>
                    {expandedNodes.has(node.id) && nodeServices[node.id] && (
                      <div className="mt-2 pl-6 space-y-1">
                        {nodeServices[node.id].length === 0 ? (
                          <span className="text-gray-400 text-sm">
                            Aucun service trouvé sur ce nœud.
                          </span>
                        ) : (
                          nodeServices[node.id].map((service) => (
                            <div
                              key={service.id}
                              className="flex items-center justify-between p-2 bg-gray-900 rounded cursor-pointer hover:bg-gray-700 transition-colors"
                              onClick={() => handleServiceClick(service.id)}
                            >
                              <div className="flex items-center space-x-2">
                                <Container className="h-4 w-4 text-blue-400" />
                                <span className="text-gray-300">
                                  {service.name}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2">
                                {getServiceStatusBadge(
                                  service.current_count,
                                  service.desired_count,
                                )}
                                <ExternalLink className="h-3 w-3 text-gray-400" />
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(node.status)}</TableCell>
                  <TableCell>
                    {getAvailabilityBadge(node.availability)}
                  </TableCell>
                  <TableCell>{getRoleBadge(node.role)}</TableCell>
                  <TableCell className="text-gray-300">{node.cpu}</TableCell>
                  <TableCell className="text-gray-300">{node.memory}</TableCell>
                  <TableCell className="text-gray-300 font-mono">
                    {node.ipAddress}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      {node.availability.toLowerCase() === "active" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDrain(node.id, node.hostname)}
                          className="border-orange-600 text-orange-300 hover:bg-orange-900"
                          disabled={node.role.toLowerCase() === "manager"}
                        >
                          <Pause className="h-3 w-3 mr-1" />
                          Drain
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleActivate(node.id, node.hostname)}
                          className="border-green-600 text-green-300 hover:bg-green-900"
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Activate
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {nodes.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            Aucun nœud trouvé dans le cluster.
          </div>
        )}
      </div>
    </SwarmLayout>
  );
};

export default SwarmNodes;
