import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { SwarmLayout } from "@/components/SwarmLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LogsComponent } from "@/components/LogsComponent";
import { useToast } from "@/hooks/use-toast";
import { apiService } from "@/services/api";
import { useServiceLogs } from "@/services/useServiceLogs";
import {
  ArrowLeft,
  RefreshCw,
  Play,
  Pause,
  RotateCcw,
  Activity,
  Container,
  Network,
  HardDrive,
  Settings,
  Loader2,
  AlertTriangle,
} from "lucide-react";

interface ServiceDetails {
  id: string;
  name: string;
  image: string;
  desired_count: number;
  current_count: number;
  created_at: string;
  updated_at: string;
  version: number;
  labels: Record<string, string>;
  constraints: string[];
  networks: string[];
  ports: Array<{
    protocol: string;
    target_port: number;
    published_port: number;
    publish_mode: string;
  }>;
  mounts: Array<{
    type: string;
    source: string;
    target: string;
    readonly: boolean;
  }>;
  env: string[];
  update_config: any;
  resources: any;
}

const ServiceDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [service, setService] = useState<ServiceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const {
    logs,
    connected,
    connecting,
    error: logsError,
    isPaused,
    clearLogs,
    pause,
    resume,
  } = useServiceLogs(id || "");

  const fetchService = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getService(id);
      setService(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erreur lors du chargement du service",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchService();
  }, [id]);

  const handleStop = async () => {
    if (!id) return;

    setActionLoading(true);
    try {
      await apiService.stopService(id);
      toast({
        title: "Service arrêté",
        description: `Le service ${service?.name} a été arrêté avec succès.`,
      });
      await fetchService();
    } catch (err) {
      toast({
        title: "Erreur",
        description: `Impossible d'arrêter le service ${service?.name}.`,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestart = async () => {
    if (!id) return;

    setActionLoading(true);
    try {
      await apiService.restartService(id);
      toast({
        title: "Service redémarré",
        description: `Le service ${service?.name} a été redémarré avec succès.`,
      });
      await fetchService();
    } catch (err) {
      toast({
        title: "Erreur",
        description: `Impossible de redémarrer le service ${service?.name}.`,
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = (current: number, desired: number) => {
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

  if (loading) {
    return (
      <SwarmLayout>
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-300">Chargement du service...</span>
          </div>
        </div>
      </SwarmLayout>
    );
  }

  if (error || !service) {
    return (
      <SwarmLayout>
        <div className="p-6">
          <Alert className="bg-red-900 border-red-700">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-red-300">
              {error || "Service non trouvé"}
            </AlertDescription>
          </Alert>
          <div className="flex space-x-2 mt-4">
            <Button
              onClick={() => navigate(-1)}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <Button
              onClick={fetchService}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Réessayer
            </Button>
          </div>
        </div>
      </SwarmLayout>
    );
  }

  return (
    <SwarmLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => navigate(-1)}
              variant="outline"
              size="sm"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-white">
                {service.name}
              </h1>
              <p className="text-gray-400 font-mono text-sm">{service.id}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {getStatusBadge(service.current_count, service.desired_count)}
            <Button
              onClick={fetchService}
              variant="outline"
              size="sm"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Service Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Container className="h-5 w-5 mr-2" />
                  Informations générales
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm">Image</p>
                    <p className="text-white font-mono">{service.image}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Version</p>
                    <p className="text-white">{service.version}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Créé le</p>
                    <p className="text-white">
                      {formatDate(service.created_at)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Mis à jour le</p>
                    <p className="text-white">
                      {formatDate(service.updated_at)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Networks */}
            {service.networks.length > 0 && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <Network className="h-5 w-5 mr-2" />
                    Réseaux
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {service.networks.map((network, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="bg-blue-900 text-blue-300 border-blue-700"
                      >
                        {network}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Ports */}
            {service.ports.length > 0 && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <Settings className="h-5 w-5 mr-2" />
                    Ports exposés
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {service.ports.map((port, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-gray-900 p-2 rounded"
                      >
                        <span className="text-white font-mono">
                          {port.published_port} → {port.target_port}
                        </span>
                        <div className="flex space-x-2">
                          <Badge variant="outline" className="text-gray-300">
                            {port.protocol?.toUpperCase() || "TCP"}
                          </Badge>
                          <Badge variant="outline" className="text-gray-300">
                            {port.publish_mode || "ingress"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Mounts */}
            {service.mounts && service.mounts.length > 0 && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <HardDrive className="h-5 w-5 mr-2" />
                    Montages
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {service.mounts.map((mount, index) => (
                      <div key={index} className="bg-gray-900 p-3 rounded">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-white font-mono">
                            {mount.source}
                          </span>
                          <Badge
                            variant="outline"
                            className={
                              mount.readonly ? "text-red-300" : "text-green-300"
                            }
                          >
                            {mount.readonly ? "RO" : "RW"}
                          </Badge>
                        </div>
                        <p className="text-gray-400 text-sm">
                          → {mount.target}
                        </p>
                        <p className="text-gray-500 text-xs">{mount.type}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Actions & Logs */}
          <div className="space-y-6">
            {/* Actions */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  onClick={handleStop}
                  disabled={actionLoading || service.current_count === 0}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50"
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Pause className="h-4 w-4 mr-2" />
                  )}
                  Arrêter
                </Button>
                <Button
                  onClick={handleRestart}
                  disabled={actionLoading}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4 mr-2" />
                  )}
                  Redémarrer
                </Button>
              </CardContent>
            </Card>

            {/* Logs */}
            <LogsComponent
              logs={logs}
              connected={connected}
              connecting={connecting}
              error={logsError}
              isPaused={isPaused}
              clearLogs={clearLogs}
              onPause={pause}
              onResume={resume}
              title={`Logs de ${service.name}`}
            />
          </div>
        </div>
      </div>
    </SwarmLayout>
  );
};

export default ServiceDetail;
