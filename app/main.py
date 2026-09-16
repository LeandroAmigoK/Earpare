from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
from app.database import init_db
from app.seed_data import seed
from app.routers import songs, artists, playlists, auth, albums, search

BASE_DIR = Path(__file__).resolve().parent.parent

app = FastAPI(title="EarRape - Spotify & GTA World Music API")

# Mount upload media files and static frontend files
app.mount("/uploads", StaticFiles(directory=str(BASE_DIR / "uploads")), name="uploads")
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

# Include API Routers
app.include_router(songs.router)
app.include_router(artists.router)
app.include_router(albums.router)
app.include_router(playlists.router)
app.include_router(auth.router)
app.include_router(search.router)

@app.on_event("startup")
def on_startup():
    init_db()
    seed()

@app.get("/")
def serve_index():
    return FileResponse(str(BASE_DIR / "static" / "index.html"))

@app.get("/{full_path:path}")
def catch_all(full_path: str):
    return FileResponse(str(BASE_DIR / "static" / "index.html"))
