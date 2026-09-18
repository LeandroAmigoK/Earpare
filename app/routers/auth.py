import os
from pathlib import Path
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import RedirectResponse
import requests
from app.database import get_db_connection

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Configuration (Replace with credentials given by GTA World Staff)
CLIENT_ID = os.getenv("GTAW_CLIENT_ID", "YOUR_CLIENT_ID")
CLIENT_SECRET = os.getenv("GTAW_CLIENT_SECRET", "YOUR_CLIENT_SECRET")
REDIRECT_URI = os.getenv("GTAW_REDIRECT_URI", "http://localhost:8000/api/auth/callback")

AUTH_URL = "https://pcu-es.gta.world/oauth/authorize"
TOKEN_URL = "https://pcu-es.gta.world/oauth/token"
USER_API_URL = "https://pcu-es.gta.world/api/user"

@router.get("/config")
def get_auth_config():
    return {
        "is_configured": CLIENT_ID != "YOUR_CLIENT_ID",
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI
    }

@router.get("/login")
def login():
    """Redirects the user to GTA World PCU OAuth Authorize page"""
    if not CLIENT_ID or CLIENT_ID == "YOUR_CLIENT_ID":
        return RedirectResponse(url="/?auth_warning=config_needed")
    
    url = f"{AUTH_URL}?client_id={CLIENT_ID}&redirect_uri={REDIRECT_URI}&response_type=code&scope="
    return RedirectResponse(url=url)

@router.get("/callback")
def callback(code: Optional[str] = None, error: Optional[str] = None):
    """Handles OAuth callback from PCU"""
    if error or not code:
        return RedirectResponse(url="/?error=auth_denied")

    # Exchange code for access token
    payload = {
        "grant_type": "authorization_code",
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "redirect_uri": REDIRECT_URI,
        "code": code
    }

    try:
        token_res = requests.post(TOKEN_URL, data=payload, timeout=10)
        token_data = token_res.json()
        access_token = token_data.get("access_token")

        if not access_token:
            return RedirectResponse(url="/?error=token_failed")

        # Fetch user & character details from GTA World API
        user_res = requests.get(USER_API_URL, headers={"Authorization": f"Bearer {access_token}"}, timeout=10)
        api_data = user_res.json()
        user_info = api_data.get("user", {})

        pcu_user_id = user_info.get("id")
        username = user_info.get("username", "Usuario")
        characters = user_info.get("character", [])

        # Persist user & characters in SQLite
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("INSERT OR IGNORE INTO pcu_users (pcu_id, username) VALUES (?, ?)", (pcu_user_id, username))
        cursor.execute("SELECT id FROM pcu_users WHERE pcu_id = ?", (pcu_user_id,))
        local_user_id = cursor.fetchone()["id"]

        for char in characters:
            char_id = char.get("id")
            first = char.get("firstname", "")
            last = char.get("lastname", "")
            char_name = f"{first} {last}".strip()

            # Ensure an artist profile exists for this character
            cursor.execute("SELECT id FROM artists WHERE name = ?", (char_name,))
            existing_artist = cursor.fetchone()
            if not existing_artist:
                cursor.execute("""
                    INSERT INTO artists (name, bio, genre, avatar_url, monthly_listeners, verified)
                    VALUES (?, 'Artista oficial verificado de Los Santos', 'General', '/static/assets/default_avatar.png', 50, 1)
                """, (char_name,))
                artist_id = cursor.lastrowid
            else:
                artist_id = existing_artist["id"]

            cursor.execute("""
                INSERT OR REPLACE INTO pcu_characters (pcu_char_id, user_id, firstname, lastname, artist_id)
                VALUES (?, ?, ?, ?, ?)
            """, (char_id, local_user_id, first, last, artist_id))

        conn.commit()
        conn.close()

        response = RedirectResponse(url="/?login=success")
        response.set_cookie(key="pcu_user_id", value=str(pcu_user_id), max_age=86400 * 7, httponly=False)
        return response

    except Exception as e:
        print(f"Error during OAuth callback: {e}")
        return RedirectResponse(url="/?error=server_error")

@router.get("/me")
def get_current_user(request: Request):
    """Returns currently authenticated PCU user and their characters"""
    pcu_user_id = request.cookies.get("pcu_user_id")
    if not pcu_user_id:
        return {"authenticated": False}

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM pcu_users WHERE pcu_id = ?", (pcu_user_id,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        return {"authenticated": False}

    cursor.execute("""
        SELECT c.*, a.id as artist_id, a.name as artist_name, a.avatar_url, a.monthly_listeners
        FROM pcu_characters c
        LEFT JOIN artists a ON c.artist_id = a.id
        WHERE c.user_id = ?
    """, (user["id"],))
    chars = cursor.fetchall()
    conn.close()

    return {
        "authenticated": True,
        "pcu_id": user["pcu_id"],
        "username": user["username"],
        "characters": [
            {
                "id": c["id"],
                "pcu_char_id": c["pcu_char_id"],
                "firstname": c["firstname"],
                "lastname": c["lastname"],
                "fullname": f"{c['firstname']} {c['lastname']}".strip(),
                "artist_id": c["artist_id"],
                "avatar_url": c["avatar_url"]
            }
            for c in chars
        ]
    }

@router.post("/demo-login")
def demo_login(response: Response):
    """Mock/Demo login for development testing before official keys arrive"""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("INSERT OR IGNORE INTO pcu_users (pcu_id, username) VALUES (?, ?)", (9999, "Johnny_Tester"))
    cursor.execute("SELECT id FROM pcu_users WHERE pcu_id = 9999")
    local_user_id = cursor.fetchone()["id"]

    demo_chars = [
        {"id": 101, "first": "Johnny", "last": "Parker", "genre": "Synthwave"},
        {"id": 102, "first": "Angela", "last": "Rosetti", "genre": "Indie Pop"}
    ]

    for char in demo_chars:
        char_name = f"{char['first']} {char['last']}"
        cursor.execute("SELECT id FROM artists WHERE name = ?", (char_name,))
        existing_artist = cursor.fetchone()
        if not existing_artist:
            cursor.execute("""
                INSERT INTO artists (name, bio, genre, avatar_url, monthly_listeners, verified)
                VALUES (?, 'Artista verificado de Los Santos (GTA World)', ?, '/static/assets/default_avatar.png', 12500, 1)
            """, (char_name, char['genre']))
            artist_id = cursor.lastrowid
        else:
            artist_id = existing_artist["id"]

        cursor.execute("""
            INSERT OR REPLACE INTO pcu_characters (pcu_char_id, user_id, firstname, lastname, artist_id)
            VALUES (?, ?, ?, ?, ?)
        """, (char["id"], local_user_id, char["first"], char["last"], artist_id))

    conn.commit()
    conn.close()

    response.set_cookie(key="pcu_user_id", value="9999", max_age=86400 * 7, httponly=False)
    return {"status": "ok", "message": "Sesión demo iniciada"}

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key="pcu_user_id")
    return {"status": "ok"}
