import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  pruneImages,
  pruneContainers,
  pruneVolumes,
  pruneNetworks,
  pruneSystem,
  PruneResult,
} from "../services/api";
import "./Cleanup.css";

const bytesToSize = (bytes: number): string => {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "0 Byte";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
};

const Cleanup: React.FC = () => {
  const queryClient = useQueryClient();
  const [lastResult, setLastResult] = useState<PruneResult | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  // Mutations pour les différentes opérations de nettoyage
  const imagesMutation = useMutation({
    mutationFn: pruneImages,
    onMutate: () => setLoading("images"),
    onSuccess: (data) => {
      setLastResult(data);
      setLoading(null);
      queryClient.invalidateQueries({ queryKey: ["images"] });
    },
    onError: () => setLoading(null),
  });

  const containersMutation = useMutation({
    mutationFn: pruneContainers,
    onMutate: () => setLoading("containers"),
    onSuccess: (data) => {
      setLastResult(data);
      setLoading(null);
      queryClient.invalidateQueries({ queryKey: ["stacks"] });
    },
    onError: () => setLoading(null),
  });

  const volumesMutation = useMutation({
    mutationFn: pruneVolumes,
    onMutate: () => setLoading("volumes"),
    onSuccess: (data) => {
      setLastResult(data);
      setLoading(null);
    },
    onError: () => setLoading(null),
  });

  const networksMutation = useMutation({
    mutationFn: pruneNetworks,
    onMutate: () => setLoading("networks"),
    onSuccess: (data) => {
      setLastResult(data);
      setLoading(null);
    },
    onError: () => setLoading(null),
  });

  const systemMutation = useMutation({
    mutationFn: () => pruneSystem(false),
    onMutate: () => setLoading("system"),
    onSuccess: (data) => {
      setLastResult(data);
      setLoading(null);
      queryClient.invalidateQueries({ queryKey: ["images"] });
      queryClient.invalidateQueries({ queryKey: ["stacks"] });
    },
    onError: () => setLoading(null),
  });

  const systemAllMutation = useMutation({
    mutationFn: () => pruneSystem(true),
    onMutate: () => setLoading("system-all"),
    onSuccess: (data) => {
      setLastResult(data);
      setLoading(null);
      queryClient.invalidateQueries({ queryKey: ["images"] });
      queryClient.invalidateQueries({ queryKey: ["stacks"] });
    },
    onError: () => setLoading(null),
  });

  return (
    <div className="cleanup-page">
      <h2>Nettoyage du système</h2>
      <p className="intro">
        Utilisez ces outils pour nettoyer les ressources Docker non utilisées et
        libérer de l'espace disque.
      </p>

      <div className="cleanup-grid">
        <div className="cleanup-card">
          <h3>Images</h3>
          <p>Supprimer toutes les images non utilisées (dangling).</p>
          <button
            onClick={() => imagesMutation.mutate()}
            disabled={loading !== null}
            className={loading === "images" ? "loading" : ""}
          >
            {loading === "images" ? "Nettoyage..." : "Nettoyer les images"}
          </button>
        </div>

        <div className="cleanup-card">
          <h3>Conteneurs</h3>
          <p>Supprimer tous les conteneurs arrêtés.</p>
          <button
            onClick={() => containersMutation.mutate()}
            disabled={loading !== null}
            className={loading === "containers" ? "loading" : ""}
          >
            {loading === "containers"
              ? "Nettoyage..."
              : "Nettoyer les conteneurs"}
          </button>
        </div>

        <div className="cleanup-card">
          <h3>Volumes</h3>
          <p>Supprimer tous les volumes non utilisés.</p>
          <button
            onClick={() => volumesMutation.mutate()}
            disabled={loading !== null}
            className={loading === "volumes" ? "loading" : ""}
          >
            {loading === "volumes" ? "Nettoyage..." : "Nettoyer les volumes"}
          </button>
        </div>

        <div className="cleanup-card">
          <h3>Réseaux</h3>
          <p>Supprimer tous les réseaux non utilisés.</p>
          <button
            onClick={() => networksMutation.mutate()}
            disabled={loading !== null}
            className={loading === "networks" ? "loading" : ""}
          >
            {loading === "networks" ? "Nettoyage..." : "Nettoyer les réseaux"}
          </button>
        </div>
      </div>

      <div className="system-cleanup">
        <h3>Nettoyage système</h3>
        <div className="system-buttons">
          <div>
            <p>
              Nettoie les conteneurs arrêtés, réseaux non utilisés, et images
              dangling.
            </p>
            <button
              onClick={() => systemMutation.mutate()}
              disabled={loading !== null}
              className={`system ${loading === "system" ? "loading" : ""}`}
            >
              {loading === "system"
                ? "Nettoyage..."
                : "Nettoyage système standard"}
            </button>
          </div>
          <div>
            <p>
              Nettoie comme ci-dessus et supprime aussi les volumes non
              utilisés.
            </p>
            <button
              onClick={() => systemAllMutation.mutate()}
              disabled={loading !== null}
              className={`system-all ${
                loading === "system-all" ? "loading" : ""
              }`}
            >
              {loading === "system-all"
                ? "Nettoyage..."
                : "Nettoyage système complet"}
            </button>
          </div>
        </div>
      </div>

      {lastResult && (
        <div className="result-card">
          <h3>Résultat du dernier nettoyage</h3>
          <div className="result-details">
            {lastResult.spaceReclaimed !== undefined && (
              <p>
                Espace libéré:{" "}
                <strong>{bytesToSize(lastResult.spaceReclaimed)}</strong>
              </p>
            )}
            {lastResult.imagesDeleted !== undefined && (
              <p>
                Images supprimées: <strong>{lastResult.imagesDeleted}</strong>
              </p>
            )}
            {lastResult.containersDeleted !== undefined && (
              <p>
                Conteneurs supprimés:{" "}
                <strong>{lastResult.containersDeleted}</strong>
              </p>
            )}
            {lastResult.volumesDeleted !== undefined && (
              <p>
                Volumes supprimés: <strong>{lastResult.volumesDeleted}</strong>
              </p>
            )}
            {lastResult.networksDeleted !== undefined && (
              <p>
                Réseaux supprimés: <strong>{lastResult.networksDeleted}</strong>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Cleanup;
