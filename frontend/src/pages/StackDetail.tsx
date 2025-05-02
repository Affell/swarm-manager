import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getStack,
  stopService,
  restartService,
  serviceLogs,
} from "../services/api";
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
  const [logs, setLogs] = useState<string>("");
  const [showLogs, setShowLogs] = useState<string | null>(null);

  const viewLogs = async (id: string) => {
    const log = await serviceLogs(id);
    setLogs(log);
    setShowLogs(id);
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
        <div className="logs-modal" onClick={() => setShowLogs(null)}>
          <pre className="logs-content">{logs}</pre>
        </div>
      )}
    </div>
  );
};

export default StackDetail;
