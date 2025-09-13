import { writable } from 'svelte/store'

export interface UserState {
  userId: string | null
  username: string | null
}

export const USERNAME_MIN = 3
export const USERNAME_MAX = 24

function loadInitial(): UserState {
  try {
    const userId = localStorage.getItem('userId')
    const username = localStorage.getItem('username')
    if (userId && username) return { userId, username }
  } catch {
    /* ignore */
  }
  return { userId: null, username: null }
}

export const user = writable<UserState>(loadInitial())

function generateUUID(): string {
  // Prefer native
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as any).randomUUID()
  }
  // Fallback simple RFC4122-ish
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function setUsername(username: string) {
  const trimmed = username.trim()
  if (!trimmed) return
  const cleaned = trimmed.toLowerCase().replace(/[^a-z]/g, '')
  if (!cleaned) return
  if (cleaned.length < USERNAME_MIN || cleaned.length > USERNAME_MAX) return
  const userId = `${cleaned}-${generateUUID()}`
  user.set({ userId, username: cleaned })
  try {
    localStorage.setItem('userId', userId)
    localStorage.setItem('username', cleaned)
  } catch {
    /* ignore persistence */
  }
}

export function clearUser() {
  user.set({ userId: null, username: null })
  try {
    localStorage.removeItem('userId')
    localStorage.removeItem('username')
  } catch {
    /* ignore */
  }
}
