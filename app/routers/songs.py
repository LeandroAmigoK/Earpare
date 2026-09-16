import os
import shutil
import uuid
from pathlib import Path
from typing import Optional, List
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query, status
from app.database import get_db_connection
from app.models import SongResponse

router = APIRouter(prefix="/api/songs", tags=["songs"])

BASE_DIR = Path(__file__).resolve().parent.parent.parent
TRACKS_DIR = BASE_DIR / "uploads" / "tracks"
COVERS_DIR = BASE_DIR / "uploads" / "covers"

TRACKS_DIR.mkdir(parents=True, exist_ok=True)
COVERS_DIR.mkdir(parents=True, exist_ok=True)

@router.get("", response_model=List[SongResponse])
def get_songs(
    search: Optional[str] = Query(None),
    genre: Optional[str] = Query(None),
    artist_id: Optional[int] = Query(None),
    album_id: Optional[int] = Query(None),
    sort_by: Optional[str] = Query("popular")  # popular, newest
):
    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
        SELECT s.*, a.name as artist_name, a.avatar_url as artist_avatar,
               COALESCE(al.title, s.album) as album_name,
               CASE WHEN f.song_id IS NOT NULL THEN 1 ELSE 0 END as is_favorite
        FROM songs s
        JOIN artists a ON s.artist_id = a.id
        LEFT JOIN albums al ON s.album_id = al.id
        LEFT JOIN favorites f ON s.id = f.song_id
        WHERE 1=1
    """
    params = []

    if search:
        query += " AND (s.title LIKE ? OR a.name LIKE ? OR s.album LIKE ? OR al.title LIKE ?)"
        term = f"%{search}%"
        params.extend([term, term, term, term])

    if genre and genre.lower() != "all":
        query += " AND LOWER(s.genre) = LOWER(?)"
        params.append(genre)

    if artist_id:
        query += " AND s.artist_id = ?"
        params.append(artist_id)

    if album_id:
        query += " AND s.album_id = ?"
        params.append(album_id)

    if sort_by == "newest":
        query += " ORDER BY s.id DESC"
    else:
        query += " ORDER BY s.streams_count DESC, s.id DESC"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    result = []
    for r in rows:
        result.append(SongResponse(
            id=r["id"],
            title=r["title"],
            artist_id=r["artist_id"],
            artist_name=r["artist_name"],
            artist_avatar=r["artist_avatar"],
            album=r["album_name"] or r["album"] or "Single",
            genre=r["genre"] or "",
            duration=r["duration"] or 0,
            audio_url=r["audio_url"],
            cover_url=r["cover_url"] or "",
            lyrics=r["lyrics"] or "",
            streams_count=r["streams_count"],
            release_date=r["release_date"] or "",
            is_favorite=bool(r["is_favorite"])
        ))
    return result

@router.get("/history", response_model=List[SongResponse])
def get_play_history(user_id: str = Query("guest"), limit: int = Query(20)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT s.*, a.name as artist_name, a.avatar_url as artist_avatar,
               COALESCE(al.title, s.album) as album_name,
               CASE WHEN f.song_id IS NOT NULL THEN 1 ELSE 0 END as is_favorite,
               MAX(ph.played_at) as last_played
        FROM play_history ph
        JOIN songs s ON ph.song_id = s.id
        JOIN artists a ON s.artist_id = a.id
        LEFT JOIN albums al ON s.album_id = al.id
        LEFT JOIN favorites f ON s.id = f.song_id
        WHERE ph.user_id = ?
        GROUP BY s.id
        ORDER BY last_played DESC
        LIMIT ?
    """, (user_id, limit))
    rows = cursor.fetchall()
    conn.close()

    return [
        SongResponse(
            id=r["id"],
            title=r["title"],
            artist_id=r["artist_id"],
            artist_name=r["artist_name"],
            artist_avatar=r["artist_avatar"],
            album=r["album_name"] or r["album"] or "Single",
            genre=r["genre"] or "",
            duration=r["duration"] or 0,
            audio_url=r["audio_url"],
            cover_url=r["cover_url"] or "",
            lyrics=r["lyrics"] or "",
            streams_count=r["streams_count"],
            release_date=r["release_date"] or "",
            is_favorite=bool(r["is_favorite"])
        )
        for r in rows
    ]

