/**
 * Axios instance — automatically attaches the Supabase JWT to every request.
 *
 * How it works:
 *   1. Supabase gives us a JWT when we log in
 *   2. We read it from the Supabase session
 *   3. Every API call gets: Authorization: Bearer <token>
 *   4. The FastAPI backend verifies that token
 */

import axios from 'axios'
import { supabase } from './supabase'

const _raw = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
// If the page is served over HTTPS, upgrade any http:// API URL to https://
// so browsers don't block it as Mixed Content.
const BASE_URL = typeof window !== 'undefined' && window.location.protocol === 'https:' && _raw.startsWith('http:')
  ? _raw.replace('http:', 'https:')
  : _raw

export const api = axios.create({ baseURL: BASE_URL })

const DEV_BYPASS = !import.meta.env.VITE_SUPABASE_URL

// Request interceptor — attach the current JWT before every request
api.interceptors.request.use(async (config) => {
  if (DEV_BYPASS) return config
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

// Response interceptor — if 401, session expired, redirect to login
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await supabase.auth.signOut()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)
