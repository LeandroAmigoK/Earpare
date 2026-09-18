class SoundFlowApp {
  constructor() {
    this.player = new AudioPlayer();
    this.artistPortal = new ArtistPortal(this);
    this.currentRoute = 'home';
    this.allSongs = [];
    this.playlists = [];
    this.albums = [];
    this.followedArtists = [];
    this.selectedMood = 'all';
    this.currentUser = null;
    this.activeCharacter = null;

    this.init();
  }

  async init() {
    try {
    this.setupEventListeners();
    await this.checkAuth();
    await this.loadPlaylists();
    await this.loadFollowedArtists();

    // Deep Linking from Query Params or Hash
    const urlParams = new URLSearchParams(window.location.search);
    const songParam = urlParams.get('song');
    const albumParam = urlParams.get('album');
    const artistParam = urlParams.get('artist');
    const playlistParam = urlParams.get('playlist');
    const hash = window.location.hash ? window.location.hash.replace('#/', '').replace('#', '') : '';

    if (songParam) {
      await this.playTrackById(parseInt(songParam));
      this.navigate('home', false);
    } else if (albumParam) {
      this.navigate(`album/${albumParam}`, false);
    } else if (artistParam) {
      this.navigate(`artist/${artistParam}`, false);
    } else if (playlistParam) {
      this.navigate(`playlist/${playlistParam}`, false);
    } else if (hash) {
      this.navigate(hash, false);
    } else {
      this.navigate('home', false);
    }

    if (urlParams.get('auth_warning') === 'config_needed') {
      this.showToast('⚠️ Configura tu GTAW_CLIENT_ID y GTAW_CLIENT_SECRET en Portainer para conectar con GTA World');
    } else if (urlParams.get('login') === 'success') {
      this.showToast('🎉 ¡Cuenta de GTA World vinculada exitosamente!');
    }

    // Back / Forward Browser History
    window.addEventListener('hashchange', () => {
      const currentHash = window.location.hash.replace('#/', '').replace('#', '');
      if (currentHash && currentHash !== this.currentRoute) {
        this.navigate(currentHash, false);
      }
    });
    } catch(err) {
      console.error('SoundFlowApp init error:', err);
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#0a0a0f;color:#ff4444;display:flex;align-items:center;justify-content:center;flex-direction:column;z-index:99999;font-family:monospace;padding:40px;';
      overlay.innerHTML = '<h2 style="color:#ff4444;margin-bottom:20px">Error al cargar la app</h2><pre style="background:#1a1a2e;padding:20px;border-radius:8px;max-width:800px;overflow:auto;color:#ffaaaa">' + err.stack + '</pre><p style="margin-top:20px;color:#888">Abre DevTools (F12) para más detalles</p>';
      document.body.appendChild(overlay);
    }
  }

  setupEventListeners() {
    document.querySelectorAll('.nav-item[data-route]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const route = el.dataset.route;
        this.navigate(route);
      });
    });

    const formEditPlaylist = document.getElementById('form-edit-playlist');
    if (formEditPlaylist) {
      formEditPlaylist.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-playlist-id').value;
        const name = document.getElementById('edit-playlist-name').value;
        const desc = document.getElementById('edit-playlist-desc').value;
        const coverInput = document.getElementById('edit-playlist-cover');
        const coverFile = coverInput && coverInput.files.length > 0 ? coverInput.files[0] : null;
        await this.updatePlaylist(id, name, desc, coverFile);
        this.closeModals();
      });
    }

    const artistPortalBtn = document.getElementById('btn-open-artist-portal');
    if (artistPortalBtn) {
      artistPortalBtn.addEventListener('click', () => this.navigate('artist-portal'));
    }

    const artistBadge = document.getElementById('artist-sidebar-badge');
    if (artistBadge) {
      artistBadge.addEventListener('click', () => this.navigate('artist-portal'));
    }

    const searchInput = document.getElementById('top-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        if (this.currentRoute !== 'search') {
          this.navigate('search');
        }
        this.handleSearch(e.target.value);
      });
      searchInput.addEventListener('focus', () => {
        if (this.currentRoute !== 'search') {
          this.navigate('search');
        }
      });
    }

    document.querySelectorAll('.modal-close, .modal-backdrop').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target === el) {
          this.closeModals();
        }
      });
    });

    const btnCreatePlaylist = document.getElementById('btn-create-playlist');
    if (btnCreatePlaylist) {
      btnCreatePlaylist.addEventListener('click', () => this.openCreatePlaylistModal());
    }

    const formCreatePlaylist = document.getElementById('form-create-playlist');
    if (formCreatePlaylist) {
      formCreatePlaylist.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('input-playlist-name').value;
        const desc = document.getElementById('input-playlist-desc').value;
        const coverInput = document.getElementById('input-playlist-cover');
        const coverFile = coverInput && coverInput.files.length > 0 ? coverInput.files[0] : null;
        await this.createPlaylist(name, desc, coverFile);
        this.closeModals();
      });
    }
  }

  async checkAuth() {
    const data = await this.fetchAPI('/api/auth/me');
    const authContainer = document.getElementById('auth-user-container');
    if (!authContainer) return;

    if (data && data.authenticated) {
      this.currentUser = data;
      this.activeCharacter = data.characters.length > 0 ? data.characters[0] : null;

      authContainer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; background: rgba(168,85,247,0.12); padding: 5px 14px 5px 8px; border-radius: 500px; border: 1px solid rgba(192,132,252,0.3);">
          <img src="${this.activeCharacter?.avatar_url || '/static/assets/default_avatar.png'}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover;" />
          <div style="display: flex; flex-direction: column;">
            <span style="font-size: 0.82rem; font-weight: 800; color: #fff;">${this.activeCharacter ? this.activeCharacter.fullname : data.username}</span>
            <span style="font-size: 0.65rem; color: var(--accent-purple-light); font-weight: 700;">● Cuenta Verificada</span>
          </div>
          ${data.characters.length > 1 ? `
            <select id="select-active-char" class="form-select" style="padding: 2px 6px; font-size: 0.75rem; background: #1a162b; border-radius: 6px;">
              ${data.characters.map(c => `<option value="${c.id}" ${c.id === this.activeCharacter?.id ? 'selected' : ''}>${c.fullname}</option>`).join('')}
            </select>
          ` : ''}
          <button class="btn-icon-round" title="Cerrar sesión" onclick="window.app.logout()" style="width: 26px; height: 26px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          </button>
        </div>
      `;

      const charSelect = document.getElementById('select-active-char');
      if (charSelect) {
        charSelect.addEventListener('change', (e) => {
          const selectedId = parseInt(e.target.value);
          this.activeCharacter = this.currentUser.characters.find(c => c.id === selectedId);
          this.showToast(`Personaje activo: ${this.activeCharacter.fullname}`);
          if (this.currentRoute === 'artist-portal') {
            this.artistPortal.currentArtistId = this.activeCharacter.artist_id;
            this.artistPortal.render(document.querySelector('.view-content'));
          }
        });
      }
    } else {
      this.currentUser = null;
      this.activeCharacter = null;
      authContainer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <a href="/api/auth/login" class="btn-pill btn-pill-primary" style="font-size: 0.8rem; background: linear-gradient(135deg, #a855f7, #6b21a8); color: #fff; text-decoration: none;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
            Conectar Cuenta
          </a>
        </div>
      `;
    }
  }

  async demoLogin() {
    await this.fetchAPI('/api/auth/demo-login', { method: 'POST' });
    this.showToast('✅ Sesión iniciada');
    await this.checkAuth();
    if (this.currentRoute === 'artist-portal') {
      this.artistPortal.render(document.querySelector('.view-content'));
    }
  }

  async logout() {
    await this.fetchAPI('/api/auth/logout', { method: 'POST' });
    this.showToast('Sesión cerrada');
    await this.checkAuth();
  }

  async fetchAPI(url, options = {}) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error("API error:", err);
      return null;
    }
  }

  async loadPlaylists() {
    this.playlists = await this.fetchAPI('/api/playlists') || [];
    this.renderSidebarPlaylists();
  }

  async loadFollowedArtists() {
    this.followedArtists = await this.fetchAPI('/api/artists/following') || [];
    this.renderSidebarFollowedArtists();
  }

  renderSidebarPlaylists() {
    const listEl = document.getElementById('sidebar-playlists-list');
    if (!listEl) return;

    listEl.innerHTML = this.playlists.map(p => {
      const isCustomCover = p.cover_url && !p.cover_url.includes('default_playlist.png');
      return `
        <div class="playlist-item ${this.currentRoute === `playlist/${p.id}` ? 'active' : ''}" onclick="window.app.navigate('playlist/${p.id}')">
          <div class="playlist-thumb" style="${isCustomCover ? `background-image: url('${p.cover_url}'); background-size: cover; background-position: center; color: transparent;` : ''}">
            ${isCustomCover ? '' : p.name.charAt(0).toUpperCase()}
          </div>
          <div class="playlist-info">
            <div class="playlist-title">${p.name}</div>
            <div class="playlist-meta">${p.tracks_count} tracks</div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderSidebarFollowedArtists() {
    const followedContainer = document.getElementById('sidebar-followed-artists');
    if (!followedContainer) return;

    if (this.followedArtists && this.followedArtists.length > 0) {
      followedContainer.innerHTML = `
        <div class="library-header" style="margin-top: 6px; padding: 4px 0 8px 0;">
          <span>ARTISTAS SEGUIDOS</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 4px;">
          ${this.followedArtists.map(a => `
            <div class="playlist-item ${this.currentRoute === `artist/${a.id}` ? 'active' : ''}" onclick="window.app.navigate('artist/${a.id}')">
              <img src="${a.avatar_url || '/static/assets/default_avatar.png'}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(192,132,252,0.3);" />
              <div class="playlist-info">
                <div class="playlist-title">${a.name}</div>
                <div class="playlist-meta">${a.genre || 'Artista'}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      followedContainer.innerHTML = '';
    }
  }

  navigate(route, updateHash = true) {
    this.currentRoute = route;

    if (updateHash) {
      window.location.hash = '/' + route;
    }

    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.route === route);
    });

    const content = document.querySelector('.view-content');
    content.scrollTop = 0;

    if (route === 'home') {
      this.renderHome(content);
    } else if (route === 'search') {
      this.renderSearch(content);
    } else if (route === 'favorites') {
      this.renderFavorites(content);
    } else if (route === 'artist-portal') {
      this.artistPortal.render(content);
    } else if (route.startsWith('artist/')) {
      const artistId = parseInt(route.split('/')[1]);
      this.renderArtist(content, artistId);
    } else if (route.startsWith('album/')) {
      const albumId = parseInt(route.split('/')[1]);
      this.renderAlbum(content, albumId);
    } else if (route.startsWith('playlist/')) {
      const playlistId = parseInt(route.split('/')[1]);
      this.renderPlaylist(content, playlistId);
    }
    
    this.renderSidebarPlaylists();
  }

  async renderHome(container) {
    const [songs, albums, artists, history, followed] = await Promise.all([
      this.fetchAPI('/api/songs?sort_by=popular'),
      this.fetchAPI('/api/albums'),
      this.fetchAPI('/api/artists'),
      this.fetchAPI('/api/songs/history?limit=8'),
      this.fetchAPI('/api/artists/following')
    ]);

    this.allSongs = songs || [];
    this.albums = albums || [];
    this.followedArtists = followed || [];
    this.renderSidebarFollowedArtists();

    // Pick a featured artist
    const featuredArtist = artists && artists.length > 0
      ? artists[Math.floor(Math.random() * artists.length)]
      : null;

    // Mixes editorial
    const mixes = [
      { title: 'Noches de Streaming', sub: 'Synthwave · Cyberpunk', gradient: 'linear-gradient(135deg,#1a0533,#4f0ea8,#9333ea)', emoji: '🌌' },
      { title: 'Sunset Chillout', sub: 'Indie Pop · Chill', gradient: 'linear-gradient(135deg,#b45309,#d97706,#fbbf24)', emoji: '🏖️' },
      { title: 'Acoustic Vibes', sub: 'Acoustic · Folk', gradient: 'linear-gradient(135deg,#064e3b,#065f46,#10b981)', emoji: '🌿' },
      { title: 'High Energy Beat', sub: 'EDM · Trap', gradient: 'linear-gradient(135deg,#1e1b4b,#3730a3,#6366f1)', emoji: '⚡' },
      { title: 'Urban Groove', sub: 'Hip-Hop · R&B', gradient: 'linear-gradient(135deg,#4a044e,#86198f,#d946ef)', emoji: '🎤' },
    ];

    const greeting = this.getGreeting();
    const charName = this.activeCharacter ? `, ${this.activeCharacter.firstname}` : '';

    container.innerHTML = `
      <!-- FEATURED HERO (YouTube Music style) -->
      ${featuredArtist ? `
      <div class="featured-hero" onclick="window.app.navigate('artist/${featuredArtist.id}')">
        <img class="featured-hero-bg" src="${featuredArtist.avatar_url || '/static/assets/default_avatar.png'}" />
        <div class="featured-hero-overlay"></div>
        <div class="featured-hero-content">
          <img class="featured-hero-cover" src="${featuredArtist.avatar_url || '/static/assets/default_avatar.png'}" />
          <div class="featured-hero-info">
            <div class="featured-hero-label">Artista Destacado</div>
            <div class="featured-hero-title">${featuredArtist.name}</div>
            <div class="featured-hero-sub">${featuredArtist.genre} &bull; ${(featuredArtist.monthly_listeners || 0).toLocaleString()} oyentes mensuales</div>
            <div class="featured-hero-actions" onclick="event.stopPropagation()">
              <button class="btn-hero-featured" onclick="window.app.playArtist(${featuredArtist.id})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Reproducir
              </button>
              <button class="btn-hero-more" onclick="window.app.navigate('artist/${featuredArtist.id}')">Ver perfil</button>
            </div>
          </div>
        </div>
      </div>` : ''}

      <!-- GREETING + QUICK TILES (Spotify style) -->
      <div class="home-greeting">${greeting}${charName}</div>
      <div class="quick-grid-2col">
        <div class="quick-tile" onclick="window.app.navigate('favorites')">
          <div class="quick-tile-thumb-icon" style="background: linear-gradient(135deg,#a855f7,#6366f1)">💜</div>
          <span class="quick-tile-name">Tus Me Gusta</span>
          <button class="quick-tile-play" onclick="event.stopPropagation(); window.app.playFavorites()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </button>
        </div>
        ${(albums || []).slice(0, 5).map(al => `
          <div class="quick-tile" onclick="window.app.navigate('album/${al.id}')">
            <img class="quick-tile-thumb" src="${al.cover_url || '/static/assets/default_cover.png'}" />
            <span class="quick-tile-name">${al.title}</span>
            <button class="quick-tile-play" onclick="event.stopPropagation(); window.app.playAlbum(${al.id})">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </button>
          </div>
        `).join('')}
      </div>

      <!-- RECENTLY PLAYED / HISTORIAL -->
      ${history && history.length > 0 ? `
      <div class="scroll-section">
        <div class="scroll-section-header">
          <div>
            <div class="scroll-section-title">Escuchado Recientemente</div>
            <div class="scroll-section-sub">Continúa donde lo dejaste</div>
          </div>
        </div>
        <div class="scroll-row">
          ${history.map(s => `
            <div class="scroll-card" onclick="window.app.playTrackById(${s.id})">
              <div class="scroll-card-wrap">
                <img class="scroll-card-img" src="${s.cover_url || '/static/assets/default_cover.png'}" />
                <button class="scroll-card-play" onclick="event.stopPropagation(); window.app.playTrackById(${s.id})">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </button>
              </div>
              <div class="scroll-card-title">${s.title}</div>
              <div class="scroll-card-sub" onclick="event.stopPropagation(); window.app.navigate('artist/${s.artist_id}')">${s.artist_name}</div>
            </div>
          `).join('')}
        </div>
      </div>` : ''}

      <!-- NOVEDADES DE TUS ARTISTAS SEGUIDOS -->
      ${this.followedArtists.length > 0 ? `
      <div class="scroll-section">
        <div class="scroll-section-header">
          <div>
            <div class="scroll-section-title">Artistas que Sigues</div>
            <div class="scroll-section-sub">Acceso rápido a tus creadores favoritos</div>
          </div>
        </div>
        <div class="scroll-row">
          ${this.followedArtists.map(a => `
            <div class="scroll-card" onclick="window.app.navigate('artist/${a.id}')" style="text-align: center;">
              <div class="scroll-card-wrap" style="border-radius: 50%;">
                <img class="scroll-card-img" src="${a.avatar_url || '/static/assets/default_avatar.png'}" style="border-radius: 50%;" />
                <button class="scroll-card-play" onclick="event.stopPropagation(); window.app.playArtist(${a.id})">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </button>
              </div>
              <div class="scroll-card-title" style="margin-top: 8px;">${a.name}</div>
              <div class="scroll-card-sub">${a.genre} &bull; ${a.followers_count} seguidores</div>
            </div>
          `).join('')}
        </div>
      </div>` : ''}

      <!-- MIXES PARA TI (Apple Music + Spotify) -->
      <div class="scroll-section">
        <div class="scroll-section-header">
          <div>
            <div class="scroll-section-title">Mixes para ti</div>
            <div class="scroll-section-sub">Selecciones editoriales para cada momento</div>
          </div>
        </div>
        <div class="scroll-row">
          ${mixes.map(m => `
            <div class="mix-card" onclick="window.app.showToast('${m.emoji} Reproduciendo: ${m.title}')">
              <div class="mix-card-bg" style="background: ${m.gradient}"></div>
              <div class="mix-card-overlay" style="background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)"></div>
              <div class="mix-card-content">
                <div class="mix-card-title">${m.emoji} ${m.title}</div>
                <div class="mix-card-sub">${m.sub}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- ALBUMS ROW (horizontal scroll) -->
      <div class="scroll-section">
        <div class="scroll-section-header">
          <div>
            <div class="scroll-section-title">Álbumes y EPs</div>
            <div class="scroll-section-sub">Producciones discográficas destacadas</div>
          </div>
        </div>
        <div class="scroll-row">
          ${(albums || []).map(al => `
            <div class="scroll-card" onclick="window.app.navigate('album/${al.id}')">
              <div class="scroll-card-wrap">
                <img class="scroll-card-img" src="${al.cover_url || '/static/assets/default_cover.png'}" />
                <button class="scroll-card-play" onclick="event.stopPropagation(); window.app.playAlbum(${al.id})">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </button>
              </div>
              <div class="scroll-card-title">${al.title}</div>
              <div class="scroll-card-sub">${al.release_year} &bull; ${al.artist_name}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- ARTIST SPOTLIGHT (Apple Music wide editorial cards) -->
      <div class="scroll-section">
        <div class="scroll-section-header">
          <div>
            <div class="scroll-section-title">Artistas Populares</div>
            <div class="scroll-section-sub">Los artistas con mayor número de oyentes</div>
          </div>
        </div>
        <div class="artist-spotlight-row">
          ${(artists || []).map(a => `
            <div class="artist-spotlight-card" onclick="window.app.navigate('artist/${a.id}')">
              <img class="artist-spotlight-bg" src="${a.avatar_url || '/static/assets/default_avatar.png'}" />
              <div class="artist-spotlight-overlay"></div>
              <div class="artist-spotlight-info">
                <div class="artist-spotlight-label">${a.genre || 'Artista'}</div>
                <div class="artist-spotlight-name">${a.name}</div>
                <div class="artist-spotlight-listeners">${(a.monthly_listeners || 0).toLocaleString()} oyentes mensuales &bull; ${a.followers_count || 0} seguidores</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- TOP CHARTS (Spotify + YouTube Music numbered list) -->
      <div class="scroll-section">
        <div class="scroll-section-header">
          <div>
            <div class="scroll-section-title">Top Charts &mdash; Global</div>
            <div class="scroll-section-sub">Las canciones más escuchadas del momento</div>
          </div>
        </div>
        <div class="chart-list">
          ${(songs || []).slice(0, 10).map((s, i) => `
            <div class="chart-row" onclick="window.app.playTrackById(${s.id})">
              <div class="chart-num">${i + 1}</div>
              <img class="chart-img" src="${s.cover_url || '/static/assets/default_cover.png'}" />
              <div class="chart-info">
                <div class="chart-title">${s.title}</div>
                <div class="chart-artist">${s.artist_name}</div>
              </div>
              <div class="chart-plays">${((s.streams_count !== undefined ? s.streams_count : s.stream_count) || 0).toLocaleString()} streams</div>
              <div class="chart-duration">${this.player.formatTime(s.duration || 0)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  async renderAlbum(container, albumId) {
    const data = await this.fetchAPI(`/api/albums/${albumId}`);
    if (!data) return;

    const { album, songs } = data;
    const albumTypeLabel = album.type === 'ep' ? 'EP' : (album.type === 'single' ? 'Sencillo' : 'Álbum Oficial');

    container.innerHTML = `
      <div>
        <div class="hero-banner">
          <img src="${album.cover_url || '/static/assets/default_cover.png'}" class="hero-cover" />
          <div class="hero-details">
            <span class="hero-tag">${albumTypeLabel}</span>
            <h1 class="hero-title">${album.title}</h1>
            <div class="hero-meta" style="margin-top: 10px; display: flex; align-items: center; gap: 8px;">
              <img src="${album.artist_avatar || '/static/assets/default_avatar.png'}" style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover; cursor: pointer;" onclick="window.app.navigate('artist/${album.artist_id}')" />
              <strong style="color: #fff; cursor: pointer;" onclick="window.app.navigate('artist/${album.artist_id}')">${album.artist_name}</strong> &bull; 
              <span>${album.release_year}</span> &bull; 
              <span>${album.tracks_count} pistas</span> &bull; 
              <span>${this.player.formatTime(album.total_duration)}</span>
            </div>
          </div>
        </div>

        <div class="hero-actions">
          <button class="btn-hero-play" onclick="window.app.playSongList(${JSON.stringify(songs).replace(/"/g, '&quot;')})">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </button>
          <button class="btn-pill btn-pill-secondary" onclick="window.app.showToast('❤️ Álbum guardado en tu biblioteca')">
            Guardar Álbum
          </button>
          <button class="btn-pill btn-pill-secondary" onclick="window.app.shareItem('album', ${album.id}, encodeURIComponent(album.title))">
            🔗 Compartir
          </button>
        </div>

        <div class="tracklist-container">
          <div class="track-row track-header-row">
            <span>#</span>
            <span>Título</span>
            <span>Streams</span>
            <span></span>
            <span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
            <span></span>
          </div>
          ${songs.map((s, idx) => {
            const isCurrentPlaying = this.player.currentSong && this.player.currentSong.id === s.id;
            return `
              <div class="track-row ${isCurrentPlaying ? 'playing' : ''}" onclick="window.app.playTrackById(${s.id})">
                <span class="track-index">
                  <span class="track-num">${idx + 1}</span>
                  <span class="track-play-icon">▶</span>
                </span>
                <div class="track-main-info">
                  <div>
                    <div class="track-title">${s.title}</div>
                    <div class="track-artist">${s.artist_name}</div>
                  </div>
                </div>
                <span>${s.streams_count.toLocaleString()}</span>
                <span></span>
                <span>${this.player.formatTime(s.duration)}</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <button class="heart-btn ${s.is_favorite ? 'liked' : ''}" onclick="event.stopPropagation(); window.app.toggleFavorite(${s.id})">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="${s.is_favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                    </svg>
                  </button>
                  <button class="btn-icon-round" title="Añadir a playlist" onclick="event.stopPropagation(); window.app.openAddToPlaylistModal(${s.id})">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  async renderArtist(container, artistId) {
    const data = await this.fetchAPI(`/api/artists/${artistId}`);
    if (!data) return;

    const { artist, songs, albums } = data;
    const isFollowing = artist.is_following;

    container.innerHTML = `
      <div>
        <div class="hero-banner" style="${artist.banner_url ? `background: linear-gradient(to top, rgba(7, 6, 11, 0.95) 0%, rgba(7, 6, 11, 0.55) 50%, rgba(7, 6, 11, 0.35) 100%), url('${artist.banner_url}') center/cover no-repeat; padding: 48px 32px 32px 32px; border-radius: 20px; border: 1px solid var(--border-glass); margin-bottom: 24px;` : ''}">
          <img src="${artist.avatar_url || '/static/assets/default_avatar.png'}" class="hero-cover round" />
          <div class="hero-details">
            <span class="hero-tag" style="color: var(--accent-purple-light); display: flex; align-items: center; gap: 6px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
              Artista Verificado
            </span>
            <h1 class="hero-title">${artist.name}</h1>
            <div class="hero-meta">
              <span>${artist.monthly_listeners.toLocaleString()} oyentes mensuales</span> &bull; 
              <span id="artist-followers-label">${artist.followers_count || 0} seguidores</span> &bull; 
              <span>${artist.genre}</span>
            </div>
            <p style="color: #cbd5e1; font-size: 0.9rem; max-width: 650px; margin-top: 6px; line-height: 1.5;">${artist.bio || ''}</p>
          </div>
        </div>

        <div class="hero-actions">
          <button class="btn-hero-play" onclick="window.app.playSongList(${JSON.stringify(songs).replace(/"/g, '&quot;')})">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </button>
          <button id="btn-follow-artist" class="btn-follow ${isFollowing ? 'following' : ''}" onclick="window.app.toggleFollowArtist(${artist.id})">
            ${isFollowing ? '✓ Siguiendo' : '+ Seguir'}
          </button>
          <button class="btn-pill btn-pill-secondary" onclick="window.app.shareItem('artist', ${artist.id}, encodeURIComponent(artist.name))">
            🔗 Compartir
          </button>
        </div>

        ${albums && albums.length > 0 ? `
          <div class="section-header">
            <h2 class="section-title">Discografía (Álbumes y EPs)</h2>
          </div>
          <div class="cards-grid">
            ${albums.map(al => `
              <div class="music-card" onclick="window.app.navigate('album/${al.id}')">
                <div class="card-img-container">
                  <img src="${al.cover_url || '/static/assets/default_cover.png'}" loading="lazy"/>
                  <div class="card-play-btn" onclick="event.stopPropagation(); window.app.playAlbum(${al.id});">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  </div>
                </div>
                <div class="card-title">${al.title}</div>
                <div class="card-subtitle">${al.release_year} &bull; ${al.type === 'ep' ? 'EP' : 'Álbum'}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div class="section-header">
          <h2 class="section-title">Canciones Populares</h2>
        </div>

        <div class="tracklist-container">
          ${this.renderTracksTable(songs)}
        </div>
      </div>
    `;
  }

  async toggleFollowArtist(artistId) {
    const res = await this.fetchAPI(`/api/artists/${artistId}/follow`, { method: 'POST' });
    if (res) {
      this.showToast(res.is_following ? '⭐ Siguiendo al artista' : 'Dejaste de seguir al artista');
      const btn = document.getElementById('btn-follow-artist');
      if (btn) {
        btn.classList.toggle('following', res.is_following);
        btn.textContent = res.is_following ? '✓ Siguiendo' : '+ Seguir';
      }
      const label = document.getElementById('artist-followers-label');
      if (label) {
        label.textContent = `${res.followers_count} seguidores`;
      }
      await this.loadFollowedArtists();
    }
  }

  renderTracksTable(tracks, isFavView = false, playlistId = null) {
    if (!tracks || tracks.length === 0) {
      return `<p style="color: var(--text-muted); padding: 20px;">No hay canciones para mostrar.</p>`;
    }

    return `
      <div class="track-row track-header-row">
        <span>#</span>
        <span>Título</span>
        <span>Álbum</span>
        <span>Streams</span>
        <span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
        <span></span>
      </div>
      ${tracks.map((s, idx) => {
        const isCurrentPlaying = this.player.currentSong && this.player.currentSong.id === s.id;
        return `
          <div class="track-row ${isCurrentPlaying ? 'playing' : ''}" onclick="window.app.playTrackById(${s.id})">
            <span class="track-index">
              <span class="track-num">${idx + 1}</span>
              <span class="track-play-icon">▶</span>
            </span>
            <div class="track-main-info">
              <img src="${s.cover_url || '/static/assets/default_cover.png'}" class="track-cover-mini" loading="lazy"/>
              <div>
                <div class="track-title">${s.title}</div>
                <div class="track-artist" onclick="event.stopPropagation(); window.app.navigate('artist/${s.artist_id}')">${s.artist_name}</div>
              </div>
            </div>
            <span style="cursor: pointer;" onclick="event.stopPropagation(); ${s.album_id ? `window.app.navigate('album/${s.album_id}')` : ''}">${s.album || 'Single'}</span>
            <span>${(s.streams_count || 0).toLocaleString()}</span>
            <span>${this.player.formatTime(s.duration)}</span>
            <div style="display: flex; align-items: center; gap: 8px;">
              <button class="heart-btn ${s.is_favorite ? 'liked' : ''}" onclick="event.stopPropagation(); window.app.toggleFavorite(${s.id})">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="${s.is_favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                </svg>
              </button>
              <button class="btn-icon-round" title="Añadir a la cola" onclick="event.stopPropagation(); window.app.addTrackToQueue(${s.id})">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="8" y1="6" x2="21" y2="6"/>
                  <line x1="8" y1="12" x2="21" y2="12"/>
                  <line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/>
                  <line x1="3" y1="12" x2="3.01" y2="12"/>
                  <line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
              </button>
              <button class="btn-icon-round" title="Añadir a playlist" onclick="event.stopPropagation(); window.app.openAddToPlaylistModal(${s.id})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
              <button class="btn-icon-round" title="Compartir canción" onclick="event.stopPropagation(); window.app.shareItem('song', ${s.id}, encodeURIComponent(s.title))">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
              </button>
              ${playlistId ? `
                <button class="btn-icon-round" title="Quitar de playlist" onclick="event.stopPropagation(); window.app.removeFromPlaylist(${playlistId}, ${s.id})">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('')}
    `;
  }

  async renderSearch(container, initialSearch = '') {
    const songs = await this.fetchAPI('/api/songs');

    container.innerHTML = `
      <div>
        <h1 class="section-title" style="font-size: 1.8rem; margin-bottom: 20px;">Explorar en EarRape</h1>

        <div id="search-results-area">
          <div class="section-header">
            <h2 class="section-title">Categorías Musicales</h2>
          </div>
          <div class="genres-grid">
            <div class="genre-card" style="background: linear-gradient(135deg, #7c3aed, #4c1d95);" onclick="window.app.filterByGenre('Synthwave')">Synthwave 🌌</div>
            <div class="genre-card" style="background: linear-gradient(135deg, #2563eb, #1e3a8a);" onclick="window.app.filterByGenre('Indie Pop')">Indie Pop 🎸</div>
            <div class="genre-card" style="background: linear-gradient(135deg, #f43f5e, #9f1239);" onclick="window.app.filterByGenre('Cyberpunk')">Cyberpunk ⚡</div>
            <div class="genre-card" style="background: linear-gradient(135deg, #059669, #065f46);" onclick="window.app.filterByGenre('Acoustic')">Acoustic 🍃</div>
            <div class="genre-card" style="background: linear-gradient(135deg, #ea580c, #9a3412);" onclick="window.app.filterByGenre('Hip Hop')">Hip Hop 🎙️</div>
            <div class="genre-card" style="background: linear-gradient(135deg, #d97706, #92400e);" onclick="window.app.filterByGenre('Rock')">Rock ⚡</div>
          </div>

          <div class="section-header" style="margin-top: 30px;">
            <h2 class="section-title">Todas las Canciones de la Plataforma</h2>
          </div>
          <div class="tracklist-container" id="search-all-tracks">
            ${this.renderTracksTable(songs || [])}
          </div>
        </div>
      </div>
    `;

    if (initialSearch) {
      this.handleSearch(initialSearch);
    }
  }

  async handleSearch(query) {
    const resultsArea = document.getElementById('search-results-area');
    if (!resultsArea) return;

    if (!query.trim()) {
      this.renderSearch(document.querySelector('.view-content'));
      return;
    }

    const data = await this.fetchAPI(`/api/search?q=${encodeURIComponent(query)}`);
    if (!data) return;

    const { top_result, songs, artists, albums } = data;
    const hasResults = (songs && songs.length > 0) || (artists && artists.length > 0) || (albums && albums.length > 0);

    if (!hasResults) {
      resultsArea.innerHTML = `
        <div class="section-header">
          <h2 class="section-title">Resultados para "${query}"</h2>
        </div>
        <p style="color: var(--text-muted); padding: 50px 0; text-align: center; font-size: 1.1rem;">
          No se encontraron canciones, artistas ni álbumes que coincidan con "<strong>${query}</strong>".
        </p>
      `;
      return;
    }

    let topResultHtml = '';
    if (top_result) {
      if (top_result.type === 'artist') {
        const a = top_result.data;
        topResultHtml = `
          <div>
            <div class="section-header">
              <h2 class="section-title">Mejor Resultado</h2>
            </div>
            <div class="top-result-card" onclick="window.app.navigate('artist/${a.id}')">
              <img src="${a.avatar_url}" class="top-result-thumb round" />
              <div>
                <div class="top-result-title">${a.name}</div>
                <div style="color: var(--text-muted); font-size: 0.88rem;">${a.genre} &bull; ${a.monthly_listeners.toLocaleString()} oyentes</div>
                <span class="top-result-badge">Artista</span>
              </div>
            </div>
          </div>
        `;
      } else if (top_result.type === 'song') {
        const s = top_result.data;
        topResultHtml = `
          <div>
            <div class="section-header">
              <h2 class="section-title">Mejor Resultado</h2>
            </div>
            <div class="top-result-card" onclick="window.app.playTrackById(${s.id})">
              <img src="${s.cover_url}" class="top-result-thumb" />
              <div>
                <div class="top-result-title">${s.title}</div>
                <div style="color: var(--text-muted); font-size: 0.88rem;">${s.artist_name}</div>
                <span class="top-result-badge">Canción</span>
              </div>
            </div>
          </div>
        `;
      }
    }

    resultsArea.innerHTML = `
      <div class="search-results-top-grid">
        ${topResultHtml}
        <div>
          <div class="section-header">
            <h2 class="section-title">Canciones</h2>
          </div>
          <div class="tracklist-container">
            ${this.renderTracksTable(songs.slice(0, 4))}
          </div>
        </div>
      </div>

      ${artists && artists.length > 0 ? `
        <div class="section-header" style="margin-top: 20px;">
          <h2 class="section-title">Artistas</h2>
        </div>
        <div class="cards-grid">
          ${artists.map(a => `
            <div class="music-card" onclick="window.app.navigate('artist/${a.id}')">
              <div class="card-img-container round">
                <img src="${a.avatar_url}" loading="lazy"/>
                <div class="card-play-btn" onclick="event.stopPropagation(); window.app.playArtist(${a.id});">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </div>
              </div>
              <div class="card-title" style="text-align: center;">${a.name}</div>
              <div class="card-subtitle" style="text-align: center;">${a.genre} &bull; ${a.monthly_listeners.toLocaleString()} oyentes</div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${albums && albums.length > 0 ? `
        <div class="section-header" style="margin-top: 20px;">
          <h2 class="section-title">Álbumes y EPs</h2>
        </div>
        <div class="cards-grid">
          ${albums.map(al => `
            <div class="music-card" onclick="window.app.navigate('album/${al.id}')">
              <div class="card-img-container">
                <img src="${al.cover_url}" loading="lazy"/>
                <div class="card-play-btn" onclick="event.stopPropagation(); window.app.playAlbum(${al.id});">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </div>
              </div>
              <div class="card-title">${al.title}</div>
              <div class="card-subtitle">${al.release_year} &bull; ${al.artist_name}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${songs.length > 4 ? `
        <div class="section-header" style="margin-top: 30px;">
          <h2 class="section-title">Todas las Canciones Coincidentes</h2>
        </div>
        <div class="tracklist-container">
          ${this.renderTracksTable(songs.slice(4))}
        </div>
      ` : ''}
    `;
  }

  async filterByGenre(genre) {
    this.navigate('search');
    const resultsArea = document.getElementById('search-results-area');
    if (!resultsArea) return;

    const songs = await this.fetchAPI(`/api/songs?genre=${encodeURIComponent(genre)}`);

    resultsArea.innerHTML = `
      <div class="section-header">
        <h2 class="section-title">Género: ${genre} (${songs.length} pistas)</h2>
      </div>
      <div class="tracklist-container">
        ${this.renderTracksTable(songs)}
      </div>
    `;
  }

  async renderFavorites(container) {
    const songs = await this.fetchAPI('/api/favorites');

    container.innerHTML = `
      <div>
        <div class="hero-banner">
          <div class="hero-cover" style="background: linear-gradient(135deg, #a855f7, #6366f1); display: flex; align-items: center; justify-content: center; font-size: 5rem;">
            💜
          </div>
          <div class="hero-details">
            <span class="hero-tag">Tu Colección</span>
            <h1 class="hero-title">Tus Me Gusta</h1>
            <div class="hero-meta">
              <span>${this.activeCharacter ? this.activeCharacter.fullname : 'Oyente de EarRape'}</span> &bull; 
              <span>${songs.length} canciones</span>
            </div>
          </div>
        </div>

        <div class="hero-actions">
          <button class="btn-hero-play" onclick="window.app.playSongList(${JSON.stringify(songs).replace(/"/g, '&quot;')})">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </button>
        </div>

        ${songs.length === 0 ? `
          <p style="color: var(--text-muted); padding: 40px 0;">Aún no tienes canciones favoritas. Haz clic en el corazón de cualquier canción para guardarla aquí.</p>
        ` : `
          <div class="tracklist-container">
            ${this.renderTracksTable(songs, true)}
          </div>
        `}
      </div>
    `;
  }

  async renderPlaylist(container, playlistId) {
    const data = await this.fetchAPI(`/api/playlists/${playlistId}`);
    if (!data) return;

    const { playlist, tracks } = data;
    const isCustomCover = playlist.cover_url && !playlist.cover_url.includes('default_playlist.png');

    container.innerHTML = `
      <div>
        <div class="hero-banner">
          ${isCustomCover ? `
            <img src="${playlist.cover_url}" class="hero-cover" />
          ` : `
            <div class="hero-cover" style="background: linear-gradient(135deg, #4c1d95, #9333ea); display: flex; align-items: center; justify-content: center; font-size: 4.5rem; font-weight: 800;">
              ${playlist.name.charAt(0).toUpperCase()}
            </div>
          `}
          <div class="hero-details">
            <span class="hero-tag">Playlist Pública</span>
            <h1 class="hero-title">${playlist.name}</h1>
            <p style="color: var(--text-muted); font-size: 0.95rem;">${playlist.description || 'Sin descripción'}</p>
            <div class="hero-meta">
              <span>EarRape Music</span> &bull; 
              <span>${tracks.length} canciones</span>
            </div>
          </div>
        </div>

        <div class="hero-actions">
          <button class="btn-hero-play" onclick="window.app.playSongList(${JSON.stringify(tracks).replace(/"/g, '&quot;')})">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </button>
          <button class="btn-pill btn-pill-secondary" onclick="window.app.openEditPlaylistModal(${playlist.id})">
            ✏️ Editar Playlist
          </button>
          <button class="btn-pill btn-pill-secondary" onclick="window.app.shareItem('playlist', ${playlist.id}, encodeURIComponent(playlist.name))">
            🔗 Compartir
          </button>
          <button class="btn-pill btn-pill-secondary" onclick="window.app.deletePlaylist(${playlist.id})">
            Eliminar
          </button>
        </div>

        ${tracks.length === 0 ? `
          <p style="color: var(--text-muted); padding: 40px 0;">Esta playlist está vacía. Añade canciones usando el botón (+).</p>
        ` : `
          <div class="tracklist-container">
            ${this.renderTracksTable(tracks, false, playlist.id)}
          </div>
        `}
      </div>
    `;
  }

  async playTrackById(songId) {
    const song = await this.fetchAPI(`/api/songs/${songId}`);
    if (song) {
      this.player.playTrack(song);
    }
  }

  async addTrackToQueue(songId) {
    const song = await this.fetchAPI(`/api/songs/${songId}`);
    if (song) {
      this.player.addToQueue(song);
    }
  }

  playSongList(songs) {
    if (songs && songs.length > 0) {
      this.player.playTrack(songs[0], songs);
    }
  }

  async playAlbum(albumId) {
    const data = await this.fetchAPI(`/api/albums/${albumId}`);
    if (data && data.songs.length > 0) {
      this.player.playTrack(data.songs[0], data.songs);
      this.showToast(`▶ Reproduciendo álbum "${data.album.title}"`);
    }
  }

  async playFavorites() {
    const favs = await this.fetchAPI('/api/favorites');
    if (favs && favs.length > 0) {
      this.player.playTrack(favs[0], favs);
    }
  }

  async playPlaylist(playlistId) {
    const data = await this.fetchAPI(`/api/playlists/${playlistId}`);
    if (data && data.tracks.length > 0) {
      this.player.playTrack(data.tracks[0], data.tracks);
    }
  }

  async playArtist(artistId) {
    const data = await this.fetchAPI(`/api/artists/${artistId}`);
    if (data && data.songs.length > 0) {
      this.player.playTrack(data.songs[0], data.songs);
    }
  }

  async toggleFavorite(songId) {
    const res = await this.fetchAPI('/api/favorites/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ song_id: songId })
    });

    if (res) {
      this.showToast(res.is_favorite ? '💜 Añadida a tus canciones favoritas' : 'Removida de favoritos');
      if (this.player.currentSong && this.player.currentSong.id === songId) {
        this.player.updateLikeButton(res.is_favorite);
      }
      if (this.currentRoute === 'favorites' || this.currentRoute === 'home' || this.currentRoute.startsWith('playlist/') || this.currentRoute.startsWith('artist/') || this.currentRoute.startsWith('album/')) {
        this.navigate(this.currentRoute);
      }
    }
  }

  openCreatePlaylistModal() {
    document.getElementById('modal-create-playlist').classList.add('open');
  }

  openAddToPlaylistModal(songId) {
    this.selectedSongForPlaylist = songId;
    const modal = document.getElementById('modal-add-to-playlist');
    const listContainer = document.getElementById('add-playlist-options');
    
    listContainer.innerHTML = this.playlists.map(p => {
      const isCustomCover = p.cover_url && !p.cover_url.includes('default_playlist.png');
      return `
        <div class="playlist-item" onclick="window.app.addSongToPlaylist(${p.id}, ${songId})">
          <div class="playlist-thumb" style="${isCustomCover ? `background-image: url('${p.cover_url}'); background-size: cover; background-position: center; color: transparent;` : ''}">
            ${isCustomCover ? '' : p.name.charAt(0).toUpperCase()}
          </div>
          <div class="playlist-info">
            <div class="playlist-title">${p.name}</div>
          </div>
        </div>
      `;
    }).join('');

    modal.classList.add('open');
  }

  async addSongToPlaylist(playlistId, songId) {
    await this.fetchAPI(`/api/playlists/${playlistId}/tracks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ song_id: songId })
    });
    this.showToast('✅ Pista añadida a la playlist');
    this.closeModals();
    await this.loadPlaylists();
  }

  async removeFromPlaylist(playlistId, songId) {
    await this.fetchAPI(`/api/playlists/${playlistId}/tracks/${songId}`, {
      method: 'DELETE'
    });
    this.showToast('Pista eliminada de la playlist');
    await this.loadPlaylists();
    this.navigate(`playlist/${playlistId}`);
  }

  async deletePlaylist(playlistId) {
    if (!confirm('¿Eliminar esta playlist?')) return;
    await this.fetchAPI(`/api/playlists/${playlistId}`, { method: 'DELETE' });
    this.showToast('Playlist eliminada');
    await this.loadPlaylists();
    this.navigate('home');
  }

  async createPlaylist(name, description, coverFile = null) {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description || '');
    if (coverFile) {
      formData.append('cover_file', coverFile);
    }

    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        this.showToast(`✨ Playlist "${data.name}" creada`);
        await this.loadPlaylists();
        this.navigate(`playlist/${data.id}`);
      } else {
        this.showToast(data.detail || 'Error al crear playlist');
      }
    } catch (err) {
      this.showToast('Error al conectar con el servidor');
    }
  }

  openEditPlaylistModal(playlistId) {
    const playlist = this.playlists.find(p => p.id === playlistId);
    if (!playlist) return;
    const name = playlist.name || '';
    const desc = playlist.description || '';
    const modal = document.getElementById('modal-edit-playlist');
    if (!modal) return;
    document.getElementById('edit-playlist-id').value = playlistId;
    document.getElementById('edit-playlist-name').value = name || '';
    document.getElementById('edit-playlist-desc').value = desc || '';
    modal.classList.add('open');
  }

  async updatePlaylist(playlistId, name, description, coverFile = null) {
    const formData = new FormData();
    if (name) formData.append('name', name);
    if (description !== null) formData.append('description', description);
    if (coverFile) formData.append('cover_file', coverFile);

    try {
      const res = await fetch(`/api/playlists/${playlistId}`, {
        method: 'PUT',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        this.showToast('✨ Playlist actualizada');
        await this.loadPlaylists();
        this.navigate(`playlist/${playlistId}`);
      } else {
        this.showToast(data.detail || 'Error al actualizar');
      }
    } catch (err) {
      this.showToast('Error de conexión');
    }
  }

  shareItem(type, id, title) {
    const url = `${window.location.origin}/?${type}=${id}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        this.showToast(`📋 Enlace copiado: "${title || type}"`);
      }).catch(() => {
        prompt('Copia este enlace para compartir:', url);
      });
    } else {
      prompt('Copia este enlace para compartir:', url);
    }
  }

  closeModals() {
    document.querySelectorAll('.modal-backdrop').forEach(el => el.classList.remove('open'));
  }

  showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  onSongPlayed(songId) {
    document.querySelectorAll('.track-row').forEach(row => {
      row.classList.remove('playing');
    });
  }

  getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }
}

window.addEventListener('error', (e) => {
  console.error('Global JS error:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason);
});

window.addEventListener('DOMContentLoaded', () => {
  window.app = new SoundFlowApp();
});
