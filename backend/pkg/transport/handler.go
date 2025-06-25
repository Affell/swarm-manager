package transport

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	dockerTypes "github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/api/types/system"
	"github.com/docker/docker/api/types/volume"
	"github.com/docker/docker/client"
	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"

	"github.com/Affell/swarm-manager/backend/pkg/domain"
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
		// Extraire le rôle du nœud
		role := "Worker"
		if n.Spec.Role == swarm.NodeRoleManager {
			role = "Manager"
		}

		// Extraire les informations CPU et Memory
		cpu := "Unknown"
		memory := "Unknown"
		if n.Description.Resources.NanoCPUs > 0 {
			cpuCores := float64(n.Description.Resources.NanoCPUs) / 1e9
			cpu = fmt.Sprintf("%.1f cores", cpuCores)
		}
		if n.Description.Resources.MemoryBytes > 0 {
			memoryGB := float64(n.Description.Resources.MemoryBytes) / (1024 * 1024 * 1024)
			memory = fmt.Sprintf("%.1f GB", memoryGB)
		}

		// Extraire l'adresse IP
		ipAddress := "Unknown"
		if n.Status.Addr != "" {
			ipAddress = n.Status.Addr
		}

		result = append(result, domain.Node{
			ID:           n.ID,
			Hostname:     n.Description.Hostname,
			Status:       string(n.Status.State),
			Availability: string(n.Spec.Availability),
			Role:         role,
			CPU:          cpu,
			Memory:       memory,
			IPAddress:    ipAddress,
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

		// Récupérer le nombre de tâches en cours en utilisant TaskList
		taskFilter := filters.NewArgs()
		taskFilter.Add("service", s.ID)
		taskFilter.Add("desired-state", "running") // Seulement les tâches en cours d'exécution
		tasks, err := h.dockerClient.TaskList(context.Background(), dockerTypes.TaskListOptions{Filters: taskFilter})
		if err == nil {
			// Compter les tâches qui sont effectivement en cours d'exécution
			runningTasks := 0
			for _, task := range tasks {
				if task.Status.State == swarm.TaskState("running") {
					runningTasks++
				}
			}
			svc.CurrentCount = uint64(runningTasks)
		}

		// Vérifier si le service est en mode Replicated et a des réplicas définies
		if s.Spec.Mode.Replicated != nil && s.Spec.Mode.Replicated.Replicas != nil {
			svc.DesiredCount = *s.Spec.Mode.Replicated.Replicas
		} else if s.Spec.Mode.Global != nil {
			// Pour les services en mode global, on utilise le nombre actuel comme nombre désiré
			svc.DesiredCount = svc.CurrentCount
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

		// Récupérer le nombre de tâches en cours en utilisant TaskList
		taskFilter := filters.NewArgs()
		taskFilter.Add("service", s.ID)
		taskFilter.Add("desired-state", "running") // Seulement les tâches en cours d'exécution
		tasks, err := h.dockerClient.TaskList(context.Background(), dockerTypes.TaskListOptions{Filters: taskFilter})
		if err == nil {
			// Compter les tâches qui sont effectivement en cours d'exécution
			runningTasks := 0
			for _, task := range tasks {
				if task.Status.State == swarm.TaskState("running") {
					runningTasks++
				}
			}
			svc.CurrentCount = uint64(runningTasks)
		}

		// Vérifier si le service est en mode Replicated et a des réplicas définies
		if s.Spec.Mode.Replicated != nil && s.Spec.Mode.Replicated.Replicas != nil {
			svc.DesiredCount = *s.Spec.Mode.Replicated.Replicas
		} else if s.Spec.Mode.Global != nil {
			// Pour les services en mode global, on utilise le nombre actuel comme nombre désiré
			svc.DesiredCount = svc.CurrentCount
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
				// Convertir les données binaires en string et diviser par lignes
				logData := string(buffer[:n])
				lines := strings.SplitSeq(logData, "\n")

				for line := range lines {
					// Ignorer les lignes vides
					if strings.TrimSpace(line) == "" {
						continue
					}

					// Enlever les 8 premiers octets de chaque ligne
					if len(line) > 8 {
						line = line[8:]
					}

					// Nettoyer et envoyer ligne par ligne
					cleanLine := strings.TrimSpace(line)
					if cleanLine != "" {
						formattedLog := cleanLine + "\n"
						cleanMsg := strings.ToValidUTF8(formattedLog, "")
						if err := ws.WriteMessage(websocket.TextMessage, []byte(cleanMsg)); err != nil {
							return nil
						}
					}
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

// GetCleanupEstimate retourne une estimation de l'espace qui peut être libéré
func (h *Handler) GetCleanupEstimate(c echo.Context) error {
	if h == nil || h.dockerClient == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Docker client not initialized"})
	}

	type CleanupEstimate struct {
		UnusedImages      int64 `json:"unused_images"`
		StoppedContainers int64 `json:"stopped_containers"`
		UnusedNetworks    int64 `json:"unused_networks"`
		UnusedVolumes     int64 `json:"unused_volumes"`
		TotalEstimate     int64 `json:"total_estimate"`
	}

	estimate := CleanupEstimate{}

	// Estimer les images inutilisées
	images, err := h.dockerClient.ImageList(context.Background(), image.ListOptions{})
	if err == nil {
		for _, img := range images {
			if len(img.RepoTags) == 0 || (len(img.RepoTags) == 1 && img.RepoTags[0] == "<none>:<none>") {
				estimate.UnusedImages += img.Size
			}
		}
	}

	// Estimer les conteneurs arrêtés
	containers, err := h.dockerClient.ContainerList(context.Background(), container.ListOptions{All: true})
	if err == nil {
		for _, container := range containers {
			if container.State != "running" {
				estimate.StoppedContainers += container.SizeRw
			}
		}
	}

	// Estimer les réseaux inutilisés
	networks, err := h.dockerClient.NetworkList(context.Background(), network.ListOptions{})
	if err == nil {
		for _, network := range networks {
			// Les réseaux par défaut ne sont pas comptés
			if network.Name != "bridge" && network.Name != "host" && network.Name != "none" {
				if len(network.Containers) == 0 {
					estimate.UnusedNetworks += 1024 * 1024 // Estimation approximative
				}
			}
		}
	}

	// Estimer les volumes inutilisés
	volumes, err := h.dockerClient.VolumeList(context.Background(), volume.ListOptions{})
	if err == nil {
		for _, vol := range volumes.Volumes {
			// Vérifier si le volume est utilisé
			containers, err := h.dockerClient.ContainerList(context.Background(), container.ListOptions{All: true})
			if err == nil {
				used := false
				for _, container := range containers {
					for _, mount := range container.Mounts {
						if mount.Name == vol.Name {
							used = true
							break
						}
					}
					if used {
						break
					}
				}
				if !used {
					estimate.UnusedVolumes += 100 * 1024 * 1024 // Estimation approximative
				}
			}
		}
	}

	estimate.TotalEstimate = estimate.UnusedImages + estimate.StoppedContainers + estimate.UnusedNetworks + estimate.UnusedVolumes

	return c.JSON(http.StatusOK, estimate)
}

// GetSystemInfo retourne les informations système et l'utilisation du disque
func (h *Handler) GetSystemInfo(c echo.Context) error {
	if h == nil || h.dockerClient == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Docker client not initialized"})
	}

	type SystemInfo struct {
		DiskUsage       dockerTypes.DiskUsage `json:"disk_usage"`
		SystemInfo      system.Info           `json:"system_info"`
		ContainersCount int                   `json:"containers_count"`
		ImagesCount     int                   `json:"images_count"`
		VolumesCount    int                   `json:"volumes_count"`
		NetworksCount   int                   `json:"networks_count"`
	}

	info := SystemInfo{}

	// Obtenir l'utilisation du disque
	diskUsage, err := h.dockerClient.DiskUsage(context.Background(), dockerTypes.DiskUsageOptions{})
	if err == nil {
		info.DiskUsage = diskUsage
	}

	// Obtenir les informations système
	sysInfo, err := h.dockerClient.Info(context.Background())
	if err == nil {
		info.SystemInfo = sysInfo
	}

	// Compter les ressources
	containers, err := h.dockerClient.ContainerList(context.Background(), container.ListOptions{All: true})
	if err == nil {
		info.ContainersCount = len(containers)
	}

	images, err := h.dockerClient.ImageList(context.Background(), image.ListOptions{})
	if err == nil {
		info.ImagesCount = len(images)
	}

	volumes, err := h.dockerClient.VolumeList(context.Background(), volume.ListOptions{})
	if err == nil {
		info.VolumesCount = len(volumes.Volumes)
	}

	networks, err := h.dockerClient.NetworkList(context.Background(), network.ListOptions{})
	if err == nil {
		info.NetworksCount = len(networks)
	}

	return c.JSON(http.StatusOK, info)
}

// GetNodeServices retourne les services qui s'exécutent sur une node spécifique
func (h *Handler) GetNodeServices(c echo.Context) error {
	// Vérifier que le client Docker est initialisé
	if h == nil || h.dockerClient == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Docker client not initialized"})
	}

	nodeID := c.Param("id")

	// Récupérer tous les services
	services, err := h.dockerClient.ServiceList(context.Background(), dockerTypes.ServiceListOptions{})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	var nodeServices []domain.Service

	for _, s := range services {
		// Récupérer les tâches pour ce service
		taskFilter := filters.NewArgs()
		taskFilter.Add("service", s.ID)
		tasks, err := h.dockerClient.TaskList(context.Background(), dockerTypes.TaskListOptions{Filters: taskFilter})
		if err != nil {
			continue // Ignorer les erreurs et passer au service suivant
		}

		// Vérifier si ce service a des tâches sur cette node
		hasTaskOnNode := false
		runningTasksOnNode := 0
		for _, task := range tasks {
			if task.NodeID == nodeID {
				hasTaskOnNode = true
				if task.Status.State == swarm.TaskState("running") {
					runningTasksOnNode++
				}
			}
		}

		if hasTaskOnNode {
			// Préparer les données du service
			svc := domain.Service{
				ID:           s.ID,
				Name:         s.Spec.Name,
				Image:        s.Spec.TaskTemplate.ContainerSpec.Image,
				DesiredCount: 0,
				CurrentCount: uint64(runningTasksOnNode), // Nombre de tâches en cours sur cette node
			}

			// Déterminer le nombre désiré de réplicas
			if s.Spec.Mode.Replicated != nil && s.Spec.Mode.Replicated.Replicas != nil {
				svc.DesiredCount = *s.Spec.Mode.Replicated.Replicas
			} else if s.Spec.Mode.Global != nil {
				// Pour les services en mode global, chaque node active devrait avoir une tâche
				svc.DesiredCount = 1
			}

			nodeServices = append(nodeServices, svc)
		}
	}

	return c.JSON(http.StatusOK, nodeServices)
}

// GetService retourne les détails d'un service spécifique
func (h *Handler) GetService(c echo.Context) error {
	// Vérifier que le client Docker est initialisé
	if h == nil || h.dockerClient == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Docker client not initialized"})
	}

	serviceID := c.Param("id")

	// Récupérer les détails du service
	service, _, err := h.dockerClient.ServiceInspectWithRaw(context.Background(), serviceID, dockerTypes.ServiceInspectOptions{})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Préparer les données du service
	svc := domain.Service{
		ID:           service.ID,
		Name:         service.Spec.Name,
		Image:        service.Spec.TaskTemplate.ContainerSpec.Image,
		DesiredCount: 0,
		CurrentCount: 0,
	}

	// Récupérer le nombre de tâches en cours
	taskFilter := filters.NewArgs()
	taskFilter.Add("service", service.ID)
	taskFilter.Add("desired-state", "running")
	tasks, err := h.dockerClient.TaskList(context.Background(), dockerTypes.TaskListOptions{Filters: taskFilter})
	if err == nil {
		runningTasks := 0
		for _, task := range tasks {
			if task.Status.State == swarm.TaskState("running") {
				runningTasks++
			}
		}
		svc.CurrentCount = uint64(runningTasks)
	}

	// Déterminer le nombre désiré de réplicas
	if service.Spec.Mode.Replicated != nil && service.Spec.Mode.Replicated.Replicas != nil {
		svc.DesiredCount = *service.Spec.Mode.Replicated.Replicas
	} else if service.Spec.Mode.Global != nil {
		svc.DesiredCount = svc.CurrentCount
	}

	// Ajouter des informations détaillées sur le service
	type ServiceDetails struct {
		domain.Service
		CreatedAt    time.Time                   `json:"created_at"`
		UpdatedAt    time.Time                   `json:"updated_at"`
		Version      uint64                      `json:"version"`
		Labels       map[string]string           `json:"labels"`
		Constraints  []string                    `json:"constraints"`
		Networks     []string                    `json:"networks"`
		Ports        []swarm.PortConfig          `json:"ports"`
		Mounts       []mount.Mount               `json:"mounts"`
		Env          []string                    `json:"env"`
		UpdateConfig *swarm.UpdateConfig         `json:"update_config"`
		Resources    *swarm.ResourceRequirements `json:"resources"`
	}

	details := ServiceDetails{
		Service:   svc,
		CreatedAt: service.CreatedAt,
		UpdatedAt: service.UpdatedAt,
		Version:   service.Version.Index,
		Labels:    service.Spec.Labels,
	}

	// Contraintes de placement
	if service.Spec.TaskTemplate.Placement != nil {
		details.Constraints = service.Spec.TaskTemplate.Placement.Constraints
	}

	// Réseaux
	for _, network := range service.Spec.TaskTemplate.Networks {
		details.Networks = append(details.Networks, network.Target)
	}

	// Ports
	if service.Spec.EndpointSpec != nil {
		details.Ports = service.Spec.EndpointSpec.Ports
	}

	// Montages
	details.Mounts = service.Spec.TaskTemplate.ContainerSpec.Mounts

	// Variables d'environnement
	details.Env = service.Spec.TaskTemplate.ContainerSpec.Env

	// Configuration de mise à jour
	details.UpdateConfig = service.Spec.UpdateConfig

	// Ressources
	details.Resources = service.Spec.TaskTemplate.Resources

	return c.JSON(http.StatusOK, details)
}

// SwarmLogs fournit un flux WebSocket des logs de tous les services du swarm
func (h *Handler) SwarmLogs(c echo.Context) error {
	if h == nil || h.dockerClient == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Docker client not initialized"})
	}

	// Mise à niveau vers WebSocket
	ws, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		return err
	}
	defer ws.Close()

	// Paramètres de requête pour filtres (search est géré côté client)
	stackFilter := c.QueryParam("stack")
	serviceFilter := c.QueryParam("service")
	// searchTerm est supprimé - le filtrage de recherche se fait côté client

	// Context avec timeout
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Récupérer tous les services du swarm
	services, err := h.dockerClient.ServiceList(ctx, dockerTypes.ServiceListOptions{})
	if err != nil {
		ws.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("Error getting services: %s", err.Error())))
		return nil
	}

	// Filtrer les services selon les critères
	var filteredServices []swarm.Service
	for _, service := range services {
		serviceName := service.Spec.Name

		// Filtrer par stack si spécifié
		if stackFilter != "" {
			if stackLabel, exists := service.Spec.Labels["com.docker.stack.namespace"]; !exists || stackLabel != stackFilter {
				continue
			}
		}

		// Filtrer par service si spécifié
		if serviceFilter != "" {
			if serviceName != serviceFilter {
				continue
			}
		}

		filteredServices = append(filteredServices, service)
	}

	// Canal pour les messages WebSocket
	messages := make(chan string, 100)
	done := make(chan struct{})

	// Goroutine pour lire les messages WebSocket du client (pour gérer les déconnexions)
	go func() {
		defer close(done)
		for {
			_, _, err := ws.ReadMessage()
			if err != nil {
				return
			}
		}
	}()

	// Goroutine pour chaque service pour streamer les logs
	for _, service := range filteredServices {
		go func(svc swarm.Service) {
			serviceName := svc.Spec.Name

			// Configuration des options de logs
			opts := container.LogsOptions{
				ShowStdout: true,
				ShowStderr: true,
				Follow:     true,
				Tail:       "50", // Dernières 50 lignes
				Timestamps: true,
			}

			// Obtenir le reader de logs
			reader, err := h.dockerClient.ServiceLogs(ctx, svc.ID, opts)
			if err != nil {
				messages <- fmt.Sprintf("[ERROR] %s: Failed to get logs: %s", serviceName, err.Error())
				return
			}
			defer reader.Close()

			// Buffer pour lire les logs
			buf := make([]byte, 4096)
			for {
				select {
				case <-ctx.Done():
					return
				case <-done:
					return
				default:
					n, err := reader.Read(buf)
					if err != nil {
						if err != io.EOF {
							messages <- fmt.Sprintf("[ERROR] %s: Error reading logs: %s", serviceName, err.Error())
						}
						return
					}

					if n > 0 {
						// Convertir les données binaires en string
						logData := string(buf[:n])

						// Diviser par lignes
						lines := strings.SplitSeq(logData, "\n")
						for line := range lines {
							// Ignorer les lignes vides
							if strings.TrimSpace(line) == "" {
								continue
							}

							if len(line) > 8 {
								line = line[8:]
							}

							// Le filtrage par terme de recherche est géré côté client
							// Préfixer avec le nom du service et nettoyer
							formattedLog := fmt.Sprintf("[%s] %s\n", serviceName, strings.TrimSpace(line))

							select {
							case messages <- formattedLog:
							case <-ctx.Done():
								return
							case <-done:
								return
							default:
								// Canal plein, ignorer ce message
							}
						}
					}
				}
			}
		}(service)
	}

	// Goroutine pour envoyer les messages via WebSocket
	go func() {
		ticker := time.NewTicker(100 * time.Millisecond) // Batch messages
		defer ticker.Stop()

		var batch []string

		for {
			select {
			case msg := <-messages:
				batch = append(batch, msg)

				if len(batch) >= 10 {
					combinedMsg := ""
					for _, m := range batch {
						combinedMsg += m
					}

					cleanMsg := strings.ToValidUTF8(combinedMsg, "")
					err := ws.WriteMessage(websocket.TextMessage, []byte(cleanMsg))
					if err != nil {
						return
					}
					batch = nil
				}

			case <-ticker.C:
				if len(batch) > 0 {
					combinedMsg := ""
					for _, m := range batch {
						combinedMsg += m
					}

					cleanMsg := strings.ToValidUTF8(combinedMsg, "")
					err := ws.WriteMessage(websocket.TextMessage, []byte(cleanMsg))
					if err != nil {
						return
					}
					batch = nil
				}

			case <-done:
				return
			case <-ctx.Done():
				return
			}
		}
	}()

	// Attendre la fermeture de la connexion
	<-done
	return nil
}
