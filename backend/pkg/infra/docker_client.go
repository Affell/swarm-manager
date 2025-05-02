package infra

import "github.com/docker/docker/client"

// NewDockerClient instantiates a Docker API client using environment variables and API version negotiation.
func NewDockerClient() (*client.Client, error) {
	return client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
}
