import { useCallback, useEffect, useState } from 'react'
import { deleteImage, generateCaption, listImages, updateCaption, uploadImage } from '../api.js'
import ImageCard from '../components/ImageCard.jsx'
import Navbar from '../components/Navbar.jsx'
import { PhotoIcon } from '../components/icons.jsx'
import Spinner from '../components/Spinner.jsx'
import UploadZone from '../components/UploadZone.jsx'
import { useToast } from '../context/ToastContext.jsx'

const PAGE_SIZE = 12

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200" aria-hidden="true">
      <div className="aspect-[4/3] animate-pulse bg-slate-200" />
      <div className="space-y-3 p-5">
        <div className="h-3 w-5/6 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200" />
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { notify } = useToast()
  const [images, setImages] = useState([])
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [loadError, setLoadError] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)
  const [pending, setPending] = useState(() => new Set()) // ids whose caption is being generated

  const [attempt, setAttempt] = useState(0) // bumped by "Try again" to reload the first page

  useEffect(() => {
    let cancelled = false // ignore the answer if this page was left (or reloaded) meanwhile
    listImages(0, PAGE_SIZE)
      .then((data) => {
        if (cancelled) return
        setImages(data.items)
        setTotal(data.total)
        setStatus('ready')
      })
      .catch((error) => {
        if (cancelled) return
        setLoadError(error.message)
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const retry = () => {
    setStatus('loading')
    setAttempt((n) => n + 1)
  }

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const data = await listImages(images.length, PAGE_SIZE)
      setImages((current) => {
        const known = new Set(current.map((i) => i.id))
        return [...current, ...data.items.filter((i) => !known.has(i.id))]
      })
      setTotal(data.total)
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setLoadingMore(false)
    }
  }

  const replaceImage = (updated) =>
    setImages((current) => current.map((i) => (i.id === updated.id ? updated : i)))

  const setPendingFlag = (id, on) =>
    setPending((current) => {
      const next = new Set(current)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  // Ask the server for a (new) AI caption
  const runCaption = useCallback(
    async (id) => {
      setPendingFlag(id, true)
      try {
        replaceImage(await generateCaption(id))
        notify('Caption ready')
      } catch (error) {
        notify(error.message, 'error')
      } finally {
        setPendingFlag(id, false)
      }
    },
    [notify],
  )

  const handleUpload = async (file) => {
    try {
      const image = await uploadImage(file)
      setImages((current) => [image, ...current])
      setTotal((t) => t + 1)
      notify('Uploaded. Generating the caption…', 'info')
      runCaption(image.id) // not awaited, so the upload box is free again straight away
      return true
    } catch (error) {
      notify(error.message, 'error')
      return false
    }
  }

  const handleSave = async (id, text) => {
    try {
      replaceImage(await updateCaption(id, text))
      notify(text === null ? 'Back to the AI caption' : 'Caption saved')
      return true
    } catch (error) {
      notify(error.message, 'error')
      return false
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteImage(id)
      setImages((current) => current.filter((i) => i.id !== id))
      setTotal((t) => Math.max(0, t - 1))
      notify('Image deleted')
      return true
    } catch (error) {
      notify(error.message, 'error')
      return false
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="mx-auto max-w-6xl space-y-10 px-6 py-10">
        <UploadZone onUpload={handleUpload} />

        <section aria-labelledby="gallery-heading">
          <div className="mb-5 flex items-end justify-between">
            <h2 id="gallery-heading" className="text-xl font-bold tracking-tight">
              Your images
            </h2>
            {status === 'ready' && (
              <p className="text-sm text-slate-600" aria-live="polite">
                {total} {total === 1 ? 'image' : 'images'}
              </p>
            )}
          </div>

          {status === 'loading' && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" role="status">
              <span className="sr-only">Loading your images</span>
              {Array.from({ length: 6 }, (_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {status === 'error' && (
            <div role="alert" className="rounded-2xl bg-rose-50 p-8 text-center ring-1 ring-rose-200">
              <p className="font-medium text-rose-700">{loadError}</p>
              <button
                type="button"
                onClick={retry}
                className="mt-4 rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white transition hover:bg-rose-700 focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Try again
              </button>
            </div>
          )}

          {status === 'ready' && images.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <PhotoIcon className="h-7 w-7" />
              </span>
              <p className="mt-4 font-semibold text-slate-800">No images yet</p>
              <p className="mt-1 text-sm text-slate-600">Upload your first photo above and its caption will appear here.</p>
            </div>
          )}

          {status === 'ready' && images.length > 0 && (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {images.map((image) => (
                  <ImageCard
                    key={image.id}
                    image={image}
                    generating={pending.has(image.id)}
                    onRegenerate={runCaption}
                    onSave={handleSave}
                    onDelete={handleDelete}
                  />
                ))}
              </div>

              {images.length < total && (
                <div className="mt-8 text-center">
                  <p className="mb-3 text-sm text-slate-600">
                    Showing {images.length} of {total}
                  </p>
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 font-medium text-slate-700 transition hover:border-brand hover:bg-powder/40 hover:text-brand-dark focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-70"
                  >
                    {loadingMore && <Spinner />}
                    {loadingMore ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  )
}