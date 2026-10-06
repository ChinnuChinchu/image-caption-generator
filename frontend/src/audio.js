// Plays a caption aloud. First choice: the server's gTTS audio (needs the login token).
// If that fails, fall back to the browser's built-in voice (Web Speech API).
import { ApiError, getCaptionAudio } from './api.js'

// Pick the language from the script the caption is written in
export function detectLang(text) {
  if (/[\u0D00-\u0D7F]/.test(text)) return { gtts: 'ml', voice: 'ml-IN' } // Malayalam
  if (/[\u0900-\u097F]/.test(text)) return { gtts: 'hi', voice: 'hi-IN' } // Hindi
  if (/[\u0B80-\u0BFF]/.test(text)) return { gtts: 'ta', voice: 'ta-IN' } // Tamil
  return { gtts: 'en', voice: 'en-US' }
}

let active = null // the one caption currently loading or playing

// Stop playback. With an owner, only stops if that owner is the one playing.
export function stopPlayback(owner) {
  if (active && (owner === undefined || active.owner === owner)) active.stop()
}

export async function playCaption(owner, id, text, { onPlaying, onEnded } = {}) {
  stopPlayback() // only one caption at a time

  const { gtts, voice } = detectLang(text)
  const session = { owner, cancelled: false, cleanup: null }
  active = session

  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    if (active === session) active = null
    onEnded?.()
  }
  session.stop = () => {
    session.cancelled = true
    session.cleanup?.()
    finish()
  }

  try {
    const blob = await getCaptionAudio(id, gtts)
    if (session.cancelled) return { usedFallback: false }

    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    session.cleanup = () => {
      audio.pause()
      URL.revokeObjectURL(url)
    }
    audio.onended = () => {
      URL.revokeObjectURL(url)
      finish()
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      finish()
    }
    await audio.play()
    if (!session.cancelled) onPlaying?.()
    return { usedFallback: false }
  } catch (error) {
    session.cleanup?.()
    session.cleanup = null
    if (session.cancelled) return { usedFallback: false }
    // Logged out: api.js already sent the user back to the login page
    if (error instanceof ApiError && error.status === 401) {
      finish()
      throw error
    }
    if (!('speechSynthesis' in window)) {
      finish()
      throw error
    }

    // Server voice unavailable: use the browser's own voice instead
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = voice
    utterance.onend = finish
    utterance.onerror = finish
    session.cleanup = () => window.speechSynthesis.cancel()
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    onPlaying?.()
    return { usedFallback: true }
  }
}