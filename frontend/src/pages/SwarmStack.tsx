import { useState } from "react";
import { SwarmLayout } from "@/components/SwarmLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useStacks, useStackDetail } from "@/hooks/useStacks";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronRight,
  ChevronDown,
  Loader2,
  RefreshCw,
  Play,
  Pause,
  RotateCcw,
} from "lucide-react";

const SwarmStack = () => {
  const { stacks, loading, error, refreshStacks, stopStack, startStack } =
    useStacks();
  const [expandedStacks, setExpandedStacks] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const toggleStack = (stackName: string) => {
    const newExpanded = new Set(expandedStacks);
    if (newExpanded.has(stackName)) {
      newExpanded.delete(stackName);
    } else {
      newExpanded.add(stackName);
    }
    setExpandedStacks(newExpanded);
  };

  const handleStopStack = async (stackName: string) => {
    try {
      await stopStack(stackName);
      toast({
        title: "Stack arrêtée",
        description: `La stack ${stackName} a été arrêtée avec succès.`,
      });
    } catch (err) {
      toast({
        title: "Erreur",
        description: `Impossible d'arrêter la stack ${stackName}.`,
        variant: "destructive",
      });
    }
  };

  const handleStartStack = async (stackName: string) => {
    try {
      await startStack(stackName);
      toast({
        title: "Stack démarrée",
        description: `La stack ${stackName} a été démarrée avec succès.`,
      });
    } catch (err) {
      toast({
        title: "Erreur",
        description: `Impossible de démarrer la stack ${stackName}.`,
        variant: "destructive",
      });
    }
  };

  const getStackStatus = (stack: any) => {
    const runningServices = stack.services.filter(
      (s: any) => s.current_count > 0,
    ).length;
    const totalServices = stack.services.length;

    if (runningServices === 0) return "Stopped";
    if (runningServices === totalServices) return "Running";
    return "Partial";
  };

  const getStackStatusBadge = (status: string) => {
    switch (status) {
      case "Running":
        return (
          <Badge className="bg-green-900 text-green-300 border-green-700">
            Running
          </Badge>
        );
      case "Stopped":
        return (
          <Badge className="bg-red-900 text-red-300 border-red-700">
            Stopped
          </Badge>
        );
      case "Partial":
        return (
          <Badge className="bg-orange-900 text-orange-300 border-orange-700">
            Partial
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-700 text-gray-300 border-gray-600">
            Unknown
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <SwarmLayout>
        <div className="p-6">
          <h1 className="text-2xl font-semibold text-white mb-6">Stacks</h1>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-300">Chargement des stacks...</span>
          </div>
        </div>
      </SwarmLayout>
    );
  }

  if (error) {
    return (
      <SwarmLayout>
        <div className="p-6">
          <h1 className="text-2xl font-semibold text-white mb-6">Stacks</h1>
          <Alert className="bg-red-900 border-red-700">
            <AlertDescription className="text-red-300">
              Erreur lors du chargement des stacks: {error}
            </AlertDescription>
          </Alert>
          <Button
            onClick={refreshStacks}
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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-white">Stacks</h1>
          <div className="flex space-x-2">
            <Button
              onClick={refreshStacks}
              variant="outline"
              size="sm"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-lg font-medium text-white">
              Docker Swarm Stacks ({stacks.length})
            </h2>
          </div>

          <div className="divide-y divide-gray-700">
            {stacks.map((stack) => {
              const status = getStackStatus(stack);
              const isExpanded = expandedStacks.has(stack.name);

              return (
                <div key={stack.name}>
                  {/* Stack Header */}
                  <div className="flex items-center justify-between p-4 hover:bg-gray-750 transition-colors">
                    <button
                      onClick={() => toggleStack(stack.name)}
                      className="flex items-center space-x-3 flex-1 text-left"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <span className="text-white font-medium text-lg">
                            {stack.name}
                          </span>
                          {getStackStatusBadge(status)}
                          <span className="text-gray-400 text-sm">
                            {stack.services.length} service
                            {stack.services.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </button>
                    <div className="flex space-x-2">
                      {status !== "Stopped" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStopStack(stack.name)}
                          className="border-red-600 text-red-300 hover:bg-red-900"
                        >
                          <Pause className="h-3 w-3 mr-1" />
                          Stop
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartStack(stack.name)}
                          className="border-green-600 text-green-300 hover:bg-green-900"
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Start
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Stack Services (expanded) */}
                  {isExpanded && (
                    <div className="bg-gray-850 border-t border-gray-700">
                      <StackServicesTable stackName={stack.name} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {stacks.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            Aucune stack trouvée dans le cluster.
          </div>
        )}
      </div>
    </SwarmLayout>
  );
};

// Composant séparé pour afficher les services d'une stack
const StackServicesTable = ({ stackName }: { stackName: string }) => {
  const {
    services,
    loading,
    error,
    refreshServices,
    stopService,
    restartService,
  } = useStackDetail(stackName);
  const { toast } = useToast();

  const handleStopService = async (serviceId: string, serviceName: string) => {
    try {
      await stopService(serviceId);
      toast({
        title: "Service arrêté",
        description: `Le service ${serviceName} a été arrêté avec succès.`,
      });
    } catch (err) {
      toast({
        title: "Erreur",
        description: `Impossible d'arrêter le service ${serviceName}.`,
        variant: "destructive",
      });
    }
  };

  const handleRestartService = async (
    serviceId: string,
    serviceName: string,
  ) => {
    try {
      await restartService(serviceId);
      toast({
        title: "Service redémarré",
        description: `Le service ${serviceName} a été redémarré avec succès.`,
      });
    } catch (err) {
      toast({
        title: "Erreur",
        description: `Impossible de redémarrer le service ${serviceName}.`,
        variant: "destructive",
      });
    }
  };

  const getServiceStatus = (service: any) => {
    if (service.current_count === 0) return "Stopped";
    if (service.current_count === service.desired_count) return "Running";
    return "Scaling";
  };

  const getServiceStatusBadge = (status: string) => {
    switch (status) {
      case "Running":
        return (
          <Badge className="bg-green-900 text-green-300 border-green-700">
            Running
          </Badge>
        );
      case "Stopped":
        return (
          <Badge className="bg-red-900 text-red-300 border-red-700">
            Stopped
          </Badge>
        );
      case "Scaling":
        return (
          <Badge className="bg-orange-900 text-orange-300 border-orange-700">
            Scaling
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-700 text-gray-300 border-gray-600">
            Unknown
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-300">Chargement des services...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Alert className="bg-red-900 border-red-700">
          <AlertDescription className="text-red-300">
            Erreur lors du chargement des services: {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="overflow-hidden">
      <div className="p-4 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-md font-medium text-white">
            Services de la stack {stackName}
          </h3>
          <Button
            onClick={refreshServices}
            variant="outline"
            size="sm"
            className="border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="border-gray-700 hover:bg-gray-800">
            <TableHead className="text-gray-300 font-medium">Name</TableHead>
            <TableHead className="text-gray-300 font-medium">Image</TableHead>
            <TableHead className="text-gray-300 font-medium">
              Replicas
            </TableHead>
            <TableHead className="text-gray-300 font-medium">Status</TableHead>
            <TableHead className="text-gray-300 font-medium">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map((service) => {
            const status = getServiceStatus(service);
            return (
              <TableRow
                key={service.id}
                className="border-gray-700 hover:bg-gray-750"
              >
                <TableCell className="text-white font-mono">
                  {service.name}
                </TableCell>
                <TableCell className="text-gray-300 font-mono text-sm">
                  {service.image}
                </TableCell>
                <TableCell className="text-gray-300">
                  {service.current_count}/{service.desired_count}
                </TableCell>
                <TableCell>{getServiceStatusBadge(status)}</TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleRestartService(service.id, service.name)
                      }
                      className="border-blue-600 text-blue-300 hover:bg-blue-900"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Restart
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleStopService(service.id, service.name)
                      }
                      className="border-red-600 text-red-300 hover:bg-red-900"
                      disabled={status === "Stopped"}
                    >
                      <Pause className="h-3 w-3 mr-1" />
                      Stop
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {services.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          Aucun service trouvé pour cette stack.
        </div>
      )}
    </div>
  );
};

export default SwarmStack;
