import io
import threading
from collections import OrderedDict

from gtts import gTTS
from gtts.lang import tts_langs


class TTSError(Exception):
    """The text-to-speech service failed (network problem, blocked, etc.)."""


class UnsupportedLanguageError(ValueError):
    """The requested language code is not supported by gTTS."""


# Small in-memory cache: (language, text) -> MP3 bytes.
# Captions are short, so 50 entries use well under a megabyte.
_CACHE_SIZE = 50
_cache: "OrderedDict[tuple[str, str], bytes]" = OrderedDict()
_cache_lock = threading.Lock()


def text_to_mp3(text: str, lang: str = "en") -> bytes:
    """Convert text to MP3 audio with gTTS (needs internet access)."""
    if lang not in tts_langs():  # local list of supported languages
        raise UnsupportedLanguageError(lang)

    key = (lang, text)
    with _cache_lock:
        if key in _cache:
            _cache.move_to_end(key)  # mark as recently used
            return _cache[key]

    try:
        buffer = io.BytesIO()
        gTTS(text=text, lang=lang).write_to_fp(buffer)
        audio = buffer.getvalue()
    except Exception as exc:
        raise TTSError("gTTS request failed") from exc

    if not audio:
        raise TTSError("gTTS returned no audio")

    with _cache_lock:
        _cache[key] = audio
        while len(_cache) > _CACHE_SIZE:
            _cache.popitem(last=False)  # drop the least recently used
    return audio