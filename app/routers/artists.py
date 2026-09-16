import os
import shutil
import uuid
from pathlib import Path
from typing import Optional, List
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query
from app.database import get_db_connection
from app.models import ArtistResponse, ArtistCreate, SongResponse

router = APIRouter(prefix="/api/artists", tags=["artists"])

BASE_DIR = Path(__file__).resolve().parent.parent.parent
COVERS_DIR = BASE_DIR / "uploads" / "covers"
COVERS_DIR.mkdir(parents=True, exist_ok=True)

@router.get("", response_model=List[ArtistResponse])
def get_artists(user_id: str = Query("guest")):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT a.*,
               COUNT(DISTINCT af.id) as followers_count,
               CASE WHEN EXISTS(SELECT 1 FROM artist_followers WHERE artist_id = a.id AND user_id = ?) THEN 1 ELSE 0 END as is_following
        FROM artists a
        LEFT JOIN artist_followers af ON a.id = af.artist_id
        GROUP BY a.id
        ORDER BY a.monthly_listeners DESC, a.id DESC
    """, (user_id,))
    rows = cursor.fetchall()
    conn.close()

    return [
        ArtistResponse(
            id=r["id"],
            name=r["name"],
            bio=r["bio"] or "",
            genre=r["genre"] or "Pop",
            avatar_url=r["avatar_url"] or "/static/assets/default_avatar.png",
            banner_url=r["banner_url"] or "",
            monthly_listeners=r["monthly_listeners"] or 0,
            followers_count=r["followers_count"] or 0,
            is_following=bool(r["is_following"]),
            storage_used_bytes=r["storage_used_bytes"] if "storage_used_bytes" in r.keys() and r["storage_used_bytes"] else 0,
            storage_limit_bytes=10737418240,
            verified=r["verified"] or 1,
            created_at=str(r["created_at"])
        )
        for r in rows
    ]

@router.get("/following", response_model=List[ArtistResponse])
def get_followed_artists(user_id: str = Query("guest")):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT a.*,
               COUNT(DISTINCT af_all.id) as followers_count,
               1 as is_following
        FROM artists a
        JOIN artist_followers af ON a.id = af.artist_id AND af.user_id = ?
        LEFT JOIN artist_followers af_all ON a.id = af_all.artist_id
        GROUP BY a.id
        ORDER BY af.created_at DESC
    """, (user_id,))
    rows = cursor.fetchall()
    conn.close()

    return [
        ArtistResponse(
            id=r["id"],
            name=r["name"],
            bio=r["bio"] or "",
            genre=r["genre"] or "Pop",
            avatar_url=r["avatar_url"] or "/static/assets/default_avatar.png",
            banner_url=r["banner_url"] or "",
            monthly_listeners=r["monthly_listeners"] or 0,
            followers_count=r["followers_count"] or 0,
            is_following=True,
            storage_used_bytes=r["storage_used_bytes"] if "storage_used_bytes" in r.keys() and r["storage_used_bytes"] else 0,
            storage_limit_bytes=10737418240,
            verified=r["verified"] or 1,
            created_at=str(r["created_at"])
        )
        for r in rows
    ]

@router.post("/{artist_id}/follow")
def toggle_follow_artist(artist_id: int, user_id: str = Query("guest")):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM artists WHERE id = ?", (artist_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Artista no encontrado")

    cursor.execute("SELECT id FROM artist_followers WHERE artist_id = ? AND user_id = ?", (artist_id, user_id))
    existing = cursor.fetchone()

    if existing:
        cursor.execute("DELETE FROM artist_followers WHERE artist_id = ? AND user_id = ?", (artist_id, user_id))
        is_following = False
        message = "Dejaste de seguir al artista"
    else:
        cursor.execute("INSERT INTO artist_followers (artist_id, user_id) VALUES (?, ?)", (artist_id, user_id))
        is_following = True
        message = "Siguiendo al artista"

    conn.commit()

    cursor.execute("SELECT COUNT(*) as count FROM artist_followers WHERE artist_id = ?", (artist_id,))
    total_followers = cursor.fetchone()["count"]
    conn.close()

    return {
        "is_following": is_following,
        "followers_count": total_followers,
        "message": message
    }

