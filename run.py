import uvicorn
import os

if __name__ == "__main__":
    print("Iniciando SoundFlow (Spotify Clone + GTA World OAuth & Artist Portal)...")
    print("Abre tu navegador en: http://localhost:8080")
    uvicorn.run("app.main:app", host="127.0.0.1", port=8080, reload=True)
