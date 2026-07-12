/**
 * useProfiles — context hook for the active learner profile.
 *
 * Wraps the entire app inside <ProfilesProvider>. The hook:
 *   - reads the storage scope from useAuth().user?.username || 'default'
 *   - listens to PROFILE_CHANGE_EVENT + 'storage' for cross-component sync
 *   - exposes active profile, profiles list, create / switch / delete
 *   - clears in-memory state on logout / scope change
 *
 * useProfiles() MUST be rendered inside <ProfilesProvider>. It throws a
 * helpful error if called outside, since misuse is a programming bug.
 *
 * Note: this file exports both a component and a hook, which trips the
 * `react-refresh/only-export-components` rule in dev. The lint rule is
 * disabled file-wide because Fast Refresh for a context+hook pair is a
 * known acceptable tradeoff and we always rebuild the bundle anyway.
 */

/* eslint-disable react-refresh/only-export-components */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import * as store from '../lib/profileStore.js'

const ProfilesContext = createContext(null)

export function ProfilesProvider({ authUser, children }) {
  // Scope is derived from the auth user. Falls back to 'default' so the
  // system still works if auth is removed or restructured.
  const scope = authUser?.username || 'default'

  // Track scope changes during render. When scope changes (login/logout),
  // re-read storage synchronously rather than in an effect. This is the
  // React-recommended "store the previous prop" pattern.
  const prevScopeRef = useRef(scope)
  const [record, setRecord] = useState(() => store.loadProfiles(scope))
  if (prevScopeRef.current !== scope) {
    prevScopeRef.current = scope
    setRecord(store.loadProfiles(scope))
  }

  // Listen for in-process and cross-tab changes. The deps track `scope`
  // so the listener re-binds to the current storage scope; this avoids
  // mutating refs during render.
  useEffect(() => {
    const refresh = () => setRecord(store.loadProfiles(scope))
    window.addEventListener(store.PROFILE_CHANGE_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(store.PROFILE_CHANGE_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [scope])

  const profiles = useMemo(
    () => Object.values(record.profiles || {}).sort(
      (a, b) => new Date(b.lastUsedAt) - new Date(a.lastUsedAt)
    ),
    [record]
  )
  const activeProfile = record.activeProfileId
    ? record.profiles[record.activeProfileId] || null
    : null
  const activeProfileId = record.activeProfileId || null

  const createProfile = useCallback((name, avatarId) => {
    const result = store.createProfile(scope, name, avatarId)
    if (result.ok) setRecord(store.loadProfiles(scope))
    return result
  }, [scope])

  const switchProfile = useCallback((id) => {
    const p = store.setActiveProfileId(scope, id)
    if (p) setRecord(store.loadProfiles(scope))
    return p
  }, [scope])

  const deleteProfile = useCallback((id) => {
    const result = store.deleteProfile(scope, id)
    if (result.ok) setRecord(store.loadProfiles(scope))
    return result
  }, [scope])

  const value = useMemo(() => ({
    scope,
    ready: true,           // storage read is synchronous during render; always ready
    profiles,
    activeProfile,
    activeProfileId,
    createProfile,
    switchProfile,
    deleteProfile,
  }), [scope, profiles, activeProfile, activeProfileId, createProfile, switchProfile, deleteProfile])

  return <ProfilesContext.Provider value={value}>{children}</ProfilesContext.Provider>
}

export function useProfiles() {
  const ctx = useContext(ProfilesContext)
  if (!ctx) {
    throw new Error('useProfiles() called outside <ProfilesProvider>')
  }
  return ctx
}