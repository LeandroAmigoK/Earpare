import os
import shutil
import uuid
from pathlib import Path
from typing import Optional, List
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query
from app.database import get_db_connection
from app.models import SongResponse

router = APIRouter(prefix="/api/albums", tags=["albums"])

BASE_DIR = Path(__file__).resolve().parent.parent.parent
COVERS_DIR = BASE_DIR / "uploads" / "covers"
COVERS_DIR.mkdir(parents=True, exist_ok=True)

@router.get("")
def get_albums(artist_id: Optional[int] = Query(None)):
    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
        SELECT al.*, a.name as artist_name, a.avatar_url as artist_avatar,
               COUNT(s.id) as tracks_count
        FROM albums al
        JOIN artists a ON al.artist_id = a.id
        LEFT JOIN songs s ON al.id = s.album_id
        WHERE 1=1
    """
    params = []
    if artist_id:
        query += " AND al.artist_id = ?"
        params.append(artist_id)

    query += " GROUP BY al.id ORDER BY al.id DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "id": r["id"],
            "title": r["title"],
            "artist_id": r["artist_id"],
            "artist_name": r["artist_name"],
            "artist_avatar": r["artist_avatar"],
            "cover_url": r["cover_url"] or "/static/assets/default_cover.png",
            "release_year": r["release_year"],
            "genre": r["genre"],
            "type": r["type"],
            "tracks_count": r["tracks_count"],
            "created_at": str(r["created_at"])
        }
        for r in rows
    ]

@router.get("/{album_id}")
def get_album(album_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT al.*, a.name as artist_name, a.avatar_url as artist_avatar
        FROM albums al
        JOIN artists a ON al.artist_id = a.id
        WHERE al.id = ?
    """, (album_id,))
    album = cursor.fetchone()
    if not album:
        conn.close()
        raise HTTPException(status_code=404, detail="Álbum no encontrado")

    cursor.execute("""
        SELECT s.*, a.name as artist_name, a.avatar_url as artist_avatar,
               CASE WHEN f.song_id IS NOT NULL THEN 1 ELSE 0 END as is_favorite
        FROM songs s
        JOIN artists a ON s.artist_id = a.id
        LEFT JOIN favorites f ON s.id = f.song_id
        WHERE s.album_id = ?
        ORDER BY s.track_number ASC, s.id ASC
    """, (album_id,))
    songs = cursor.fetchall()
    conn.close()

    total_duration = sum(s["duration"] for s in songs)

    return {
        "album": {
            "id": album["id"],
            "title": album["title"],
            "artist_id": album["artist_id"],
            "artist_name": album["artist_name"],
            "artist_avatar": album["artist_avatar"],
            "cover_url": album["cover_url"] or "/static/assets/default_cover.png",
            "release_year": album["release_year"],
            "genre": album["genre"],
            "type": album["type"],
            "tracks_count": len(songs),
            "total_duration": total_duration,
            "created_at": str(album["created_at"])
        },
        "songs": [
            SongResponse(
                id=s["id"],
                title=s["title"],
                artist_id=s["artist_id"],
                artist_name=s["artist_name"],
                artist_avatar=s["artist_avatar"],
                album=album["title"],
                genre=s["genre"] or album["genre"],
                duration=s["duration"] or 0,
                audio_url=s["audio_url"],
                cover_url=s["cover_url"] or album["cover_url"],
                streams_count=s["streams_count"],
                release_date=s["release_date"] or album["release_year"],
                is_favorite=bool(s["is_favorite"])
            )
            for s in songs
        ]
    }

@router.post("")
def create_album(
    title: str = Form(...),
    artist_id: int = Form(...),
    genre: Optional[str] = Form("Pop"),
    release_year: Optional[str] = Form("2026"),
    album_type: Optional[str] = Form("album"), # 'album', 'ep', 'single'
    cover_file: Optional[UploadFile] = File(None)
):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM artists WHERE id = ?", (artist_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Artista no encontrado")

    cover_url = "/static/assets/default_cover.png"
    if cover_file and cover_file.filename:
        ext = Path(cover_file.filename).suffix or ".jpg"
        filename = f"album_{uuid.uuid4().hex}{ext}"
        filepath = COVERS_DIR / filename
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(cover_file.file, buffer)
        cover_url = f"/uploads/covers/{filename}"

    cursor.execute("""
        INSERT INTO albums (title, artist_id, cover_url, release_year, genre, type)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (title, artist_id, cover_url, release_year or "2026", genre or "Pop", album_type or "album"))
    new_id = cursor.lastrowid
    conn.commit()

    cursor.execute("SELECT * FROM albums WHERE id = ?", (new_id,))
    r = cursor.fetchone()
    conn.close()

    return dict(r)
