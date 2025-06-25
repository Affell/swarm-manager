import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Activity,
  Search,
  Download,
  RotateCcw,
  Maximize2,
  Play,
  Pause,
  AlertTriangle,
} from "lucide-react";

interface LogsComponentProps {
  logs: string[];
  connected: boolean;
  connecting: boolean;
  error: string | null;
  clearLogs?: () => void;
  title?: string;
  isPaused?: boolean;
  onPause?: () => void;
  onResume?: () => void;
}

export const LogsComponent = ({
  logs,
  connected,
  connecting,
  error,
  clearLogs,
  title = "Logs en direct",
  isPaused = false,
  onPause,
  onResume,
}: LogsComponentProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isFullScreen, setIsFullScreen] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

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

  // Stabiliser les fonctions pour éviter les re-renders qui font perdre le focus
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(e.target.value);
    },
    [],
  );

  const downloadLogs = useCallback(() => {
    const logsText = logs.join("\n");
    const blob = new Blob([logsText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [logs]);

  const LogsDisplay = ({ isExpanded = false }: { isExpanded?: boolean }) => (
    <div className={`space-y-4 ${isExpanded ? "h-full flex flex-col" : ""}`}>
      {/* Controls */}
      <div className="flex items-center justify-between gap-4">
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
          {isPaused && (
            <Badge
              variant="secondary"
              className="bg-yellow-900 text-yellow-300 border-yellow-700"
            >
              En pause
            </Badge>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {isExpanded && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="pl-10 bg-gray-900 border-gray-600 text-white placeholder:text-gray-400 w-64"
              />
            </div>
          )}

          {onPause &&
            onResume &&
            (isPaused ? (
              <Button
                onClick={onResume}
                size="sm"
                className="bg-green-600 hover:bg-green-700"
              >
                <Play className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={onPause}
                size="sm"
                className="bg-yellow-600 hover:bg-yellow-700"
              >
                <Pause className="h-4 w-4" />
              </Button>
            ))}

          {clearLogs && (
            <Button
              onClick={clearLogs}
              size="sm"
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}

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

      {/* Search for compact view */}
      {!isExpanded && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Rechercher dans les logs..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="pl-10 bg-gray-900 border-gray-600 text-white placeholder:text-gray-400"
          />
        </div>
      )}

      {/* Error display */}
      {error && (
        <Alert className="bg-red-900 border-red-700">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-red-300">{error}</AlertDescription>
        </Alert>
      )}

      {/* Logs display */}
      <div className={isExpanded ? "flex-1 min-h-0" : ""}>
        <ScrollArea
          ref={scrollAreaRef}
          className={`${isExpanded ? "h-[calc(90vh-200px)]" : "h-64"} w-full`}
        >
          <div className="bg-black rounded p-4 font-mono text-sm">
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log, index) => (
                <div
                  key={index}
                  className="text-gray-300 whitespace-pre-wrap hover:bg-gray-800 px-2 py-1 rounded transition-colors"
                >
                  {log}
                </div>
              ))
            ) : (
              <div className="text-gray-500">
                {logs.length === 0
                  ? "Aucun log disponible..."
                  : "Aucun log ne correspond à votre recherche."}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Stats */}
      <div className="text-sm text-gray-400 flex items-center justify-between">
        <span>
          Affichage: {filteredLogs.length} de {logs.length} logs
        </span>
        {!isPaused && (
          <span className="flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
            En direct
          </span>
        )}
      </div>
    </div>
  );

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            {title}
          </div>
          <Dialog open={isFullScreen} onOpenChange={setIsFullScreen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-7xl h-[90vh] bg-gray-800 border-gray-700">
              <DialogHeader>
                <DialogTitle className="text-white">
                  {title} - Vue étendue
                </DialogTitle>
              </DialogHeader>
              <div className="h-full">
                <LogsDisplay isExpanded />
              </div>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <LogsDisplay />
      </CardContent>
    </Card>
  );
};
