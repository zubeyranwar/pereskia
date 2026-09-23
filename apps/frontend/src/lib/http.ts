import axios, { AxiosError } from "axios"

export class ApiError extends Error {
    status: number
    code?: string

    constructor(message: string, status: number, code?: string) {
        super(message)
        this.status = status
        this.code = code
    }
}

export const http = axios.create({
    baseURL: "/api",
    withCredentials: true,
    headers: { "content-type": "application/json" },
})

type Listener = () => void
const unauthorizedListeners = new Set<Listener>()

export function onUnauthorized(listener: Listener) {
    unauthorizedListeners.add(listener)
    return () => {
        unauthorizedListeners.delete(listener)
    }
}

http.interceptors.response.use(
    (response) => response,
    (error: AxiosError<{ error?: string; code?: string }>) => {
        const status = error.response?.status ?? 0
        const data = error.response?.data
        if (status === 401 && data?.code === "UNAUTHORIZED") unauthorizedListeners.forEach((l) => l())
        const message = data?.error ?? (status ? `Request failed (${status})` : "Can't reach the server")
        return Promise.reject(new ApiError(message, status, data?.code))
    },
)

export const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))
