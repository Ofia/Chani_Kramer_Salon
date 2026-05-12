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

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

export const api = axios.create({ baseURL: BASE_URL })

// Request interceptor — attach the current JWT before every request
api.interceptors.request.use(async (config) => {
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