@router.get("/{song_id}", response_model=SongResponse)
def get_song(song_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT s.*, a.name as artist_name, a.avatar_url as artist_avatar,
               COALESCE(al.title, s.album) as album_name,
               CASE WHEN f.song_id IS NOT NULL THEN 1 ELSE 0 END as is_favorite
        FROM songs s
        JOIN artists a ON s.artist_id = a.id
        LEFT JOIN albums al ON s.album_id = al.id
        LEFT JOIN favorites f ON s.id = f.song_id
        WHERE s.id = ?
    """, (song_id,))
    r = cursor.fetchone()
    conn.close()

    if not r:
        raise HTTPException(status_code=404, detail="Canción no encontrada")

    return SongResponse(
        id=r["id"],
        title=r["title"],
        artist_id=r["artist_id"],
        artist_name=r["artist_name"],
        artist_avatar=r["artist_avatar"],
        album=r["album_name"] or r["album"] or "Single",
        genre=r["genre"] or "",
        duration=r["duration"] or 0,
        audio_url=r["audio_url"],
        cover_url=r["cover_url"] or "",
        lyrics=r["lyrics"] or "",
        streams_count=r["streams_count"],
        release_date=r["release_date"] or "",
        is_favorite=bool(r["is_favorite"])
    )

MAX_STORAGE_BYTES_PER_ARTIST = 10 * 1024 * 1024 * 1024  # 10 GB

@router.post("/upload")
async def upload_song(
    title: str = Form(...),
    artist_id: int = Form(...),
    album_id: Optional[int] = Form(None),
    album: Optional[str] = Form("Single"),
    genre: Optional[str] = Form("Pop"),
    release_date: Optional[str] = Form(""),
    track_number: Optional[int] = Form(1),
    lyrics: Optional[str] = Form(""),
    audio_file: UploadFile = File(...),
    cover_file: Optional[UploadFile] = File(None)
):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Validate artist exists and get current storage
    cursor.execute("SELECT id, name, COALESCE(storage_used_bytes, 0) as storage_used_bytes FROM artists WHERE id = ?", (artist_id,))
    artist = cursor.fetchone()
    if not artist:
        conn.close()
        raise HTTPException(status_code=404, detail="Artista no encontrado")

    # Check incoming file sizes
    audio_file.file.seek(0, os.SEEK_END)
    audio_file_size = audio_file.file.tell()
    audio_file.file.seek(0)

    cover_file_size = 0
    if cover_file and cover_file.filename:
        cover_file.file.seek(0, os.SEEK_END)
        cover_file_size = cover_file.file.tell()
        cover_file.file.seek(0)

    total_incoming_bytes = audio_file_size + cover_file_size
    current_storage = artist["storage_used_bytes"] or 0

    if current_storage + total_incoming_bytes > MAX_STORAGE_BYTES_PER_ARTIST:
        conn.close()
        used_gb = round(current_storage / (1024 ** 3), 2)
        incoming_mb = round(total_incoming_bytes / (1024 ** 2), 2)
        raise HTTPException(
            status_code=400,
            detail=f"Límite de almacenamiento de 10 GB alcanzado para este artista. Uso actual: {used_gb} GB / 10 GB. El nuevo archivo requiere {incoming_mb} MB."
        )

    album_title = album or "Single"
    final_cover_url = "/static/assets/default_cover.png"

    # If album_id provided, fetch album data
    if album_id:
        cursor.execute("SELECT * FROM albums WHERE id = ?", (album_id,))
        album_row = cursor.fetchone()
        if album_row:
            album_title = album_row["title"]
            if album_row["cover_url"]:
                final_cover_url = album_row["cover_url"]
            if album_row["genre"]:
                genre = album_row["genre"]
            if album_row["release_year"]:
                release_date = album_row["release_year"]

    # Save audio file
    audio_ext = Path(audio_file.filename).suffix or ".mp3"
    audio_filename = f"{uuid.uuid4().hex}{audio_ext}"
    audio_path = TRACKS_DIR / audio_filename

    with open(audio_path, "wb") as buffer:
        shutil.copyfileobj(audio_file.file, buffer)

    audio_url = f"/uploads/tracks/{audio_filename}"

    # Save cover file if provided explicitly
    if cover_file and cover_file.filename:
        cover_ext = Path(cover_file.filename).suffix or ".jpg"
        cover_filename = f"{uuid.uuid4().hex}{cover_ext}"
        cover_path = COVERS_DIR / cover_filename
        with open(cover_path, "wb") as buffer:
            shutil.copyfileobj(cover_file.file, buffer)
        final_cover_url = f"/uploads/covers/{cover_filename}"

    duration = 180

    cursor.execute("""
        INSERT INTO songs (title, artist_id, album_id, album, genre, track_number, duration, audio_url, cover_url, lyrics, release_date, file_size_bytes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (title, artist_id, album_id, album_title, genre or "Pop", track_number or 1, duration, audio_url, final_cover_url, lyrics or "", release_date or "2026", total_incoming_bytes))

    new_id = cursor.lastrowid

    # Update artist storage usage
    cursor.execute("""
        UPDATE artists
        SET storage_used_bytes = COALESCE(storage_used_bytes, 0) + ?
        WHERE id = ?
    """, (total_incoming_bytes, artist_id))

    conn.commit()
    conn.close()

    return {
        "message": "Canción subida exitosamente",
        "song_id": new_id,
        "audio_url": audio_url,
        "cover_url": final_cover_url,
        "file_size_bytes": total_incoming_bytes,
        "storage_used_bytes": current_storage + total_incoming_bytes,
        "storage_limit_bytes": MAX_STORAGE_BYTES_PER_ARTIST
    }

@router.post("/{song_id}/stream")
@router.post("/{song_id}/play")
def increment_stream(song_id: int, user_id: str = Query("guest")):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE songs SET streams_count = streams_count + 1 WHERE id = ?", (song_id,))
    
    cursor.execute("""
        UPDATE artists
        SET monthly_listeners = monthly_listeners + 1
        WHERE id = (SELECT artist_id FROM songs WHERE id = ?)
    """, (song_id,))

    # Insert into play_history
    cursor.execute("INSERT INTO play_history (song_id, user_id) VALUES (?, ?)", (song_id, user_id))

    conn.commit()
    conn.close()
    return {"status": "ok"}

@router.delete("/{song_id}")
def delete_song(song_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT artist_id, audio_url, cover_url, file_size_bytes FROM songs WHERE id = ?", (song_id,))
    song = cursor.fetchone()
    if not song:
        conn.close()
        raise HTTPException(status_code=404, detail="Canción no encontrada")

    artist_id = song["artist_id"]
    file_size = song["file_size_bytes"] or 0

    if song["audio_url"] and song["audio_url"].startswith("/uploads/"):
        rel_path = song["audio_url"].replace("/uploads/", "")
        p = BASE_DIR / "uploads" / rel_path
        if p.exists():
            try:
                if file_size == 0:
                    file_size = p.stat().st_size
                os.remove(p)
            except Exception:
                pass

    # Decrement artist storage
    if artist_id and file_size > 0:
        cursor.execute("""
            UPDATE artists
            SET storage_used_bytes = MAX(0, COALESCE(storage_used_bytes, 0) - ?)
            WHERE id = ?
        """, (file_size, artist_id))

    cursor.execute("DELETE FROM songs WHERE id = ?", (song_id,))
    conn.commit()
    conn.close()
    return {"message": "Canción eliminada"}
