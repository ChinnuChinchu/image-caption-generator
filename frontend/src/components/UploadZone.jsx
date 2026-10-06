import { useEffect, useRef, useState } from 'react'
import { PhotoIcon, UploadIcon } from './icons.jsx'
import Spinner from './Spinner.jsx'

// These mirror the rules on the server (the server checks again)
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_MB = 5

function formatBytes(bytes) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function UploadZone({ onUpload }) {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  // The preview URL is made when a file is chosen (not in an effect) and freed
  // when the file changes or this component goes away.
  const previewRef = useRef('')

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    },
    [],
  )

  const setChosenFile = (next) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    const url = next ? URL.createObjectURL(next) : ''
    previewRef.current = url
    setPreview(url)
    setFile(next)
  }

  const chooseFile = (chosen) => {
    if (!chosen) return
    if (!ALLOWED_TYPES.includes(chosen.type)) {
      setError('Only JPEG, PNG or WebP images are allowed.')
      return
    }
    if (chosen.size > MAX_MB * 1024 * 1024) {
      setError(`That image is ${formatBytes(chosen.size)}. The limit is ${MAX_MB} MB.`)
      return
    }
    setError('')
    setChosenFile(chosen)
  }

  const clear = () => {
    setChosenFile(null)
    setError('')
    if (inputRef.current) inputRef.current.value = '' // lets the same file be picked again
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setDragging(false)
    chooseFile(event.dataTransfer.files?.[0])
  }

  const handleUpload = async () => {
    setUploading(true)
    const ok = await onUpload(file)
    setUploading(false)
    if (ok) clear()
  }

  return (
    <section
      aria-labelledby="upload-heading"
      className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8"
    >
      <h2 id="upload-heading" className="text-xl font-bold tracking-tight">
        Upload an image
      </h2>
      <p className="mt-1 text-sm text-slate-600">JPEG, PNG or WebP, up to {MAX_MB} MB. We'll write a caption for it.</p>

      {/* The file input stays in the page (so keyboards and screen readers can use it) */}
      <input
        id="image-file"
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        className="peer sr-only"
        onChange={(event) => chooseFile(event.target.files?.[0])}
      />

      {!file ? (
        <label
          htmlFor="image-file"
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`mt-5 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2 ${
            dragging
              ? 'scale-[1.01] border-brand bg-powder/40'
              : 'border-moonstone bg-smoke hover:border-brand hover:bg-powder/30'
          }`}
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-powder text-brand-dark">
            <UploadIcon className="h-7 w-7" />
          </span>
          <span className="text-slate-600">
            <span className="font-semibold text-brand-dark">Click to choose</span> or drag and drop an image here
          </span>
        </label>
      ) : (
        <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex h-48 items-center justify-center overflow-hidden rounded-xl bg-slate-100 sm:w-72">
            {preview ? (
              <img src={preview} alt="Preview of the selected image" className="h-full w-full object-contain" />
            ) : (
              <PhotoIcon className="h-10 w-10 text-slate-400" />
            )}
          </div>
          <div className="flex-1">
            <p className="font-medium break-all text-slate-900">{file.name}</p>
            <p className="text-sm text-slate-600">{formatBytes(file.size)}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                className="inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-brand-dark to-brand px-5 py-2.5 font-semibold text-white shadow-lg shadow-brand/30 transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
              >
                {uploading && <Spinner />}
                {uploading ? 'Uploading…' : 'Upload & generate caption'}
              </button>
              <button
                type="button"
                onClick={clear}
                disabled={uploading}
                className="rounded-xl border border-slate-300 px-4 py-2.5 font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              >
                Choose a different image
              </button>
            </div>
          </div>
        </div>
      )}

      <div role="alert" className="mt-3 min-h-5 text-sm text-rose-600">
        {error}
      </div>
    </section>
  )
}