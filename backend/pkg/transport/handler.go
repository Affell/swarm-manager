package transport

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"time"

	dockerTypes "github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/client"
	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"

	"github.com/axell/Coloc3G/swarm-manager/backend/pkg/domain"
)

// Configurez l'upgrader WebSocket
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Autoriser toutes les origines en développement (à configurer pour la production)
	},
}

type Handler struct {
	dockerClient *client.Client
}

func NewHandler(dc *client.Client) *Handler {
	return &Handler{dockerClient: dc}
}

func (h *Handler) ListNodes(c echo.Context) error {
	// Vérifier que le client Docker est initialisé
	if h == nil || h.dockerClient == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Docker client not initialized"})
	}

	nodes, err := h.dockerClient.NodeList(context.Background(), dockerTypes.NodeListOptions{})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	var result []domain.Node
	for _, n := range nodes {
		result = append(result, domain.Node{
			ID:       n.ID,
			Hostname: n.Description.Hostname,
			Status:   string(n.Status.State),
		})
	}
	return c.JSON(http.StatusOK, result)
}

func (h *Handler) ListStacks(c echo.Context) error {
	// Vérifier que le client Docker est initialisé
	if h == nil || h.dockerClient == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Docker client not initialized"})
	}

	services, err := h.dockerClient.ServiceList(context.Background(), dockerTypes.ServiceListOptions{})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	stacksMap := make(map[string][]domain.Service)

	for _, s := range services {
		// Vérifier si le service a l'étiquette de stack et l'ignorer sinon
		stackName, exists := s.Spec.Labels["com.docker.stack.namespace"]
		if !exists || stackName == "" {
			// Service sans étiquette stack, le mettre dans "unassigned"
			stackName = "unassigned"
		}

		// Préparer les données du service avec des vérifications de sécurité
		svc := domain.Service{
			ID:           s.ID,
			Name:         s.Spec.Name,
			Image:        s.Spec.TaskTemplate.ContainerSpec.Image,
			DesiredCount: 0,
			CurrentCount: 0, // Par défaut à 0
		}

		// Récupérer le nombre de tâches en cours si ServiceStatus n'est pas nil
		if s.ServiceStatus != nil {
			svc.CurrentCount = uint64(s.ServiceStatus.RunningTasks)
		}

		// Vérifier si le service est en mode Replicated et a des réplicas définies
		if s.Spec.Mode.Replicated != nil && s.Spec.Mode.Replicated.Replicas != nil {
			svc.DesiredCount = *s.Spec.Mode.Replicated.Replicas
		} else if s.Spec.Mode.Global != nil {
			// Pour les services en mode global, on utilise le nombre actuel comme nombre désiré
			// mais seulement si ServiceStatus n'est pas nil
			if s.ServiceStatus != nil {
				svc.DesiredCount = uint64(s.ServiceStatus.RunningTasks)
			}
		}

		stacksMap[stackName] = append(stacksMap[stackName], svc)
	}

	var stacks []domain.Stack
	for name, svcs := range stacksMap {
		stacks = append(stacks, domain.Stack{Name: name, Services: svcs})
	}

	return c.JSON(http.StatusOK, stacks)
}

func (h *Handler) GetStack(c echo.Context) error {
	// Vérifier que le client Docker est initialisé
	if h == nil || h.dockerClient == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Docker client not initialized"})
	}

	name := c.Param("name")
	f := filters.NewArgs()
	f.Add("label", "com.docker.stack.namespace="+name)
	services, err := h.dockerClient.ServiceList(context.Background(), dockerTypes.ServiceListOptions{Filters: f})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	var result []domain.Service
	for _, s := range services {
		// Préparer les données du service avec des vérifications de sécurité
		svc := domain.Service{
			ID:           s.ID,
			Name:         s.Spec.Name,
			Image:        s.Spec.TaskTemplate.ContainerSpec.Image,
			DesiredCount: 0,
			CurrentCount: 0, // Par défaut à 0
		}

		// Récupérer le nombre de tâches en cours si ServiceStatus n'est pas nil
		if s.ServiceStatus != nil {
			svc.CurrentCount = uint64(s.ServiceStatus.RunningTasks)
		}

		// Vérifier si le service est en mode Replicated et a des réplicas définies
		if s.Spec.Mode.Replicated != nil && s.Spec.Mode.Replicated.Replicas != nil {
			svc.DesiredCount = *s.Spec.Mode.Replicated.Replicas
		} else if s.Spec.Mode.Global != nil {
			// Pour les services en mode global, on utilise le nombre actuel comme nombre désiré
			// mais seulement si ServiceStatus n'est pas nil
			if s.ServiceStatus != nil {
				svc.DesiredCount = uint64(s.ServiceStatus.RunningTasks)
			}
		}

		result = append(result, svc)
	}

	return c.JSON(http.StatusOK, result)
}

