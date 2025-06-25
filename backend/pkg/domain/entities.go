package domain

// Node represents a Docker Swarm node
type Node struct {
	ID           string `json:"id"`
	Hostname     string `json:"hostname"`
	Status       string `json:"status"`
	Availability string `json:"availability"`
	Role         string `json:"role"`
	CPU          string `json:"cpu"`
	Memory       string `json:"memory"`
	IPAddress    string `json:"ipAddress"`
}

// Service represents a Docker Swarm service
type Service struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Image        string `json:"image"`
	DesiredCount uint64 `json:"desired_count"`
	CurrentCount uint64 `json:"current_count"`
}

// Stack groups services under a namespace
type Stack struct {
	Name     string    `json:"name"`
	Services []Service `json:"services"`
}

// Image represents a Docker image on the host
type Image struct {
	ID       string   `json:"id"`
	RepoTags []string `json:"repo_tags"`
	Size     int64    `json:"size"`
}
