import sqlite3
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
db_env = os.getenv("DATABASE_PATH")
if db_env:
    DB_PATH = Path(db_env)
else:
    DB_PATH = BASE_DIR / "spotify.db"

# Ensure parent directory exists (e.g. data/ inside docker)
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS artists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        bio TEXT,
        avatar_url TEXT,
        banner_url TEXT,
        genre TEXT,
        monthly_listeners INTEGER DEFAULT 0,
        verified INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS albums (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        artist_id INTEGER NOT NULL,
        cover_url TEXT,
        release_year TEXT DEFAULT '2026',
        genre TEXT DEFAULT 'Pop',
        type TEXT DEFAULT 'album',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS songs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        artist_id INTEGER NOT NULL,
        album_id INTEGER,
        album TEXT,
        genre TEXT,
        track_number INTEGER DEFAULT 1,
        duration INTEGER DEFAULT 0,
        audio_url TEXT NOT NULL,
        cover_url TEXT,
        lyrics TEXT,
        streams_count INTEGER DEFAULT 0,
        release_date TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
        FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE SET NULL
    );
    """)

    # Try migrations if columns missing
    try:
        cursor.execute("ALTER TABLE songs ADD COLUMN album_id INTEGER;")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE songs ADD COLUMN track_number INTEGER DEFAULT 1;")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE songs ADD COLUMN lyrics TEXT;")
    except Exception:
        pass

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS playlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        cover_url TEXT,
        is_favorite_system INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS playlist_tracks (
        playlist_id INTEGER NOT NULL,
        song_id INTEGER NOT NULL,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (playlist_id, song_id),
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
        FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS favorites (
        song_id INTEGER PRIMARY KEY,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS artist_followers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        artist_id INTEGER NOT NULL,
        user_id TEXT DEFAULT 'guest',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(artist_id, user_id),
        FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS play_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        song_id INTEGER NOT NULL,
        user_id TEXT DEFAULT 'guest',
        played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
    );
    """)

    # GTA World PCU Users & Characters
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS pcu_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pcu_id INTEGER UNIQUE NOT NULL,
        username TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS pcu_characters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pcu_char_id INTEGER UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        firstname TEXT NOT NULL,
        lastname TEXT NOT NULL,
        artist_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES pcu_users(id) ON DELETE CASCADE,
        FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL
    );
    """)

    # Migrations for new columns
    try:
        cursor.execute("ALTER TABLE artists ADD COLUMN followers_count INTEGER DEFAULT 0;")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE artists ADD COLUMN storage_used_bytes INTEGER DEFAULT 0;")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE songs ADD COLUMN file_size_bytes INTEGER DEFAULT 0;")
    except Exception:
        pass

    conn.commit()
    conn.close()