func (h *Handler) StopStack(c echo.Context) error {
	// Vérifier que le client Docker est initialisé
	if h == nil || h.dockerClient == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Docker client not initialized"})
	}

	name := c.Param("name")
	f := filters.NewArgs()
	f.Add("label", "com.docker.stack.namespace="+name)
	services, err := h.dockerClient.ServiceList(context.Background(), dockerTypes.ServiceListOptions{Filters: f})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	for _, s := range services {
		spec := s.Spec
		if spec.Mode.Replicated != nil {
			zero := uint64(0)
			spec.Mode.Replicated.Replicas = &zero
			_, err = h.dockerClient.ServiceUpdate(context.Background(), s.ID, s.Version, spec, dockerTypes.ServiceUpdateOptions{})
			if err != nil {
				return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}
		}
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) StartStack(c echo.Context) error {
	// Vérifier que le client Docker est initialisé
	if h == nil || h.dockerClient == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Docker client not initialized"})
	}

	name := c.Param("name")
	f := filters.NewArgs()
	f.Add("label", "com.docker.stack.namespace="+name)
	services, err := h.dockerClient.ServiceList(context.Background(), dockerTypes.ServiceListOptions{Filters: f})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	for _, s := range services {
		spec := s.Spec
		if spec.Mode.Replicated != nil {
			// replicas already set to desired count in spec
			_, err = h.dockerClient.ServiceUpdate(context.Background(), s.ID, s.Version, spec, dockerTypes.ServiceUpdateOptions{})
			if err != nil {
				return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
			}
		}
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) ListImages(c echo.Context) error {
	// Vérifier que le client Docker est initialisé
	if h == nil || h.dockerClient == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Docker client not initialized"})
	}

	images, err := h.dockerClient.ImageList(context.Background(), image.ListOptions{All: true})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	var result []domain.Image
	for _, img := range images {
		result = append(result, domain.Image{
			ID:       img.ID,
			RepoTags: img.RepoTags,
			Size:     img.Size,
		})
	}
	return c.JSON(http.StatusOK, result)
}

