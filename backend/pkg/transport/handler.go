package transport

import (
	"context"
	"net/http"

	dockerTypes "github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/client"
	"github.com/labstack/echo/v4"

	"github.com/axell/Coloc3G/swarm-manager/backend/pkg/domain"
)

type Handler struct {
	dockerClient *client.Client
}

func NewHandler(dc *client.Client) *Handler {
	return &Handler{dockerClient: dc}
}

func (h *Handler) ListNodes(c echo.Context) error {
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
			CurrentCount: uint64(s.ServiceStatus.RunningTasks),
		}

		// Vérifier si le service est en mode Replicated et a des réplicas définies
		if s.Spec.Mode.Replicated != nil && s.Spec.Mode.Replicated.Replicas != nil {
			svc.DesiredCount = *s.Spec.Mode.Replicated.Replicas
		} else if s.Spec.Mode.Global != nil {
			// Pour les services en mode global, on ne peut pas spécifier un nombre de réplicas
			// donc on met la valeur désirée égale au nombre actuel de tâches en cours d'exécution
			svc.DesiredCount = uint64(s.ServiceStatus.RunningTasks)
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
			CurrentCount: uint64(s.ServiceStatus.RunningTasks),
		}

		// Vérifier si le service est en mode Replicated et a des réplicas définies
		if s.Spec.Mode.Replicated != nil && s.Spec.Mode.Replicated.Replicas != nil {
			svc.DesiredCount = *s.Spec.Mode.Replicated.Replicas
		} else if s.Spec.Mode.Global != nil {
			// Pour les services en mode global, on ne peut pas spécifier un nombre de réplicas
			// donc on met la valeur désirée égale au nombre actuel de tâches en cours d'exécution
			svc.DesiredCount = uint64(s.ServiceStatus.RunningTasks)
		}

		result = append(result, svc)
	}

	return c.JSON(http.StatusOK, result)
}

func (h *Handler) StopStack(c echo.Context) error {
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
	id := c.Param("id")
	_, err := h.dockerClient.ImageRemove(context.Background(), id, image.RemoveOptions{Force: true, PruneChildren: true})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) StopService(c echo.Context) error {
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
	id := c.Param("id")
	reader, err := h.dockerClient.ServiceLogs(context.Background(), id, container.LogsOptions{ShowStdout: true, ShowStderr: true, Follow: true})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	defer reader.Close()
	return c.Stream(http.StatusOK, "text/plain; charset=utf-8", reader)
}

func (h *Handler) DrainNode(c echo.Context) error {
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
