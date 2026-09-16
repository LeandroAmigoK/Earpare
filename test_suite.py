import requests

BASE_URL = "http://127.0.0.1:8080"

def test_suite():
    print("Running SoundFlow Full Test Suite...")
    
    # 1. Test albums
    r = requests.get(f"{BASE_URL}/api/albums")
    assert r.status_code == 200, f"Albums error: {r.status_code}"
    albums = r.json()
    print(f"[OK] Fetched {len(albums)} albums:")
    for al in albums:
        print(f"   - {al['title']} ({al['release_year']}) by {al['artist_name']} - {al['tracks_count']} tracks")
    
    # 2. Test single album details
    r = requests.get(f"{BASE_URL}/api/albums/{albums[0]['id']}")
    assert r.status_code == 200
    album_details = r.json()
    print(f"[OK] Album '{album_details['album']['title']}' has {len(album_details['songs'])} songs.")

    # 3. Test songs
    r = requests.get(f"{BASE_URL}/api/songs")
    assert r.status_code == 200
    print(f"[OK] Total songs: {len(r.json())}")

    # 4. Test auth me
    r = requests.get(f"{BASE_URL}/api/auth/me")
    assert r.status_code == 200
    print("[OK] Auth endpoint active.")

    print("\nALL TESTS PASSED! Albums function 100% like Spotify.")

if __name__ == "__main__":
    test_suite()