func (h *Handler) RemoveImage(c echo.Context) error {
	// Vérifier que le client Docker est initialisé
	if h == nil || h.dockerClient == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Docker client not initialized"})
	}

	id := c.Param("id")
	_, err := h.dockerClient.ImageRemove(context.Background(), id, image.RemoveOptions{Force: true, PruneChildren: true})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) StopService(c echo.Context) error {
	// Vérifier que le client Docker est initialisé
	if h == nil || h.dockerClient == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Docker client not initialized"})
	}

	id := c.Param("id")
	svc, _, err := h.dockerClient.ServiceInspectWithRaw(context.Background(), id, dockerTypes.ServiceInspectOptions{})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	spec := svc.Spec
	if spec.Mode.Replicated != nil {
		zero := uint64(0)
		spec.Mode.Replicated.Replicas = &zero
	}
	_, err = h.dockerClient.ServiceUpdate(context.Background(), id, svc.Version, spec, dockerTypes.ServiceUpdateOptions{})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) RestartService(c echo.Context) error {
	// Vérifier que le client Docker est initialisé
	if h == nil || h.dockerClient == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Docker client not initialized"})
	}

	id := c.Param("id")
	svc, _, err := h.dockerClient.ServiceInspectWithRaw(context.Background(), id, dockerTypes.ServiceInspectOptions{})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	spec := svc.Spec
	spec.TaskTemplate.ForceUpdate++
	_, err = h.dockerClient.ServiceUpdate(context.Background(), id, svc.Version, spec, dockerTypes.ServiceUpdateOptions{})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) ServiceLogs(c echo.Context) error {
	// Vérifier que le client Docker est initialisé
	if h == nil || h.dockerClient == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Docker client not initialized"})
	}

	// Upgrade HTTP connection to WebSocket
	ws, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Could not upgrade to WebSocket: " + err.Error()})
	}
	defer ws.Close()

	id := c.Param("id")

	// Configuration des options de logs Docker
	opts := container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     true,
		Timestamps: true,
	}

	// Obtenir le reader de logs
	reader, err := h.dockerClient.ServiceLogs(context.Background(), id, opts)
	if err != nil {
		ws.WriteMessage(websocket.TextMessage, []byte("Error: "+err.Error()))
		return nil
	}
	defer reader.Close()

	// Canal pour signaler la fermeture de la connexion
	done := make(chan struct{})

	// Gérer les messages entrants du client (fermeture de connexion)
	go func() {
		defer close(done)
		for {
			_, _, err := ws.ReadMessage()
			if err != nil {
				// Client a fermé la connexion ou erreur de lecture
				return
			}
		}
	}()

	// Utiliser un buffer pour traiter les données binaires de Docker
	buffer := make([]byte, 8192)               // Buffer de taille raisonnable pour la lecture
	ticker := time.NewTicker(30 * time.Second) // Heartbeat pour maintenir la connexion
	defer ticker.Stop()

	for {
		select {
		case <-done:
			// Client a fermé la connexion
			return nil
		case <-ticker.C:
			// Envoyer un heartbeat
			if err := ws.WriteMessage(websocket.PingMessage, []byte{}); err != nil {
				return nil
			}
		default:
			// Lire à partir du flux de logs
			n, err := reader.Read(buffer)
			if n > 0 {
				// Envoyer uniquement les octets lus au client
				// Utiliser BinaryMessage pour éviter les problèmes d'encodage UTF-8
				if err := ws.WriteMessage(websocket.BinaryMessage, buffer[:n]); err != nil {
					return nil
				}
			}
			if err != nil {
				if err == io.EOF {
					// Fin normale du flux
					time.Sleep(100 * time.Millisecond)
					continue
				}
				// Erreur de lecture
				errMsg := fmt.Sprintf("Error reading logs: %s", err.Error())
				ws.WriteMessage(websocket.TextMessage, []byte(errMsg))
				return nil
			}
		}
	}
}

func (h *Handler) DrainNode(c echo.Context) error {
	// Vérifier que le client Docker est initialisé
	if h == nil || h.dockerClient == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Docker client not initialized"})
	}

	id := c.Param("id")
	node, _, err := h.dockerClient.NodeInspectWithRaw(context.Background(), id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	spec := node.Spec
	spec.Availability = swarm.NodeAvailabilityDrain
	err = h.dockerClient.NodeUpdate(context.Background(), id, node.Version, spec)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) ActivateNode(c echo.Context) error {
	// Vérifier que le client Docker est initialisé
	if h == nil || h.dockerClient == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Docker client not initialized"})
	}

	id := c.Param("id")
	node, _, err := h.dockerClient.NodeInspectWithRaw(context.Background(), id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	spec := node.Spec
	spec.Availability = swarm.NodeAvailabilityActive
	err = h.dockerClient.NodeUpdate(context.Background(), id, node.Version, spec)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) GetVersion(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]string{
		"version": "1.0.0", // Vous pouvez ajuster cette version selon vos besoins
	})
}

// PruneImages supprime toutes les images non utilisées
func (h *Handler) PruneImages(c echo.Context) error {
	// Vérifier que le client Docker est initialisé
	if h == nil || h.dockerClient == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Docker client not initialized"})
	}

	report, err := h.dockerClient.ImagesPrune(context.Background(), filters.NewArgs())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	response := map[string]interface{}{
		"imagesDeleted":  len(report.ImagesDeleted),
		"spaceReclaimed": report.SpaceReclaimed,
	}

	return c.JSON(http.StatusOK, response)
}

