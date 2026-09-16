from pydantic import BaseModel
from typing import Optional, List

class ArtistBase(BaseModel):
    name: str
    bio: Optional[str] = ""
    genre: Optional[str] = "Pop"
    avatar_url: Optional[str] = ""
    banner_url: Optional[str] = ""

class ArtistCreate(ArtistBase):
    pass

class ArtistResponse(ArtistBase):
    id: int
    monthly_listeners: int
    followers_count: Optional[int] = 0
    is_following: Optional[bool] = False
    storage_used_bytes: Optional[int] = 0
    storage_limit_bytes: Optional[int] = 10737418240  # 10 GB
    verified: int
    created_at: str

class SongResponse(BaseModel):
    id: int
    title: str
    artist_id: int
    artist_name: Optional[str] = ""
    artist_avatar: Optional[str] = ""
    album: Optional[str] = ""
    genre: Optional[str] = ""
    duration: int
    audio_url: str
    cover_url: Optional[str] = ""
    lyrics: Optional[str] = ""
    streams_count: int
    release_date: Optional[str] = ""
    is_favorite: Optional[bool] = False

class PlaylistCreate(BaseModel):
    name: str
    description: Optional[str] = ""

class PlaylistResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = ""
    cover_url: Optional[str] = ""
    is_favorite_system: int
    tracks_count: Optional[int] = 0
    created_at: str

class PlaylistTrackAdd(BaseModel):
    song_id: int
