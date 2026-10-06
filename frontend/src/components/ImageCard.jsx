import { useEffect, useRef, useState } from 'react'
import { playCaption, stopPlayback } from '../audio.js'
import { useToast } from '../context/ToastContext.jsx'
import { PencilIcon, PlayIcon, RefreshIcon, StopIcon, TrashIcon } from './icons.jsx'
import Spinner from './Spinner.jsx'

const MAX_CAPTION = 500

const actionClass =
  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-powder/40 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent'

const shimmer =
  'rounded bg-linear-to-r from-powder/60 via-smoke to-powder/60 bg-size-[200%_100%] motion-safe:animate-shimmer'

function formatDate(iso) {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ImageCard({ image, generating, onRegenerate, onSave, onDelete }) {
  const { notify } = useToast()
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [draftError, setDraftError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(null) // 'delete' | 'regenerate' | null
  const [deleting, setDeleting] = useState(false)
  const [audioState, setAudioState] = useState('idle') // idle | loading | playing

  const imgRef = useRef(null)
  const textareaRef = useRef(null)
  const editButtonRef = useRef(null)
  const confirmRef = useRef(null)
  const wasEditing = useRef(false)

  const caption = image.final_caption
  const isEdited = Boolean(image.edited_caption)

  // An image that is already cached may finish loading before React notices
  useEffect(() => {
    if (imgRef.current?.complete) setLoaded(true)
  }, [])

  // Keyboard users: move focus into the editor, and back to the Edit button afterwards
  useEffect(() => {
    if (editing) textareaRef.current?.focus()
    else if (wasEditing.current) editButtonRef.current?.focus()
    wasEditing.current = editing
  }, [editing])

  useEffect(() => {
    if (confirm) confirmRef.current?.querySelector('button')?.focus()
  }, [confirm])

  // Stop the audio if this card disappears while playing
  useEffect(() => () => stopPlayback(image.id), [image.id])

  const startEdit = () => {
    setDraft(caption || '')
    setDraftError('')
    setEditing(true)
  }

  const save = async (text) => {
    if (text !== null) {
      const trimmed = text.trim()
      if (!trimmed) {
        setDraftError("A caption can't be empty. Use “Use AI caption” to go back to the original.")
        return
      }
      text = trimmed
    }
    setDraftError('')
    setSaving(true)
    const ok = await onSave(image.id, text)
    setSaving(false)
    if (ok) setEditing(false)
  }

  const handleEditKeys = (event) => {
    if (event.key === 'Escape') setEditing(false)
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) save(draft)
  }

  const askRegenerate = () => (isEdited ? setConfirm('regenerate') : onRegenerate(image.id))

  const toggleListen = async () => {
    if (audioState !== 'idle') {
      stopPlayback(image.id)
      setAudioState('idle')
      return
    }
    setAudioState('loading')
    try {
      const { usedFallback } = await playCaption(image.id, image.id, caption, {
        onPlaying: () => setAudioState('playing'),
        onEnded: () => setAudioState('idle'),
      })
      if (usedFallback) notify("The server voice isn't available, so your browser's voice is reading it.", 'info')
    } catch (error) {
      setAudioState('idle')
      notify(error.message, 'error')
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    const ok = await onDelete(image.id)
    if (!ok) {
      setDeleting(false)
      setConfirm(null)
    }
  }

  let captionBlock
  if (generating) {
    captionBlock = (
      <div role="status">
        <span className="sr-only">Generating caption</span>
        <p className="mb-3 flex items-center gap-2 text-sm font-medium text-brand-dark" aria-hidden="true">
          <Spinner className="h-4 w-4" /> Generating caption…
        </p>
        <div className="space-y-2" aria-hidden="true">
          <div className={`h-3 w-11/12 ${shimmer}`} />
          <div className={`h-3 w-3/4 ${shimmer}`} />
        </div>
      </div>
    )
  } else if (editing) {
    captionBlock = (
      <div>
        <label htmlFor={`caption-${image.id}`} className="mb-1.5 block text-sm font-medium text-slate-700">
          Edit caption
        </label>
        <textarea
          id={`caption-${image.id}`}
          ref={textareaRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleEditKeys}
          maxLength={MAX_CAPTION}
          rows={3}
          className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-brand focus:ring-4 focus:ring-powder"
        />
        <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
          <span>Ctrl+Enter to save, Esc to cancel</span>
          <span>
            {draft.length}/{MAX_CAPTION}
          </span>
        </div>
        <div role="alert" className="min-h-4 text-sm text-rose-600">
          {draftError}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => save(draft)}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-70"
          >
            {saving && <Spinner className="h-4 w-4" />}
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={saving}
            className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Cancel
          </button>
          {isEdited && (
            <button
              type="button"
              onClick={() => save(null)}
              disabled={saving}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-brand-dark transition hover:bg-powder/40 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none sm:ml-auto"
            >
              Use AI caption
            </button>
          )}
        </div>
      </div>
    )
  } else if (caption) {
    captionBlock = (
      <div>
        <span
          className={`mb-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            isEdited ? 'bg-mint text-brand-dark' : 'bg-powder text-brand-dark'
          }`}
        >
          {isEdited ? 'Edited' : 'AI caption'}
        </span>
        <p className="leading-relaxed break-words text-slate-800">{caption}</p>
      </div>
    )
  } else {
    captionBlock = (
      <div>
        <p className="text-slate-600">No caption yet.</p>
        <button
          type="button"
          onClick={() => onRegenerate(image.id)}
          className="mt-3 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Generate caption
        </button>
      </div>
    )
  }

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-lg motion-safe:animate-fade-up motion-reduce:transition-none">
      {/* The caption doubles as the picture's alt text, for screen readers */}
      <div className="relative aspect-[4/3] overflow-hidden bg-powder/30">
        {!loaded && <div className={`absolute inset-0 ${shimmer} rounded-none`} aria-hidden="true" />}
        <img
          ref={imgRef}
          src={image.image_url}
          alt={caption || 'Uploaded image (no caption yet)'}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex-1">{captionBlock}</div>

        {!editing && confirm === null && (
          <div className="border-t border-slate-100 pt-3">
            <div className="-ml-2.5 flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={toggleListen}
                disabled={!caption || generating}
                aria-pressed={audioState === 'playing'}
                className={actionClass}
              >
                {audioState === 'loading' ? (
                  <Spinner className="h-4 w-4" />
                ) : audioState === 'playing' ? (
                  <StopIcon />
                ) : (
                  <PlayIcon />
                )}
                {audioState === 'playing' ? 'Stop' : audioState === 'loading' ? 'Loading…' : 'Listen'}
              </button>
              <button
                type="button"
                ref={editButtonRef}
                onClick={startEdit}
                disabled={generating}
                className={actionClass}
              >
                <PencilIcon /> Edit
              </button>
              <button
                type="button"
                onClick={askRegenerate}
                disabled={generating}
                className={actionClass}
              >
                <RefreshIcon /> Regenerate
              </button>
              <button
                type="button"
                onClick={() => setConfirm('delete')}
                disabled={generating}
                className={`${actionClass} hover:bg-rose-50 hover:text-rose-700 sm:ml-auto`}
              >
                <TrashIcon /> Delete
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-600">Added {formatDate(image.created_at)}</p>
          </div>
        )}

        {confirm !== null && (
          <div
            ref={confirmRef}
            role="group"
            aria-label={confirm === 'delete' ? 'Confirm delete' : 'Confirm regenerate'}
            onKeyDown={(event) => event.key === 'Escape' && !deleting && setConfirm(null)}
            className="rounded-xl bg-slate-50 p-3 text-sm"
          >
            <p className="font-medium text-slate-800">
              {confirm === 'delete'
                ? 'Delete this image for good?'
                : 'This replaces your edited caption with a new AI caption.'}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                disabled={deleting}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Cancel
              </button>
              {confirm === 'delete' ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-1.5 font-semibold text-white transition hover:bg-rose-700 focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-70"
                >
                  {deleting && <Spinner className="h-4 w-4" />}
                  Yes, delete
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setConfirm(null)
                    onRegenerate(image.id)
                  }}
                  className="rounded-lg bg-brand px-3 py-1.5 font-semibold text-white transition hover:bg-brand-dark focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  Regenerate
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  )
}