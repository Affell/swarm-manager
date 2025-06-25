import { useState, useEffect, useRef } from "react";
import { SwarmLayout } from "@/components/SwarmLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useSwarmLogs } from "@/hooks/useSwarmLogs";
import { useStacks } from "@/hooks/useStacks";
import { apiService } from "@/services/api";
import {
  Search,
  Filter,
  Play,
  Pause,
  RotateCcw,
  Download,
  Expand,
  Clock,
  AlertTriangle,
  Activity,
  ScrollText,
  Maximize2,
} from "lucide-react";

const SwarmLogs = () => {
  const { toast } = useToast();
  const { stacks } = useStacks();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStack, setSelectedStack] = useState<string>("all");
  const [selectedService, setSelectedService] = useState<string>("all");
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Options for swarm logs (search is handled client-side)
  const logsOptions = {
    stack: selectedStack && selectedStack !== "all" ? selectedStack : undefined,
    service:
      selectedService && selectedService !== "all"
        ? selectedService
        : undefined,
    // search is not included here - handled client-side
  };

  const {
    logs,
    connected,
    connecting,
    error,
    isPaused,
    clearLogs,
    pause,
    resume,
    downloadLogs,
  } = useSwarmLogs(logsOptions);

  // Load services when a stack is selected
  useEffect(() => {
    if (selectedStack && selectedStack !== "all") {
      const loadServices = async () => {
        try {
          const stackData = await apiService.getStack(selectedStack);
          setServices(stackData || []);
        } catch (err) {
          console.error("Failed to load services:", err);
          setServices([]);
        }
      };
      loadServices();
    } else {
      setServices([]);
      setSelectedService("all");
    }
  }, [selectedStack]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollAreaRef.current && !isPaused) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [logs, isPaused]);

  const filteredLogs = logs.filter(
    (log) =>
      !searchTerm || log.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleClearFilters = () => {
    setSelectedStack("all");
    setSelectedService("all");
    setSearchTerm("");
  };

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  return (
    <SwarmLayout>
      <div
        className={`p-6 ${isFullScreen ? "fixed inset-0 z-50 bg-gray-900" : ""}`}
      >
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-white">
            Logs du Swarm en Direct
          </h1>
          <div className="flex items-center space-x-2">
            <Badge
              variant="secondary"
              className={
                connecting
                  ? "bg-yellow-900 text-yellow-300 border-yellow-700"
                  : connected
                    ? "bg-green-900 text-green-300 border-green-700"
                    : "bg-red-900 text-red-300 border-red-700"
              }
            >
              {connecting
                ? "Connexion..."
                : connected
                  ? "Connecté"
                  : "Déconnecté"}
            </Badge>
            <Button
              onClick={toggleFullScreen}
              variant="outline"
              size="sm"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {error && (
          <Alert className="bg-red-900 border-red-700 mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-red-300">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              Filtres et Contrôles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {/* Stack Filter */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">
                  Stack
                </label>
                <Select value={selectedStack} onValueChange={setSelectedStack}>
                  <SelectTrigger className="bg-gray-900 border-gray-600 text-white">
                    <SelectValue placeholder="Toutes les stacks" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-600">
                    <SelectItem value="all">Toutes les stacks</SelectItem>
                    {stacks.map((stack) => (
                      <SelectItem key={stack.name} value={stack.name}>
                        {stack.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Service Filter */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">
                  Service
                </label>
                <Select
                  value={selectedService}
                  onValueChange={setSelectedService}
                  disabled={!selectedStack || selectedStack === "all"}
                >
                  <SelectTrigger className="bg-gray-900 border-gray-600 text-white">
                    <SelectValue placeholder="Tous les services" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-600">
                    <SelectItem value="all">Tous les services</SelectItem>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.name}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">
                  Recherche
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Rechercher dans les logs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-gray-900 border-gray-600 text-white placeholder:text-gray-400"
                  />
                </div>
              </div>

              {/* Actions */}
              <div>
                <label className="text-sm text-gray-400 mb-2 block">
                  Actions
                </label>
                <div className="flex space-x-2">
                  {isPaused ? (
                    <Button
                      onClick={resume}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={pause}
                      size="sm"
                      className="bg-yellow-600 hover:bg-yellow-700"
                    >
                      <Pause className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    onClick={clearLogs}
                    size="sm"
                    variant="outline"
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={downloadLogs}
                    size="sm"
                    variant="outline"
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-400">
                  Affichage: {filteredLogs.length} de {logs.length} entrées
                </span>
                {(selectedStack !== "all" ||
                  selectedService !== "all" ||
                  searchTerm) && (
                  <Button
                    onClick={handleClearFilters}
                    size="sm"
                    variant="ghost"
                    className="text-gray-400 hover:text-white"
                  >
                    <Filter className="h-4 w-4 mr-1" />
                    Effacer les filtres
                  </Button>
                )}
              </div>

              {isPaused && (
                <Badge
                  variant="secondary"
                  className="bg-yellow-900 text-yellow-300 border-yellow-700"
                >
                  En pause
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700 mt-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <ScrollText className="h-5 w-5 mr-2" />
              Logs en Direct
              <div className="ml-2 flex items-center">
                {!isPaused && (
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea
              ref={scrollAreaRef}
              className={`${isFullScreen ? "h-[calc(100vh-300px)]" : "h-[600px]"} w-full`}
            >
              <div className="p-4 font-mono text-sm space-y-1">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log, index) => (
                    <div
                      key={index}
                      className="text-gray-300 hover:bg-gray-750 px-2 py-1 rounded transition-colors whitespace-pre-wrap"
                    >
                      {log}
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500 text-center py-8">
                    {logs.length === 0
                      ? "Aucun log disponible..."
                      : "Aucun log ne correspond aux critères de recherche."}
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </SwarmLayout>
  );
};

export default SwarmLogs;
