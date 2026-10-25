import { httpApi } from './http'
import { mockApi } from './mock'

export const DEMO = import.meta.env.VITE_DEMO_MODE === 'true'

// Same interface either way — pages never need to know which one is active.
export const api = DEMO ? mockApi : httpApi
export { ApiError } from './http'