@router.get("/{artist_id}")
def get_artist(artist_id: int, user_id: str = Query("guest")):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT a.*,
               COUNT(DISTINCT af.id) as followers_count,
               CASE WHEN EXISTS(SELECT 1 FROM artist_followers WHERE artist_id = a.id AND user_id = ?) THEN 1 ELSE 0 END as is_following
        FROM artists a
        LEFT JOIN artist_followers af ON a.id = af.artist_id
        WHERE a.id = ?
        GROUP BY a.id
    """, (user_id, artist_id))
    artist = cursor.fetchone()
    if not artist:
        conn.close()
        raise HTTPException(status_code=404, detail="Artista no encontrado")

    cursor.execute("""
        SELECT s.*, a.name as artist_name, a.avatar_url as artist_avatar,
               COALESCE(al.title, s.album) as album_name,
               CASE WHEN f.song_id IS NOT NULL THEN 1 ELSE 0 END as is_favorite
        FROM songs s
        JOIN artists a ON s.artist_id = a.id
        LEFT JOIN albums al ON s.album_id = al.id
        LEFT JOIN favorites f ON s.id = f.song_id
        WHERE s.artist_id = ?
        ORDER BY s.streams_count DESC
    """, (artist_id,))
    songs = cursor.fetchall()

    # Fetch artist albums
    cursor.execute("""
        SELECT al.*, COUNT(s.id) as tracks_count
        FROM albums al
        LEFT JOIN songs s ON al.id = s.album_id
        WHERE al.artist_id = ?
        GROUP BY al.id
        ORDER BY al.release_year DESC, al.id DESC
    """, (artist_id,))
    albums = cursor.fetchall()

    conn.close()

    songs_list = [
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
        for r in songs
    ]

    albums_list = [
        {
            "id": al["id"],
            "title": al["title"],
            "cover_url": al["cover_url"] or "/static/assets/default_cover.png",
            "release_year": al["release_year"],
            "genre": al["genre"],
            "type": al["type"],
            "tracks_count": al["tracks_count"]
        }
        for al in albums
    ]

    return {
        "artist": ArtistResponse(
            id=artist["id"],
            name=artist["name"],
            bio=artist["bio"] or "",
            genre=artist["genre"] or "Pop",
            avatar_url=artist["avatar_url"] or "/static/assets/default_avatar.png",
            banner_url=artist["banner_url"] or "",
            monthly_listeners=artist["monthly_listeners"] or 0,
            followers_count=artist["followers_count"] or 0,
            is_following=bool(artist["is_following"]),
            storage_used_bytes=artist["storage_used_bytes"] if "storage_used_bytes" in artist.keys() and artist["storage_used_bytes"] else 0,
            storage_limit_bytes=10737418240,
            verified=artist["verified"] or 1,
            created_at=str(artist["created_at"])
        ),
        "songs": songs_list,
        "albums": albums_list
    }

@router.post("", response_model=ArtistResponse)
def create_artist(
    name: str = Form(...),
    bio: Optional[str] = Form(""),
    genre: Optional[str] = Form("Pop"),
    avatar_file: Optional[UploadFile] = File(None),
    banner_file: Optional[UploadFile] = File(None)
):
    avatar_url = "/static/assets/default_avatar.png"
    banner_url = ""

    if avatar_file and avatar_file.filename:
        ext = Path(avatar_file.filename).suffix or ".jpg"
        filename = f"avatar_{uuid.uuid4().hex}{ext}"
        filepath = COVERS_DIR / filename
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(avatar_file.file, buffer)
        avatar_url = f"/uploads/covers/{filename}"

    if banner_file and banner_file.filename:
        ext = Path(banner_file.filename).suffix or ".jpg"
        filename = f"banner_{uuid.uuid4().hex}{ext}"
        filepath = COVERS_DIR / filename
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(banner_file.file, buffer)
        banner_url = f"/uploads/covers/{filename}"

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO artists (name, bio, genre, avatar_url, banner_url, monthly_listeners, verified, storage_used_bytes)
        VALUES (?, ?, ?, ?, ?, 120, 1, 0)
    """, (name, bio or "", genre or "Pop", avatar_url, banner_url))
    new_id = cursor.lastrowid
    conn.commit()

    cursor.execute("SELECT * FROM artists WHERE id = ?", (new_id,))
    r = cursor.fetchone()
    conn.close()

    return ArtistResponse(
        id=r["id"],
        name=r["name"],
        bio=r["bio"] or "",
        genre=r["genre"] or "Pop",
        avatar_url=r["avatar_url"] or "/static/assets/default_avatar.png",
        banner_url=r["banner_url"] or "",
        monthly_listeners=r["monthly_listeners"] or 0,
        followers_count=0,
        is_following=False,
        storage_used_bytes=0,
        storage_limit_bytes=10737418240,
        verified=r["verified"] or 1,
        created_at=str(r["created_at"])
    )

