import React, { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getStack, stopService, restartService } from "../services/api";
import { useServiceLogs } from "../services/useServiceLogs";
import type { Service } from "../services/api";
import "./StackDetail.css";

const StackDetail: React.FC = () => {
  const { name } = useParams<{ name: string }>();
  const queryClient = useQueryClient();
  const { data: services } = useQuery<Service[]>({
    queryKey: ["stack", name],
    queryFn: () => getStack(name!),
  });

  const stopMutation = useMutation({
    mutationFn: stopService,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["stack", name] }),
  });
  const restartMutation = useMutation({
    mutationFn: restartService,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["stack", name] }),
  });

  // État pour afficher/masquer la fenêtre modale des logs
  const [showLogs, setShowLogs] = useState<string | null>(null);

  // Référence à l'élément de conteneur de logs pour l'auto-scrolling
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Utiliser notre hook WebSocket pour les logs
  const { logs, isConnected, error, clearLogs } = useServiceLogs(showLogs);

  // Auto-scrolling lorsque de nouveaux logs arrivent
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Fonction pour afficher les logs d'un service
  const viewLogs = (id: string) => {
    clearLogs();
    setShowLogs(id);
  };

  // Fonction pour fermer la fenêtre modale des logs
  const closeLogs = () => {
    setShowLogs(null);
  };

  return (
    <div className="stack-detail">
      <h2>Stack: {name}</h2>
      <div className="cards">
        {services?.map((s) => (
          <div key={s.id} className="card service-card">
            <h3>{s.name}</h3>
            <p>Image: {s.image}</p>
            <p>
              Replicas: {s.current_count} / {s.desired_count}
            </p>
            <div className="actions">
              <button onClick={() => stopMutation.mutate(s.id)}>Stop</button>
              <button onClick={() => restartMutation.mutate(s.id)}>
                Restart
              </button>
              <button onClick={() => viewLogs(s.id)}>Logs</button>
            </div>
          </div>
        ))}
      </div>
      {showLogs && (
        <div className="logs-modal" onClick={closeLogs}>
          <div className="logs-content" onClick={(e) => e.stopPropagation()}>
            <div className="logs-header">
              <h3>
                Logs{" "}
                {isConnected ? (
                  <span className="status connected">Connected</span>
                ) : (
                  <span className="status disconnected">Disconnected</span>
                )}
              </h3>
              <button className="close-btn" onClick={closeLogs}>
                ×
              </button>
            </div>
            <div className="logs-body">
              {error && <div className="error-message">{error}</div>}
              <pre>
                {logs.map((log, index) => (
                  <div
                    key={index}
                    className="log-line"
                    dangerouslySetInnerHTML={{ __html: log }}
                  />
                ))}
                <div ref={logsEndRef} />
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StackDetail;
