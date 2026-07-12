/**
 * ProfilePicker — full-screen "Who's Studying?" gate.
 *
 * Renders when the user is logged in (or using the default scope) and no
 * active profile exists. On first ever launch (no profiles at all), it
 * collapses to just the "Add" card so the empty grid is not confusing.
 *
 * Tap a profile card → switches to that profile, picker closes.
 * Tap the "Add" card → opens the create modal.
 * Long-press / right-click a profile → confirm-delete flow.
 *
 * The picker is mounted by the root App component when `ready && user &&
 * !activeProfileId`. It owns its own modal; the parent doesn't need to
 * pass anything besides `onPick` (callback fired after a profile is
 * switched/created so the parent can re-render the rest of the shell).
 */

import { useState } from 'react'
import { useProfiles } from '../hooks/useProfiles.jsx'
import { AVATARS, MAX_NAME_LEN } from '../lib/profileDefaults.js'
import ProfileAvatar from './ProfileAvatar.jsx'

export default function ProfilePicker() {
  const { profiles, activeProfileId, createProfile, switchProfile, deleteProfile } = useProfiles()
  // showCreate tracks user intent ("Add" card was tapped). The modal is
  // additionally forced-open when there are zero profiles, so first-time
  // users never see an empty grid.
  const [userOpenedCreate, setUserOpenedCreate] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const showCreate = userOpenedCreate || profiles.length === 0

  const handlePick = (id) => {
    if (id !== activeProfileId) switchProfile(id)
  }

  const handleLongPress = (id) => {
    if (profiles.length <= 1) {
      window.alert('Cannot delete the last profile.')
      return
    }
    setPendingDeleteId(id)
  }

  // Long-press detector for delete: a 600ms hold (without releasing) on a
  // profile card opens the delete-confirm modal. Mouse/touch release
  // cancels the timer.
  const startLongPress = (id) => {
    let timer = setTimeout(() => handleLongPress(id), 600)
    const cancel = () => { clearTimeout(timer); timer = null }
    window.addEventListener('mouseup', cancel, { once: true })
    window.addEventListener('touchend', cancel, { once: true })
  }

  const confirmDelete = () => {
    if (!pendingDeleteId) return
    const r = deleteProfile(pendingDeleteId)
    if (!r.ok && r.error) window.alert(r.error)
    setPendingDeleteId(null)
  }

  const onlyOne = profiles.length <= 1

  return (
    <div className="profile-picker-screen" role="dialog" aria-modal="true" aria-label="Choose your profile">
      <h1 className="profile-picker-title">Who's Studying?</h1>
      <p className="profile-picker-subtitle">Tap your profile to start learning.</p>

      <div className="profile-grid">
        {profiles.map(p => (
          <div key={p.id}
               className={`profile-card ${p.id === activeProfileId ? 'profile-card--active' : ''}`}
               onClick={() => handlePick(p.id)}
               onContextMenu={(e) => { e.preventDefault(); handleLongPress(p.id) }}
               onTouchStart={() => startLongPress(p.id)}
               role="button"
               tabIndex={0}
               onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlePick(p.id) } }}>
            <ProfileAvatar profile={p} size={72} active={p.id === activeProfileId} />
            <div className="profile-name">{p.name}</div>
          </div>
        ))}

        <div className="profile-card profile-card--add"
             onClick={() => setUserOpenedCreate(true)}
             role="button"
             tabIndex={0}
             onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setUserOpenedCreate(true) } }}>
          <span className="profile-avatar profile-avatar--placeholder" aria-hidden="true">＋</span>
          <div className="profile-name">Add</div>
        </div>
      </div>

      <div className="profile-picker-hint">
        Long-press a profile to delete it.
        {onlyOne && profiles.length === 1 && ' (At least one profile is required.)'}
      </div>

      {showCreate && (
        <ProfileCreateModal
          onClose={() => profiles.length > 0 && setUserOpenedCreate(false)}
          onCreate={(name, avatarId) => createProfile(name, avatarId)}
        />
      )}

      {pendingDeleteId && (
        <div className="profile-confirm-overlay" onClick={() => setPendingDeleteId(null)}>
          <div className="profile-confirm" onClick={(e) => e.stopPropagation()}>
            <p>Delete this profile? Past progress will be lost.</p>
            <div className="profile-confirm-actions">
              <button type="button" onClick={() => setPendingDeleteId(null)}>Cancel</button>
              <button type="button" className="profile-confirm-delete" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProfileCreateModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [avatarId, setAvatarId] = useState(AVATARS[0].id)
  const [error, setError] = useState('')

  const submit = (e) => {
    if (e && e.preventDefault) e.preventDefault()
    const result = onCreate(name, avatarId)
    if (!result.ok) {
      setError(result.error || 'Could not create profile.')
      return
    }
    setName('')
    setError('')
    onClose?.()
  }

  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <form className="profile-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 className="profile-modal-title">New profile</h2>

        <label className="profile-modal-label">
          Name
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value.slice(0, MAX_NAME_LEN)); setError('') }}
            autoFocus
            maxLength={MAX_NAME_LEN}
            placeholder="e.g. Arjun"
            className="profile-modal-input"
          />
        </label>

        <div className="profile-modal-label">Choose an avatar</div>
        <div className="profile-avatar-grid">
          {AVATARS.map(a => (
            <span
              key={a.id}
              className={`profile-avatar profile-avatar--pick ${a.id === avatarId ? 'profile-avatar--selected' : ''}`}
              style={{ background: a.tint }}
              onClick={() => setAvatarId(a.id)}
              role="radio"
              aria-checked={a.id === avatarId}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAvatarId(a.id) } }}
            >
              {a.glyph}
            </span>
          ))}
        </div>

        {error && <p className="profile-modal-error">{error}</p>}

        <div className="profile-modal-actions">
          {onClose && (
            <button type="button" onClick={onClose} className="profile-modal-cancel">Cancel</button>
          )}
          <button type="submit" disabled={!name.trim()} className="profile-modal-submit">Create</button>
        </div>
      </form>
    </div>
  )
}