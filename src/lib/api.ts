import type { StoredConfig } from './configMapper'

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err = new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
    ;(err as Error & { status: number }).status = res.status
    throw err
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  configs: {
    list: ()                                       => request<StoredConfig[]>('/configs'),
    create: (body: Omit<StoredConfig, 'id' | 'created_at' | 'updated_at'>) => request<StoredConfig>('/configs', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<StoredConfig>) => request<StoredConfig>(`/configs/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string)                           => request<void>(`/configs/${id}`, { method: 'DELETE' }),
  },
  session: {
    get:    ()                       => request<{ active_config_id: string | null }>('/session'),
    set:    (active_config_id: string) => request<void>('/session', { method: 'PUT', body: JSON.stringify({ active_config_id }) }),
  },
}
