import os
import shutil
import uuid
from pathlib import Path
from typing import Optional, List
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from app.database import get_db_connection
from app.models import PlaylistCreate, PlaylistResponse, SongResponse, PlaylistTrackAdd

router = APIRouter(prefix="/api", tags=["playlists"])

BASE_DIR = Path(__file__).resolve().parent.parent.parent
COVERS_DIR = BASE_DIR / "uploads" / "covers"
COVERS_DIR.mkdir(parents=True, exist_ok=True)

@router.get("/playlists", response_model=List[PlaylistResponse])
def get_playlists():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT p.*, COUNT(pt.song_id) as tracks_count
        FROM playlists p
        LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
        GROUP BY p.id
        ORDER BY p.is_favorite_system DESC, p.id DESC
    """)
    rows = cursor.fetchall()
    conn.close()

    return [
        PlaylistResponse(
            id=r["id"],
            name=r["name"],
            description=r["description"] or "",
            cover_url=r["cover_url"] or "/static/assets/default_playlist.png",
            is_favorite_system=r["is_favorite_system"] or 0,
            tracks_count=r["tracks_count"] or 0,
            created_at=str(r["created_at"])
        )
        for r in rows
    ]

@router.post("/playlists", response_model=PlaylistResponse)
def create_playlist(
    name: str = Form(...),
    description: Optional[str] = Form(""),
    cover_file: Optional[UploadFile] = File(None)
):
    cover_url = "/static/assets/default_playlist.png"
    if cover_file and cover_file.filename:
        ext = Path(cover_file.filename).suffix or ".jpg"
        filename = f"playlist_{uuid.uuid4().hex}{ext}"
        filepath = COVERS_DIR / filename
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(cover_file.file, buffer)
        cover_url = f"/uploads/covers/{filename}"

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO playlists (name, description, cover_url, is_favorite_system)
        VALUES (?, ?, ?, 0)
    """, (name, description or "", cover_url))
    new_id = cursor.lastrowid
    conn.commit()

    cursor.execute("SELECT * FROM playlists WHERE id = ?", (new_id,))
    r = cursor.fetchone()
    conn.close()

    return PlaylistResponse(
        id=r["id"],
        name=r["name"],
        description=r["description"] or "",
        cover_url=r["cover_url"] or "/static/assets/default_playlist.png",
        is_favorite_system=r["is_favorite_system"] or 0,
        tracks_count=0,
        created_at=str(r["created_at"])
    )

@router.get("/playlists/{playlist_id}")
def get_playlist(playlist_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM playlists WHERE id = ?", (playlist_id,))
    playlist = cursor.fetchone()
    if not playlist:
        conn.close()
        raise HTTPException(status_code=404, detail="Playlist no encontrada")

    cursor.execute("""
        SELECT s.*, a.name as artist_name, a.avatar_url as artist_avatar,
               CASE WHEN f.song_id IS NOT NULL THEN 1 ELSE 0 END as is_favorite
        FROM playlist_tracks pt
        JOIN songs s ON pt.song_id = s.id
        JOIN artists a ON s.artist_id = a.id
        LEFT JOIN favorites f ON s.id = f.song_id
        WHERE pt.playlist_id = ?
        ORDER BY pt.added_at DESC
    """, (playlist_id,))
    tracks = cursor.fetchall()
    conn.close()

    tracks_list = [
        SongResponse(
            id=r["id"],
            title=r["title"],
            artist_id=r["artist_id"],
            artist_name=r["artist_name"],
            artist_avatar=r["artist_avatar"],
            album=r["album"] or "",
            genre=r["genre"] or "",
            duration=r["duration"] or 0,
            audio_url=r["audio_url"],
            cover_url=r["cover_url"] or "",
            streams_count=r["streams_count"],
            release_date=r["release_date"] or "",
            is_favorite=bool(r["is_favorite"])
        )
        for r in tracks
    ]

    return {
        "playlist": PlaylistResponse(
            id=playlist["id"],
            name=playlist["name"],
            description=playlist["description"] or "",
            cover_url=playlist["cover_url"] or "/static/assets/default_playlist.png",
            is_favorite_system=playlist["is_favorite_system"] or 0,
            tracks_count=len(tracks_list),
            created_at=str(playlist["created_at"])
        ),
        "tracks": tracks_list
    }

@router.post("/playlists/{playlist_id}/tracks")
def add_track_to_playlist(playlist_id: int, payload: PlaylistTrackAdd):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT OR IGNORE INTO playlist_tracks (playlist_id, song_id)
            VALUES (?, ?)
        """, (playlist_id, payload.song_id))
        conn.commit()
    finally:
        conn.close()
    return {"message": "Canción añadida a la playlist"}

@router.delete("/playlists/{playlist_id}/tracks/{song_id}")
def remove_track_from_playlist(playlist_id: int, song_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        DELETE FROM playlist_tracks WHERE playlist_id = ? AND song_id = ?
    """, (playlist_id, song_id))
    conn.commit()
    conn.close()
    return {"message": "Canción removida de la playlist"}