@router.put("/{artist_id}")
def update_artist_profile(
    artist_id: int,
    name: Optional[str] = Form(None),
    bio: Optional[str] = Form(None),
    genre: Optional[str] = Form(None),
    avatar_file: Optional[UploadFile] = File(None),
    banner_file: Optional[UploadFile] = File(None)
):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM artists WHERE id = ?", (artist_id,))
    artist = cursor.fetchone()
    if not artist:
        conn.close()
        raise HTTPException(status_code=404, detail="Artista no encontrado")

    updated_name = name if name is not None else artist["name"]
    updated_bio = bio if bio is not None else artist["bio"]
    updated_genre = genre if genre is not None else artist["genre"]
    updated_avatar = artist["avatar_url"]
    updated_banner = artist["banner_url"]

    if avatar_file and avatar_file.filename:
        ext = Path(avatar_file.filename).suffix or ".jpg"
        filename = f"avatar_{uuid.uuid4().hex}{ext}"
        filepath = COVERS_DIR / filename
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(avatar_file.file, buffer)
        updated_avatar = f"/uploads/covers/{filename}"

    if banner_file and banner_file.filename:
        ext = Path(banner_file.filename).suffix or ".jpg"
        filename = f"banner_{uuid.uuid4().hex}{ext}"
        filepath = COVERS_DIR / filename
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(banner_file.file, buffer)
        updated_banner = f"/uploads/covers/{filename}"

    cursor.execute("""
        UPDATE artists
        SET name = ?, bio = ?, genre = ?, avatar_url = ?, banner_url = ?
        WHERE id = ?
    """, (updated_name, updated_bio, updated_genre, updated_avatar, updated_banner, artist_id))
    conn.commit()
    conn.close()

    return {"message": "Perfil de artista actualizado"}

@router.get("/{artist_id}/analytics")
def get_artist_analytics(artist_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM artists WHERE id = ?", (artist_id,))
    artist = cursor.fetchone()
    if not artist:
        conn.close()
        raise HTTPException(status_code=404, detail="Artista no encontrado")

    cursor.execute("SELECT * FROM songs WHERE artist_id = ? ORDER BY streams_count DESC", (artist_id,))
    songs = cursor.fetchall()

    cursor.execute("SELECT COUNT(*) as count FROM albums WHERE artist_id = ?", (artist_id,))
    albums_count = cursor.fetchone()["count"]

    total_streams = sum(s["streams_count"] for s in songs)
    total_tracks = len(songs)

    cursor.execute("""
        SELECT COUNT(f.song_id) as total_likes
        FROM favorites f
        JOIN songs s ON f.song_id = s.id
        WHERE s.artist_id = ?
    """, (artist_id,))
    likes_row = cursor.fetchone()
    total_likes = likes_row["total_likes"] if likes_row else 0

    conn.close()

    storage_used = artist["storage_used_bytes"] if "storage_used_bytes" in artist.keys() and artist["storage_used_bytes"] else 0
    storage_limit = 10737418240  # 10 GB

    return {
        "artist_name": artist["name"],
        "monthly_listeners": artist["monthly_listeners"],
        "total_streams": total_streams,
        "total_tracks": total_tracks,
        "total_albums": albums_count,
        "total_likes": total_likes,
        "storage_used_bytes": storage_used,
        "storage_limit_bytes": storage_limit,
        "storage_used_mb": round(storage_used / (1024 * 1024), 2),
        "storage_limit_mb": 10240,
        "storage_percent": round((storage_used / storage_limit) * 100, 2) if storage_limit > 0 else 0,
        "tracks": [dict(s) for s in songs]
    }
