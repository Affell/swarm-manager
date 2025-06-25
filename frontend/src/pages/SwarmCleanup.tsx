import { useState } from "react";
import { SwarmLayout } from "@/components/SwarmLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useCleanup } from "@/hooks/useCleanup";
import {
  RefreshCw,
  Trash2,
  HardDrive,
  Container,
  Image,
  Network,
  Database,
  AlertTriangle,
  CheckCircle,
  Loader2,
  BarChart3,
} from "lucide-react";

const formatBytes = (bytes: number): string => {
  if (!bytes || bytes === 0 || isNaN(bytes)) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i < 0 || i >= sizes.length) return "0 B";
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const CleanupCard = ({
  title,
  description,
  icon: Icon,
  estimatedSpace,
  onCleanup,
  loading,
  color = "blue",
}: {
  title: string;
  description: string;
  icon: any;
  estimatedSpace: number;
  onCleanup: () => Promise<void>;
  loading: boolean;
  color?: "blue" | "green" | "orange" | "red";
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const colorVariants = {
    blue: "text-blue-400 bg-blue-900/20 border-blue-800",
    green: "text-green-400 bg-green-900/20 border-green-800",
    orange: "text-orange-400 bg-orange-900/20 border-orange-800",
    red: "text-red-400 bg-red-900/20 border-red-800",
  };

  const handleCleanup = async () => {
    try {
      setIsProcessing(true);
      await onCleanup();
      toast({
        title: "Nettoyage réussi",
        description: `${title} a été nettoyé avec succès.`,
      });
    } catch (err) {
      toast({
        title: "Erreur de nettoyage",
        description: `Impossible de nettoyer ${title.toLowerCase()}.`,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="bg-gray-800 border-gray-700 hover:border-gray-600 transition-colors">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${colorVariants[color]}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-white font-medium">{title}</h3>
              <p className="text-gray-400 text-sm">{description}</p>
            </div>
          </div>
          <Badge variant={estimatedSpace > 0 ? "default" : "secondary"}>
            {formatBytes(estimatedSpace)}
          </Badge>
        </div>
        <Button
          onClick={handleCleanup}
          disabled={isProcessing || loading || estimatedSpace === 0}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 border-blue-600 text-white"
          size="sm"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Nettoyage...
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4 mr-2" />
              Nettoyer
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

const SwarmCleanup = () => {
  const {
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
  } = useCleanup();
  const { toast } = useToast();
  const [isSystemCleaning, setIsSystemCleaning] = useState(false);

  const handleSystemCleanup = async (includeVolumes: boolean = false) => {
    try {
      setIsSystemCleaning(true);
      const result = await pruneSystem(includeVolumes);
      toast({
        title: "Nettoyage système terminé",
        description: `Espace libéré: ${formatBytes(result.space_reclaimed)}`,
      });
    } catch (err) {
      toast({
        title: "Erreur de nettoyage système",
        description: "Impossible de nettoyer le système.",
        variant: "destructive",
      });
    } finally {
      setIsSystemCleaning(false);
    }
  };

  const handleRefresh = async () => {
    await Promise.all([fetchEstimate(), fetchSystemInfo()]);
  };

  if (error) {
    return (
      <SwarmLayout>
        <div className="p-6">
          <h1 className="text-2xl font-semibold text-white mb-6">Cleanup</h1>
          <Alert className="bg-red-900 border-red-700">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-red-300">
              Erreur lors du chargement des données de nettoyage: {error}
            </AlertDescription>
          </Alert>
          <Button
            onClick={handleRefresh}
            className="mt-4 bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Réessayer
          </Button>
        </div>
      </SwarmLayout>
    );
  }

  const totalSpaceToFree = estimate?.total_estimate || 0;
  const diskUsage = systemInfo?.disk_usage;

  return (
    <SwarmLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-white mb-2">
              Docker Cleanup
            </h1>
            <p className="text-gray-400">
              Libérez de l'espace disque en supprimant les ressources Docker
              inutilisées.
            </p>
          </div>
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            disabled={loading}
            className="border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Actualiser
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <HardDrive className="h-8 w-8 text-blue-400" />
                <div>
                  <p className="text-gray-400 text-sm">Espace à libérer</p>
                  <p className="text-2xl font-bold text-white">
                    {formatBytes(totalSpaceToFree)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <Container className="h-8 w-8 text-green-400" />
                <div>
                  <p className="text-gray-400 text-sm">Conteneurs</p>
                  <p className="text-2xl font-bold text-white">
                    {systemInfo?.containers_count || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <Image className="h-8 w-8 text-orange-400" />
                <div>
                  <p className="text-gray-400 text-sm">Images</p>
                  <p className="text-2xl font-bold text-white">
                    {systemInfo?.images_count || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <Database className="h-8 w-8 text-purple-400" />
                <div>
                  <p className="text-gray-400 text-sm">Volumes</p>
                  <p className="text-2xl font-bold text-white">
                    {systemInfo?.volumes_count || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Individual Cleanup Options */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Trash2 className="h-5 w-5 mr-2" />
                  Options de nettoyage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <CleanupCard
                    title="Images inutilisées"
                    description="Supprimer les images Docker non utilisées"
                    icon={Image}
                    estimatedSpace={estimate?.unused_images || 0}
                    onCleanup={pruneImages}
                    loading={loading}
                    color="orange"
                  />
                  <CleanupCard
                    title="Conteneurs arrêtés"
                    description="Supprimer les conteneurs qui ne sont plus en cours d'exécution"
                    icon={Container}
                    estimatedSpace={estimate?.stopped_containers || 0}
                    onCleanup={pruneContainers}
                    loading={loading}
                    color="green"
                  />
                  <CleanupCard
                    title="Réseaux inutilisés"
                    description="Supprimer les réseaux Docker non utilisés"
                    icon={Network}
                    estimatedSpace={estimate?.unused_networks || 0}
                    onCleanup={pruneNetworks}
                    loading={loading}
                    color="blue"
                  />
                  <CleanupCard
                    title="Volumes inutilisés"
                    description="Supprimer les volumes Docker non utilisés"
                    icon={Database}
                    estimatedSpace={estimate?.unused_volumes || 0}
                    onCleanup={pruneVolumes}
                    loading={loading}
                    color="red"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* System Cleanup & Stats */}
          <div className="space-y-6">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Nettoyage système
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <p className="text-gray-400 text-sm mb-2">
                    Espace total à libérer
                  </p>
                  <p className="text-3xl font-bold text-white mb-4">
                    {formatBytes(totalSpaceToFree)}
                  </p>
                </div>

                <Button
                  onClick={() => handleSystemCleanup(false)}
                  disabled={
                    isSystemCleaning || loading || totalSpaceToFree === 0
                  }
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 border-blue-600 text-white"
                >
                  {isSystemCleaning ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Nettoyage...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Nettoyage rapide
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => handleSystemCleanup(true)}
                  disabled={
                    isSystemCleaning || loading || totalSpaceToFree === 0
                  }
                  className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 border-red-600 text-white"
                >
                  {isSystemCleaning ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Nettoyage...
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Nettoyage complet
                    </>
                  )}
                </Button>

                <p className="text-xs text-gray-500 text-center">
                  Le nettoyage complet inclut les volumes
                </p>
              </CardContent>
            </Card>

            {diskUsage && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center">
                    <HardDrive className="h-5 w-5 mr-2" />
                    Utilisation de l'espace
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Images</span>
                    <span className="text-white">
                      {formatBytes(
                        diskUsage.Images?.reduce(
                          (acc: number, img: any) => acc + img.Size,
                          0,
                        ) || 0,
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Conteneurs</span>
                    <span className="text-white">
                      {formatBytes(
                        diskUsage.Containers?.reduce(
                          (acc: number, container: any) =>
                            acc + container.SizeRw,
                          0,
                        ) || 0,
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Volumes</span>
                    <span className="text-white">
                      {formatBytes(
                        diskUsage.Volumes?.reduce(
                          (acc: number, vol: any) =>
                            acc + vol.UsageData?.Size || 0,
                          0,
                        ) || 0,
                      )}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {totalSpaceToFree === 0 && !loading && (
          <Card className="bg-gray-800 border-gray-700 mt-6">
            <CardContent className="p-6 text-center">
              <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
              <h3 className="text-white font-medium mb-2">Système propre !</h3>
              <p className="text-gray-400">
                Aucune ressource Docker inutilisée n'a été détectée. Votre
                système est déjà optimisé.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </SwarmLayout>
  );
};

export default SwarmCleanup;
