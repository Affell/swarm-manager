import { useState, useEffect, useRef, useCallback } from 'react';
import Convert from 'ansi-to-html';

// Créer un convertisseur ANSI vers HTML qui préserve les couleurs
const convert = new Convert({
  fg: '#000',
  bg: '#FFF',
  newline: true,
  escapeXML: true,
  stream: true
});

/**
 * Décode les données binaires provenant du WebSocket (logs Docker)
 * @param data Données binaires (ArrayBuffer)
 * @returns Chaîne de caractères décodée
 */
function decodeBinaryData(data: ArrayBuffer): string {
  // Essai de décodage en UTF-8
  try {
    // Utiliser TextDecoder avec l'option 'fatal: false' pour remplacer les caractères invalides
    const decoder = new TextDecoder('utf-8', { fatal: false });
    return decoder.decode(data);
  } catch (error) {
    // En cas d'échec, retomber sur une approche plus basique
    return Array.from(new Uint8Array(data))
      .map(byte => String.fromCharCode(byte))
      .join('');
  }
}

/**
 * Hook pour se connecter au WebSocket et recevoir les logs d'un service en temps réel
 * @param serviceId ID du service Docker
 * @returns Un objet contenant les logs, l'état de la connexion et une fonction pour nettoyer les logs
 */
export function useServiceLogs(serviceId: string | null) {
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Fonction pour nettoyer les logs
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  useEffect(() => {
    // Si pas d'ID de service, ne rien faire
    if (!serviceId) {
      setIsConnected(false);
      return;
    }

    // Nettoyer les logs à chaque changement d'ID de service
    clearLogs();
    
    // Créer une connexion WebSocket
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const wsUrl = `${wsProtocol}//${wsHost}/api/services/${serviceId}/logs`;
    
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer'; // Spécifier que nous attendons des données binaires
    wsRef.current = ws;

    // Gérer les événements WebSocket
    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    ws.onmessage = (event) => {
      // Traiter les données binaires
      if (event.data instanceof ArrayBuffer) {
        // Décodage des données binaires
        const textData = decodeBinaryData(event.data);
        
        // Convertir les codes ANSI en HTML
        try {
          const htmlData = convert.toHtml(textData);
          setLogs((prevLogs) => [...prevLogs, htmlData]);
        } catch (error) {
          // En cas d'échec de la conversion, afficher le texte brut
          setLogs((prevLogs) => [...prevLogs, textData]);
        }
      } else {
        // Message texte standard
        const logMessage = event.data;
        setLogs((prevLogs) => [...prevLogs, logMessage]);
      }
    };

    ws.onerror = () => {
      setError('WebSocket error occurred');
      setIsConnected(false);
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    // Nettoyage lors du démontage du composant
    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      wsRef.current = null;
    };
  }, [serviceId, clearLogs]);

  // Fonction pour reconnecter manuellement
  const reconnect = useCallback(() => {
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN || 
          wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
    
    if (serviceId) {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.host;
      const wsUrl = `${wsProtocol}//${wsHost}/api/services/${serviceId}/logs`;
      
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer'; // Spécifier que nous attendons des données binaires
      wsRef.current = ws;
      
      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
      };
      
      ws.onmessage = (event) => {
        // Traiter les données binaires
        if (event.data instanceof ArrayBuffer) {
          // Décodage des données binaires
          const textData = decodeBinaryData(event.data);
          
          // Convertir les codes ANSI en HTML
          try {
            const htmlData = convert.toHtml(textData);
            setLogs((prevLogs) => [...prevLogs, htmlData]);
          } catch (error) {
            // En cas d'échec de la conversion, afficher le texte brut
            setLogs((prevLogs) => [...prevLogs, textData]);
          }
        } else {
          // Message texte standard
          const logMessage = event.data;
          setLogs((prevLogs) => [...prevLogs, logMessage]);
        }
      };
      
      ws.onerror = () => {
        setError('WebSocket error occurred');
        setIsConnected(false);
      };
      
      ws.onclose = () => {
        setIsConnected(false);
      };
    }
  }, [serviceId]);

  return { logs, isConnected, error, clearLogs, reconnect };
}