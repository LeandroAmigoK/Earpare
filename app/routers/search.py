from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Query
from app.database import get_db_connection

router = APIRouter(prefix="/api/search", tags=["search"])

@router.get("")
def global_search(q: str = Query(..., min_length=1)) -> Dict[str, Any]:
    term = f"%{q.strip()}%"
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Search Songs
    cursor.execute("""
        SELECT s.*, a.name as artist_name, a.avatar_url as artist_avatar,
               COALESCE(al.title, s.album) as album_name,
               CASE WHEN f.song_id IS NOT NULL THEN 1 ELSE 0 END as is_favorite
        FROM songs s
        JOIN artists a ON s.artist_id = a.id
        LEFT JOIN albums al ON s.album_id = al.id
        LEFT JOIN favorites f ON s.id = f.song_id
        WHERE s.title LIKE ? OR a.name LIKE ? OR s.genre LIKE ? OR al.title LIKE ?
        ORDER BY s.streams_count DESC, s.id DESC
        LIMIT 15
    """, (term, term, term, term))
    songs_raw = cursor.fetchall()
    songs = [
        {
            "id": r["id"],
            "title": r["title"],
            "artist_id": r["artist_id"],
            "artist_name": r["artist_name"],
            "artist_avatar": r["artist_avatar"],
            "album": r["album_name"] or "Single",
            "album_id": r["album_id"],
            "duration": r["duration"],
            "genre": r["genre"],
            "audio_url": r["audio_url"],
            "cover_url": r["cover_url"] or "/static/assets/default_cover.png",
            "streams_count": r["streams_count"] or 0,
            "is_favorite": bool(r["is_favorite"])
        }
        for r in songs_raw
    ]

    # 2. Search Artists
    cursor.execute("""
        SELECT * FROM artists
        WHERE name LIKE ? OR genre LIKE ?
        ORDER BY monthly_listeners DESC, id DESC
        LIMIT 8
    """, (term, term))
    artists_raw = cursor.fetchall()
    artists = [
        {
            "id": r["id"],
            "name": r["name"],
            "bio": r["bio"] or "",
            "genre": r["genre"] or "Música",
            "avatar_url": r["avatar_url"] or "/static/assets/default_avatar.png",
            "monthly_listeners": r["monthly_listeners"] or 0,
            "verified": bool(r["verified"])
        }
        for r in artists_raw
    ]

    # 3. Search Albums
    cursor.execute("""
        SELECT al.*, a.name as artist_name, a.avatar_url as artist_avatar,
               COUNT(s.id) as tracks_count
        FROM albums al
        JOIN artists a ON al.artist_id = a.id
        LEFT JOIN songs s ON al.id = s.album_id
        WHERE al.title LIKE ? OR a.name LIKE ? OR al.genre LIKE ?
        GROUP BY al.id
        ORDER BY al.id DESC
        LIMIT 8
    """, (term, term, term))
    albums_raw = cursor.fetchall()
    albums = [
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
            "tracks_count": r["tracks_count"]
        }
        for r in albums_raw
    ]

    conn.close()

    # Determine Top Result: prioritize artist if name starts with query
    top_result = None
    prefix_artist = next((a for a in artists if a["name"].lower().startswith(q.strip().lower())), None)
    if prefix_artist:
        top_result = {"type": "artist", "data": prefix_artist}
    elif songs:
        top_result = {"type": "song", "data": songs[0]}
    elif artists:
        top_result = {"type": "artist", "data": artists[0]}
    elif albums:
        top_result = {"type": "album", "data": albums[0]}

    return {
        "query": q,
        "top_result": top_result,
        "songs": songs,
        "artists": artists,
        "albums": albums
    }
