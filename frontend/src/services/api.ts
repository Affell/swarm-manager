export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://swarm.sys.affell.fr/api';
export const API_SOCKET_URL = API_BASE_URL.replace('http', 'ws');

export interface Node {
  id: string;
  hostname: string;
  status: string;
  availability: string;
  role: string;
  cpu: string;
  memory: string;
  ipAddress: string;
}

export interface Stack {
  name: string;
  services: Service[];
}

export interface Service {
  id: string;
  name: string;
  image: string;
  desired_count: number;
  current_count: number;
}

export interface Image {
  id: string;
  repo_tags: string[];
  size: number;
}

class ApiService {
  private async fetch(endpoint: string, options?: RequestInit): Promise<any> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    // Handle 204 No Content responses
    if (response.status === 204) {
      return null;
    }

    // Handle responses with JSON content
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }

    return null;
  }

  // Nodes API
  async getNodes(): Promise<Node[]> {
    return this.fetch('/nodes');
  }

  async drainNode(nodeId: string): Promise<void> {
    await this.fetch(`/nodes/${nodeId}/drain`, {
      method: 'POST',
    });
  }

  async activateNode(nodeId: string): Promise<void> {
    await this.fetch(`/nodes/${nodeId}/activate`, {
      method: 'POST',
    });
  }

  async getNodeServices(nodeId: string): Promise<Service[]> {
    return this.fetch(`/nodes/${nodeId}/services`);
  }

  // Stacks API
  async getStacks(): Promise<Stack[]> {
    return this.fetch('/stacks');
  }

  async getStack(name: string): Promise<Service[]> {
    return this.fetch(`/stacks/${name}`);
  }

  async stopStack(name: string): Promise<void> {
    await this.fetch(`/stacks/${name}/stop`, {
      method: 'POST',
    });
  }

  async startStack(name: string): Promise<void> {
    await this.fetch(`/stacks/${name}/start`, {
      method: 'POST',
    });
  }

  // Images API
  async getImages(): Promise<Image[]> {
    return this.fetch('/images');
  }

  async deleteImage(imageId: string): Promise<void> {
    await this.fetch(`/images/${imageId}`, {
      method: 'DELETE',
    });
  }

  async pruneImages(): Promise<void> {
    await this.fetch('/images/prune', {
      method: 'POST',
    });
  }

  // Services API
  async stopService(serviceId: string): Promise<void> {
    await this.fetch(`/services/${serviceId}/stop`, {
      method: 'POST',
    });
  }

  async restartService(serviceId: string): Promise<void> {
    await this.fetch(`/services/${serviceId}/restart`, {
      method: 'POST',
    });
  }

  async getService(serviceId: string): Promise<any> {
    return this.fetch(`/services/${serviceId}`);
  }

  // Cleanup Estimates API
  async getCleanupEstimate(): Promise<{
    unused_images: number;
    stopped_containers: number;
    unused_networks: number;
    unused_volumes: number;
    total_estimate: number;
  }> {
    return await this.fetch('/cleanup/estimate');
  }

  async getSystemInfo(): Promise<{
    disk_usage: any;
    system_info: any;
    containers_count: number;
    images_count: number;
    volumes_count: number;
    networks_count: number;
  }> {
    return await this.fetch('/system/info');
  }

  // Advanced Cleanup API
  async pruneContainers(): Promise<void> {
    await this.fetch('/prune/containers', {
      method: 'POST',
    });
  }

  async pruneVolumes(): Promise<void> {
    await this.fetch('/prune/volumes', {
      method: 'POST',
    });
  }

  async pruneNetworks(): Promise<void> {
    await this.fetch('/prune/networks', {
      method: 'POST',
    });
  }

  async pruneSystem(includeVolumes: boolean = false): Promise<{
    containers_deleted: string[];
    networks_deleted: string[];
    space_reclaimed: number;
  }> {
    return await this.fetch(`/prune/system${includeVolumes ? '?all=true' : ''}`, {
      method: 'POST',
    });
  }
}

export const apiService = new ApiService();
