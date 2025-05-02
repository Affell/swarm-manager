import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// Nodes
export const listNodes = async (): Promise<Node[]> => {
  const res = await api.get<Node[]>('/nodes')
  return res.data
}
export const drainNode = async (id: string): Promise<void> => {
  await api.post(`/nodes/${id}/drain`)
}
export const activateNode = async (id: string): Promise<void> => {
  await api.post(`/nodes/${id}/activate`)
}

// Stacks
export const listStacks = async (): Promise<Stack[]> => {
  const res = await api.get<Stack[]>('/stacks')
  return res.data
}
export const getStack = async (name: string): Promise<Service[]> => {
  const res = await api.get<Service[]>(`/stacks/${name}`)
  return res.data
}
export const stopStack = async (name: string): Promise<void> => {
  await api.post(`/stacks/${name}/stop`)
}
export const startStack = async (name: string): Promise<void> => {
  await api.post(`/stacks/${name}/start`)
}

// Services
export const stopService = async (id: string): Promise<void> => {
  await api.post(`/services/${id}/stop`)
}
export const restartService = async (id: string): Promise<void> => {
  await api.post(`/services/${id}/restart`)
}
export const serviceLogs = async (id: string): Promise<string> => {
  const res = await api.get<string>(`/services/${id}/logs`, { responseType: 'text' })
  return res.data
}

// Images
export const listImages = async (): Promise<Image[]> => {
  const res = await api.get<Image[]>('/images')
  return res.data
}
export const removeImage = async (id: string): Promise<void> => {
  await api.post(`/images/${id}/remove`)
}

// Prune
export const pruneImages = async (): Promise<PruneResult> => {
  const res = await api.post<PruneResult>('/prune/images')
  return res.data
}

export const pruneContainers = async (): Promise<PruneResult> => {
  const res = await api.post<PruneResult>('/prune/containers')
  return res.data
}

export const pruneVolumes = async (): Promise<PruneResult> => {
  const res = await api.post<PruneResult>('/prune/volumes')
  return res.data
}

export const pruneNetworks = async (): Promise<PruneResult> => {
  const res = await api.post<PruneResult>('/prune/networks')
  return res.data
}

export const pruneSystem = async (all: boolean = false): Promise<PruneResult> => {
  const res = await api.post<PruneResult>(`/prune/system?all=${all}`)
  return res.data
}

// Version
export const getVersion = async (): Promise<VersionInfo> => {
  const res = await api.get<VersionInfo>('/version')
  return res.data
}

// Types
export interface Node { id: string; hostname: string; status: string }
export interface Service { id: string; name: string; image: string; desired_count: number; current_count: number }
export interface Stack { name: string; services: Service[] }
export interface Image { id: string; repo_tags: string[]; size: number }
export interface VersionInfo { version: string }
export interface PruneResult { 
  spaceReclaimed?: number; 
  imagesDeleted?: number;
  containersDeleted?: number;
  volumesDeleted?: number;
  networksDeleted?: number;
}