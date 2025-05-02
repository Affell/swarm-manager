import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listNodes,
  listStacks,
  drainNode,
  activateNode,
  stopStack,
  startStack,
} from "../services/api";
import { useNavigate } from "react-router-dom";
import type { Node, Stack } from "../services/api";
import "./Dashboard.css";

const Dashboard: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: nodes } = useQuery<Node[]>({
    queryKey: ["nodes"],
    queryFn: listNodes,
  });
  const { data: stacks } = useQuery<Stack[]>({
    queryKey: ["stacks"],
    queryFn: listStacks,
  });

  const drainMutation = useMutation({
    mutationFn: drainNode,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["nodes"] }),
  });
  const activateMutation = useMutation({
    mutationFn: activateNode,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["nodes"] }),
  });
  const stopStackMutation = useMutation({
    mutationFn: stopStack,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stacks"] }),
  });
  const startStackMutation = useMutation({
    mutationFn: startStack,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stacks"] }),
  });

  return (
    <div className="dashboard">
      <section className="nodes-section">
        <h2>Nodes</h2>
        <div className="cards">
          {nodes?.map((node) => (
            <div key={node.id} className="card node-card">
              <h3>{node.hostname}</h3>
              <p>
                Status:{" "}
                <span
                  className={`status-dot ${node.status.toLowerCase()}`}
                ></span>{" "}
                {node.status}
              </p>
              {node.status === "ready" ? (
                <button onClick={() => drainMutation.mutate(node.id)}>
                  Drain
                </button>
              ) : (
                <button onClick={() => activateMutation.mutate(node.id)}>
                  Activate
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="stacks-section">
        <h2>Stacks</h2>
        <div className="cards">
          {stacks?.map((stack) => (
            <div
              key={stack.name}
              className="card stack-card"
              onClick={() => navigate(`stacks/${stack.name}`)}
            >
              <h3>{stack.name}</h3>
              <p>Services: {stack.services.length}</p>
              <div className="services-status">
                {stack.services.map((s) => (
                  <span
                    key={s.id}
                    className={`status-dot ${
                      s.current_count < s.desired_count ? "warning" : "healthy"
                    }`}
                  ></span>
                ))}
              </div>
              <div className="actions">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    stopStackMutation.mutate(stack.name);
                  }}
                >
                  Stop
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startStackMutation.mutate(stack.name);
                  }}
                >
                  Start
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
