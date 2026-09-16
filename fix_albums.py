from app.database import get_db_connection

def fix_albums():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT id FROM albums WHERE title = 'Neural Matrix'")
    row = c.fetchone()
    if row:
        c.execute("UPDATE songs SET album_id = ?, track_number = 1 WHERE title = 'Overclocked Protocol'", (row["id"],))
        c.execute("UPDATE songs SET album_id = ?, track_number = 2 WHERE title = 'Neon Velocity'", (row["id"],))
    conn.commit()
    conn.close()
    print("Album links updated cleanly.")

if __name__ == "__main__":
    fix_albums()