@router.delete("/playlists/{playlist_id}")
def delete_playlist(playlist_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT is_favorite_system FROM playlists WHERE id = ?", (playlist_id,))
    r = cursor.fetchone()
    if r and r["is_favorite_system"]:
        conn.close()
        raise HTTPException(status_code=400, detail="No se puede eliminar la playlist de favoritos del sistema")

    cursor.execute("DELETE FROM playlists WHERE id = ?", (playlist_id,))
    conn.commit()
    conn.close()
    return {"message": "Playlist eliminada"}

@router.put("/playlists/{playlist_id}")
def update_playlist(
    playlist_id: int,
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    cover_file: Optional[UploadFile] = File(None)
):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM playlists WHERE id = ?", (playlist_id,))
    playlist = cursor.fetchone()
    if not playlist:
        conn.close()
        raise HTTPException(status_code=404, detail="Playlist no encontrada")

    updated_name = name if name is not None else playlist["name"]
    updated_desc = description if description is not None else playlist["description"]
    updated_cover = playlist["cover_url"]

    if cover_file and cover_file.filename:
        ext = Path(cover_file.filename).suffix or ".jpg"
        filename = f"playlist_{uuid.uuid4().hex}{ext}"
        filepath = COVERS_DIR / filename
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(cover_file.file, buffer)
        updated_cover = f"/uploads/covers/{filename}"

    cursor.execute("""
        UPDATE playlists
        SET name = ?, description = ?, cover_url = ?
        WHERE id = ?
    """, (updated_name, updated_desc, updated_cover, playlist_id))
    conn.commit()
    conn.close()
    return {"message": "Playlist actualizada exitosamente", "cover_url": updated_cover}

@router.post("/playlists/{playlist_id}/cover")
def upload_playlist_cover(
    playlist_id: int,
    cover_file: UploadFile = File(...)
):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM playlists WHERE id = ?", (playlist_id,))
    playlist = cursor.fetchone()
    if not playlist:
        conn.close()
        raise HTTPException(status_code=404, detail="Playlist no encontrada")

    ext = Path(cover_file.filename).suffix or ".jpg"
    filename = f"playlist_{uuid.uuid4().hex}{ext}"
    filepath = COVERS_DIR / filename
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(cover_file.file, buffer)
    cover_url = f"/uploads/covers/{filename}"

    cursor.execute("UPDATE playlists SET cover_url = ? WHERE id = ?", (cover_url, playlist_id))
    conn.commit()
    conn.close()
    return {"message": "Portada de playlist actualizada", "cover_url": cover_url}

# --- Favorites Endpoints ---
@router.post("/favorites/toggle")
def toggle_favorite(payload: PlaylistTrackAdd):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT song_id FROM favorites WHERE song_id = ?", (payload.song_id,))
    fav = cursor.fetchone()

    is_fav = False
    if fav:
        cursor.execute("DELETE FROM favorites WHERE song_id = ?", (payload.song_id,))
        is_fav = False
    else:
        cursor.execute("INSERT INTO favorites (song_id) VALUES (?)", (payload.song_id,))
        is_fav = True

    conn.commit()
    conn.close()
    return {"is_favorite": is_fav}

@router.get("/favorites", response_model=List[SongResponse])
def get_favorites():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT s.*, a.name as artist_name, a.avatar_url as artist_avatar, 1 as is_favorite
        FROM favorites f
        JOIN songs s ON f.song_id = s.id
        JOIN artists a ON s.artist_id = a.id
        ORDER BY f.added_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()

    return [
        SongResponse(
            id=r["id"],
            title=r["title"],
            artist_id=r["artist_id"],
            artist_name=r["artist_name"],
            artist_avatar=r["artist_avatar"],
            album=r["album"] or "",
            genre=r["genre"] or "",
            duration=r["duration"] or 0,
            audio_url=r["audio_url"],
            cover_url=r["cover_url"] or "",
            streams_count=r["streams_count"],
            release_date=r["release_date"] or "",
            is_favorite=True
        )
        for r in rows
    ]