// PruneContainers supprime tous les conteneurs arrêtés
func (h *Handler) PruneContainers(c echo.Context) error {
	// Vérifier que le client Docker est initialisé
	if h == nil || h.dockerClient == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Docker client not initialized"})
	}

	report, err := h.dockerClient.ContainersPrune(context.Background(), filters.NewArgs())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	response := map[string]interface{}{
		"containersDeleted": len(report.ContainersDeleted),
		"spaceReclaimed":    report.SpaceReclaimed,
	}

	return c.JSON(http.StatusOK, response)
}

// PruneVolumes supprime tous les volumes non utilisés
func (h *Handler) PruneVolumes(c echo.Context) error {
	// Vérifier que le client Docker est initialisé
	if h == nil || h.dockerClient == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Docker client not initialized"})
	}

	report, err := h.dockerClient.VolumesPrune(context.Background(), filters.NewArgs())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	response := map[string]interface{}{
		"volumesDeleted": len(report.VolumesDeleted),
		"spaceReclaimed": report.SpaceReclaimed,
	}

	return c.JSON(http.StatusOK, response)
}

// PruneNetworks supprime tous les réseaux non utilisés
func (h *Handler) PruneNetworks(c echo.Context) error {
	// Vérifier que le client Docker est initialisé
	if h == nil || h.dockerClient == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Docker client not initialized"})
	}

	report, err := h.dockerClient.NetworksPrune(context.Background(), filters.NewArgs())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	response := map[string]interface{}{
		"networksDeleted": len(report.NetworksDeleted),
	}

	return c.JSON(http.StatusOK, response)
}

// PruneSystem effectue un nettoyage complet du système
func (h *Handler) PruneSystem(c echo.Context) error {
	// Vérifier que le client Docker est initialisé
	if h == nil || h.dockerClient == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Docker client not initialized"})
	}

	// Obtenir le paramètre all (supprimer aussi les images non utilisées)
	all := c.QueryParam("all") == "true"

	// Créer une structure pour collecter toutes les informations
	type SystemPruneReport struct {
		ContainersDeleted []string
		NetworksDeleted   []string
		VolumesDeleted    []string
		SpaceReclaimed    uint64
	}

	report := SystemPruneReport{}

	// Nettoyer les conteneurs
	containerReport, err := h.dockerClient.ContainersPrune(context.Background(), filters.NewArgs())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Error pruning containers: " + err.Error()})
	}
	report.ContainersDeleted = containerReport.ContainersDeleted
	report.SpaceReclaimed += containerReport.SpaceReclaimed

	// Nettoyer les réseaux
	networkReport, err := h.dockerClient.NetworksPrune(context.Background(), filters.NewArgs())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Error pruning networks: " + err.Error()})
	}
	report.NetworksDeleted = networkReport.NetworksDeleted

	// Nettoyer les images si all=true
	if all {
		imageReport, err := h.dockerClient.ImagesPrune(context.Background(), filters.NewArgs())
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Error pruning images: " + err.Error()})
		}
		// Ajouter uniquement l'espace récupéré, car les images supprimées sont des structures différentes
		report.SpaceReclaimed += imageReport.SpaceReclaimed

		// Nettoyer les volumes
		volumeReport, err := h.dockerClient.VolumesPrune(context.Background(), filters.NewArgs())
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Error pruning volumes: " + err.Error()})
		}
		report.VolumesDeleted = volumeReport.VolumesDeleted
		report.SpaceReclaimed += volumeReport.SpaceReclaimed
	}

	response := map[string]interface{}{
		"containersDeleted": len(report.ContainersDeleted),
		"networksDeleted":   len(report.NetworksDeleted),
		"spaceReclaimed":    report.SpaceReclaimed,
	}

	if all {
		response["volumesDeleted"] = len(report.VolumesDeleted)
	}

	return c.JSON(http.StatusOK, response)
}
