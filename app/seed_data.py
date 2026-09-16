import math
import struct
import wave
import os
from pathlib import Path
from app.database import get_db_connection, init_db

BASE_DIR = Path(__file__).resolve().parent.parent
TRACKS_DIR = BASE_DIR / "uploads" / "tracks"
COVERS_DIR = BASE_DIR / "uploads" / "covers"

TRACKS_DIR.mkdir(parents=True, exist_ok=True)
COVERS_DIR.mkdir(parents=True, exist_ok=True)

def generate_synth_audio(filepath: Path, base_freqs: list, bpm: int = 110, duration_seconds: int = 30):
    sample_rate = 44100
    num_samples = int(sample_rate * duration_seconds)
    
    with wave.open(str(filepath), 'w') as wav_file:
        wav_file.setnchannels(2)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        
        frames = bytearray()
        beat_duration = 60.0 / bpm
        
        for i in range(num_samples):
            t = float(i) / sample_rate
            current_beat = int(t / beat_duration)
            freq_idx = current_beat % len(base_freqs)
            target_freq = base_freqs[freq_idx]
            
            beat_time = t % beat_duration
            env = math.exp(-2.5 * (beat_time / beat_duration))
            
            val_lead = math.sin(2.0 * math.pi * target_freq * t) * 0.4
            val_sub = math.sin(2.0 * math.pi * (target_freq / 2.0) * t) * 0.35
            val_chord = math.sin(2.0 * math.pi * (target_freq * 1.5) * t) * 0.2
            kick = math.sin(2.0 * math.pi * 55.0 * t) * math.exp(-12.0 * beat_time) if beat_time < 0.2 else 0.0
            
            sample_val = (val_lead + val_sub + val_chord) * env + (kick * 0.5)
            if t > duration_seconds - 3:
                sample_val *= (duration_seconds - t) / 3.0
                
            sample_val = max(-1.0, min(1.0, sample_val))
            sample_int = int(sample_val * 30000)
            frames.extend(struct.pack('<hh', sample_int, sample_int))
            
        wav_file.writeframes(frames)

def seed():
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()

    # If albums already exist, return
    cursor.execute("SELECT COUNT(*) as cnt FROM albums")
    if cursor.fetchone()["cnt"] > 0:
        conn.close()
        return

    print("Cargando álbumes y canciones completas...")

    # Fetch existing artists
    cursor.execute("SELECT id, name FROM artists")
    artist_rows = cursor.fetchall()
    
    if not artist_rows:
        conn.close()
        return

    artists_dict = {a["name"]: a["id"] for a in artist_rows}

    # Albums data
    albums_data = [
        {
            "title": "Neon Horizons",
            "artist_id": artists_dict.get("Luna Eclipse", 1),
            "cover_url": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=80",
            "release_year": "2026",
            "genre": "Synthwave",
            "type": "album"
        },
        {
            "title": "Lazy Sundays",
            "artist_id": artists_dict.get("Nova Waves", 2),
            "cover_url": "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500&auto=format&fit=crop&q=80",
            "release_year": "2025",
            "genre": "Indie Pop",
            "type": "ep"
        },
        {
            "title": "Neural Matrix",
            "artist_id": artists_dict.get("Cyber Droid", 3),
            "cover_url": "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=80",
            "release_year": "2026",
            "genre": "Cyberpunk",
            "type": "album"
        },
        {
            "title": "Wooden Memories",
            "artist_id": artists_dict.get("Acoustic Mirage", 4),
            "cover_url": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=80",
            "release_year": "2025",
            "genre": "Acoustic",
            "type": "album"
        }
    ]

    album_ids = {}
    for a in albums_data:
        cursor.execute("""
            INSERT INTO albums (title, artist_id, cover_url, release_year, genre, type)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (a["title"], a["artist_id"], a["cover_url"], a["release_year"], a["genre"], a["type"]))
        album_ids[a["title"]] = cursor.lastrowid

    # Update existing songs with album_id and track_number
    cursor.execute("UPDATE songs SET album_id = ?, track_number = 1 WHERE title = 'Midnight Glow'", (album_ids.get("Neon Horizons"),))
    cursor.execute("UPDATE songs SET album_id = ?, track_number = 2 WHERE title = 'Starlight Odyssey'", (album_ids.get("Neon Horizons"),))
    cursor.execute("UPDATE songs SET album_id = ?, track_number = 1 WHERE title = 'Summer Breeze & Coffee'", (album_ids.get("Lazy Sundays"),))
    cursor.execute("UPDATE songs SET album_id = ?, track_number = 2 WHERE title = 'City Rooftops'", (album_ids.get("Lazy Sundays"),))
    cursor.execute("UPDATE songs SET album_id = ?, track_number = 1 WHERE title = 'Overclocked Protocol'", (album_ids.get("Neural Matrix"),))
    cursor.execute("UPDATE songs SET album_id = ?, track_number = 2 WHERE title = 'Neon Velocity'", (album_ids.get("Neural Matrix"),))
    cursor.execute("UPDATE songs SET album_id = ?, track_number = 1 WHERE title = 'Campfire Whisper'", (album_ids.get("Wooden Memories"),))

    conn.commit()
    conn.close()
    print("Álbumes inicializados correctamente.")

if __name__ == "__main__":
    seed()
