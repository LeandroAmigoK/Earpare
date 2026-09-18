class ArtistPortal {
  constructor(app) {
    this.app = app;
    this.currentArtistId = null;
    this.activeTab = 'upload'; // 'overview', 'upload', 'catalog', 'profile'
    this.uploadType = 'single'; // 'single', 'new_album', 'add_to_album'
  }

  async render(container) {
    const artists = await this.app.fetchAPI('/api/artists');
    if (!this.currentArtistId && artists && artists.length > 0) {
      if (this.app.activeCharacter && this.app.activeCharacter.artist_id) {
        this.currentArtistId = this.app.activeCharacter.artist_id;
      } else {
        this.currentArtistId = artists[0].id;
      }
    }

    container.innerHTML = `
      <div class="artist-portal-container">
        <div class="artist-portal-header">
          <div style="display: flex; align-items: center; gap: 20px;">
            <div style="width: 60px; height: 60px; min-width: 60px; border-radius: 12px; background: linear-gradient(135deg, #1ed760, #169c46); display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 24px rgba(30, 215, 96, 0.35);">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="#000000"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/></svg>
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span style="background: rgba(30, 215, 96, 0.15); color: #1ed760; font-size: 0.75rem; font-weight: 800; padding: 4px 10px; border-radius: 500px; text-transform: uppercase; letter-spacing: 1px; border: 1px solid rgba(30, 215, 96, 0.3);">
                  Spotify for Artists Edition
                </span>
              </div>
              <h1 class="artist-portal-title">EarRape Creator Studio</h1>
              <p class="artist-portal-sub">Publica sencillos, produce álbumes oficiales y analiza tus oyentes en tiempo real.</p>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 12px;">
            <select id="artist-selector" class="form-select" style="min-width: 180px; padding: 8px 12px; font-weight: 700;">
              ${(artists || []).map(a => `<option value="${a.id}" ${a.id === this.currentArtistId ? 'selected' : ''}>🎙️ ${a.name}</option>`).join('')}
              <option value="new">+ Registrar Nuevo Artista...</option>
            </select>
          </div>
        </div>

        <div class="artist-tabs">
          <button class="artist-tab-btn ${this.activeTab === 'upload' ? 'active' : ''}" data-tab="upload">🚀 Subir Música / Álbum</button>
          <button class="artist-tab-btn ${this.activeTab === 'overview' ? 'active' : ''}" data-tab="overview">📊 Estadísticas & Analytics</button>
          <button class="artist-tab-btn ${this.activeTab === 'catalog' ? 'active' : ''}" data-tab="catalog">🎵 Mi Discografía</button>
          <button class="artist-tab-btn ${this.activeTab === 'profile' ? 'active' : ''}" data-tab="profile">⚙️ Editar Perfil</button>
        </div>

        <div id="artist-tab-content"></div>
      </div>
    `;

    container.querySelectorAll('.artist-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.activeTab = e.target.dataset.tab;
        container.querySelectorAll('.artist-tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.renderTabContent();
      });
    });

    const selector = document.getElementById('artist-selector');
    selector.addEventListener('change', async (e) => {
      if (e.target.value === 'new') {
        this.openNewArtistModal();
      } else {
        this.currentArtistId = parseInt(e.target.value);
        this.renderTabContent();
      }
    });

    await this.renderTabContent();
  }

  async renderTabContent() {
    const tabContainer = document.getElementById('artist-tab-content');
    if (!tabContainer) return;

    if (this.activeTab === 'upload') {
      await this.renderUploadTab(tabContainer);
    } else if (this.activeTab === 'overview') {
      await this.renderOverviewTab(tabContainer);
    } else if (this.activeTab === 'catalog') {
      await this.renderCatalogTab(tabContainer);
    } else if (this.activeTab === 'profile') {
      await this.renderProfileTab(tabContainer);
    }
  }

  async renderUploadTab(container) {
    const albums = await this.app.fetchAPI(`/api/albums?artist_id=${this.currentArtistId}`) || [];
    const artistData = await this.app.fetchAPI(`/api/artists/${this.currentArtistId}`);
    const artist = artistData ? artistData.artist : null;
    const storageUsed = artist ? (artist.storage_used_bytes || 0) : 0;
    const storageLimit = 10737418240; // 10 GB
    const usedMB = (storageUsed / (1024 * 1024)).toFixed(1);
    const usedGB = (storageUsed / (1024 * 1024 * 1024)).toFixed(2);
    const percent = Math.min(100, ((storageUsed / storageLimit) * 100)).toFixed(1);
    const isNearLimit = percent >= 85;

    container.innerHTML = `
      <!-- 10 GB Storage Limit Meter -->
      <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid ${isNearLimit ? 'rgba(239, 68, 68, 0.5)' : 'rgba(168, 85, 247, 0.25)'}; border-radius: 12px; padding: 14px 18px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.1rem;">💾</span>
            <span style="font-weight: 700; font-size: 0.9rem; color: #fff;">Almacenamiento del Artista (Límite 10 GB)</span>
          </div>
          <span style="font-size: 0.82rem; font-weight: 700; color: ${isNearLimit ? '#f87171' : '#c084fc'};">
            ${usedGB} GB / 10.00 GB (${percent}%)
          </span>
        </div>
        <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.1); border-radius: 999px; overflow: hidden;">
          <div style="width: ${percent}%; height: 100%; background: ${isNearLimit ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : 'linear-gradient(90deg, #a855f7, #06b6d4)'}; border-radius: 999px; transition: width 0.3s ease;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: #94a3b8; margin-top: 6px;">
          <span>${usedMB} MB ocupados</span>
          <span>Disponible: ${(10240 - parseFloat(usedMB)).toFixed(1)} MB</span>
        </div>
      </div>

      <div class="upload-box-card">
        <div style="display: flex; gap: 12px; margin-bottom: 20px;">
          <button class="btn-pill ${this.uploadType === 'single' ? 'btn-pill-primary' : 'btn-pill-secondary'}" id="btn-mode-single">
            🎵 Subir un Sencillo (Single)
          </button>
          <button class="btn-pill ${this.uploadType === 'new_album' ? 'btn-pill-primary' : 'btn-pill-secondary'}" id="btn-mode-new-album">
            💿 Crear un Nuevo Álbum / EP
          </button>
          ${albums.length > 0 ? `
            <button class="btn-pill ${this.uploadType === 'add_to_album' ? 'btn-pill-primary' : 'btn-pill-secondary'}" id="btn-mode-add-track">
              ➕ Añadir Canción a Álbum
            </button>
          ` : ''}
        </div>

        ${this.uploadType === 'new_album' ? `
          <h2 style="font-size: 1.3rem; font-weight: 800;">Crear nuevo Álbum / EP en EarRape</h2>
          <form id="create-album-form" style="display: flex; flex-direction: column; gap: 20px;">
            <div class="upload-grid">
              <div class="form-group">
                <label class="form-label">Título del Álbum / EP *</label>
                <input type="text" class="form-input" name="title" placeholder="Ej: Los Santos After Dark" required />
              </div>

              <div class="form-group">
                <label class="form-label">Tipo de Lanzamiento</label>
                <select class="form-select" name="album_type">
                  <option value="album">Álbum Completo (LP)</option>
                  <option value="ep">Extended Play (EP)</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Género Principal</label>
                <select class="form-select" name="genre">
                  <option value="Synthwave">Synthwave</option>
                  <option value="Indie Pop">Indie Pop</option>
                  <option value="Cyberpunk">Cyberpunk / Electro</option>
                  <option value="Acoustic">Acoustic / Folk</option>
                  <option value="Hip Hop">Hip Hop / Trap</option>
                  <option value="Rock">Rock / Alternativo</option>
                  <option value="Lo-Fi">Lo-Fi / Chill</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Año de Lanzamiento</label>
                <input type="text" class="form-input" name="release_year" value="2026" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Carátula Oficial del Álbum (JPG, PNG) *</label>
              <div class="dropzone" id="album-cover-dropzone">
                <input type="file" id="album-cover-input" name="cover_file" accept="image/*" required />
                <div class="dropzone-icon" id="album-cover-icon-box">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                    <circle cx="9" cy="9" r="2"/>
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                  </svg>
                </div>
                <img id="album-cover-preview" class="dropzone-preview" alt="Preview"/>
                <div class="dropzone-title" id="album-cover-filename">Arrastra la portada del álbum aquí</div>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end;">
              <button type="submit" id="btn-submit-album" class="btn-pill btn-pill-primary" style="padding: 12px 28px;">
                💿 Crear Álbum y Empezar a Añadir Canciones
              </button>
            </div>
          </form>
        ` : `
          <h2 style="font-size: 1.3rem; font-weight: 800;">
            ${this.uploadType === 'add_to_album' ? 'Añadir Canción a un Álbum' : 'Publicar un Sencillo (Single)'}
          </h2>
          <form id="upload-track-form" style="display: flex; flex-direction: column; gap: 20px;">
            ${this.uploadType === 'add_to_album' ? `
              <div class="form-group">
                <label class="form-label">Seleccionar Álbum de Destino *</label>
                <select class="form-select" name="album_id" required>
                  ${albums.map(al => `<option value="${al.id}">${al.title} (${al.release_year})</option>`).join('')}
                </select>
              </div>
            ` : ''}

            <div class="upload-grid">
              <div class="form-group">
                <label class="form-label">1. Archivo de Audio (MP3, WAV, OGG) *</label>
                <div class="dropzone" id="audio-dropzone">
                  <input type="file" id="audio-input" name="audio_file" accept="audio/*" required />
                  <div class="dropzone-icon">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
                  </div>
                  <div class="dropzone-title" id="audio-filename">Arrastra el audio de la pista aquí</div>
                </div>
              </div>

              ${this.uploadType === 'single' ? `
                <div class="form-group">
                  <label class="form-label">2. Carátula del Sencillo (JPG, PNG)</label>
                  <div class="dropzone" id="cover-dropzone">
                    <input type="file" id="cover-input" name="cover_file" accept="image/*" />
                    <div class="dropzone-icon" id="cover-icon-box">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                    </div>
                    <img id="cover-preview" class="dropzone-preview" alt="Preview"/>
                    <div class="dropzone-title" id="cover-filename">Arrastra la portada aquí</div>
                  </div>
                </div>
              ` : ''}
            </div>

            <div class="upload-grid">
              <div class="form-group">
                <label class="form-label">Título de la Canción *</label>
                <input type="text" class="form-input" name="title" placeholder="Ej: Bass Overdrive" required />
              </div>

              ${this.uploadType === 'single' ? `
                <div class="form-group">
                  <label class="form-label">Género Principal</label>
                  <select class="form-select" name="genre">
                    <option value="Synthwave">Synthwave</option>
                    <option value="Indie Pop">Indie Pop</option>
                    <option value="Cyberpunk">Cyberpunk / Electro</option>
                    <option value="Acoustic">Acoustic / Folk</option>
                    <option value="Hip Hop">Hip Hop / Trap</option>
                    <option value="Rock">Rock / Alternativo</option>
                    <option value="Lo-Fi">Lo-Fi / Chill</option>
                  </select>
                </div>
              ` : `
                <div class="form-group">
                  <label class="form-label">Número de Pista (# Track)</label>
                  <input type="number" class="form-input" name="track_number" value="1" min="1" />
                </div>
              `}
            </div>

            <div class="form-group">
              <label class="form-label">Letras de la Canción (Opcional)</label>
              <textarea class="form-textarea" name="lyrics" rows="3" placeholder="Pega la letra completa de la canción aquí..."></textarea>
            </div>

            <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
              <button type="submit" id="btn-submit-upload" class="btn-pill btn-pill-primary" style="padding: 12px 28px;">
                🚀 ${this.uploadType === 'add_to_album' ? 'Añadir al Álbum' : 'Publicar en EarRape'}
              </button>
            </div>
          </form>
        `}
      </div>
    `;

    document.getElementById('btn-mode-single')?.addEventListener('click', () => {
      this.uploadType = 'single';
      this.renderTabContent();
    });
    document.getElementById('btn-mode-new-album')?.addEventListener('click', () => {
      this.uploadType = 'new_album';
      this.renderTabContent();
    });
    document.getElementById('btn-mode-add-track')?.addEventListener('click', () => {
      this.uploadType = 'add_to_album';
      this.renderTabContent();
    });

    const albumForm = document.getElementById('create-album-form');
    if (albumForm) {
      const albumCoverInput = document.getElementById('album-cover-input');
      const albumCoverFilename = document.getElementById('album-cover-filename');
      const albumCoverPreview = document.getElementById('album-cover-preview');
      const albumCoverIconBox = document.getElementById('album-cover-icon-box');

      albumCoverInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          const file = e.target.files[0];
          albumCoverFilename.textContent = `🖼️ Portada: ${file.name}`;
          const reader = new FileReader();
          reader.onload = (re) => {
            albumCoverPreview.src = re.target.result;
            albumCoverPreview.style.display = 'block';
            albumCoverIconBox.style.display = 'none';
          };
          reader.readAsDataURL(file);
        }
      });

      albumForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('btn-submit-album');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creando álbum...';

        const formData = new FormData(albumForm);
        formData.append('artist_id', this.currentArtistId);

        try {
          const res = await fetch('/api/albums', { method: 'POST', body: formData });
          if (!res.ok) throw new Error('Error al crear el álbum');
          const newAlbum = await res.json();
          this.app.showToast(`💿 Álbum "${newAlbum.title}" creado con éxito en EarRape`);
          this.uploadType = 'add_to_album';
          await this.renderTabContent();
        } catch (err) {
          alert('Error: ' + err.message);
          submitBtn.disabled = false;
          submitBtn.textContent = '💿 Crear Álbum';
        }
      });
    }

    const trackForm = document.getElementById('upload-track-form');
    if (trackForm) {
      const audioInput = document.getElementById('audio-input');
      const audioFilename = document.getElementById('audio-filename');
      audioInput?.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          audioFilename.textContent = `🎵 Archivo: ${e.target.files[0].name}`;
          audioFilename.style.color = 'var(--accent-green)';
        }
      });

      const coverInput = document.getElementById('cover-input');
      const coverFilename = document.getElementById('cover-filename');
      const coverPreview = document.getElementById('cover-preview');
      const coverIconBox = document.getElementById('cover-icon-box');
      coverInput?.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          const file = e.target.files[0];
          coverFilename.textContent = `🖼️ Portada: ${file.name}`;
          const reader = new FileReader();
          reader.onload = (re) => {
            coverPreview.src = re.target.result;
            coverPreview.style.display = 'block';
            coverIconBox.style.display = 'none';
          };
          reader.readAsDataURL(file);
        }
      });

      trackForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('btn-submit-upload');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Subiendo canción...';

        const formData = new FormData(trackForm);
        formData.append('artist_id', this.currentArtistId);

        try {
          const res = await fetch('/api/songs/upload', { method: 'POST', body: formData });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Error al subir la canción');
          }
          this.app.showToast('🎉 ¡Canción publicada en EarRape!');
          this.activeTab = 'catalog';
          await this.render(document.querySelector('.view-content'));
        } catch (error) {
          alert('Error: ' + error.message);
          submitBtn.disabled = false;
          submitBtn.textContent = '🚀 Publicar';
        }
      });
    }
  }

  async renderOverviewTab(container) {
    if (!this.currentArtistId) return;
    const stats = await this.app.fetchAPI(`/api/artists/${this.currentArtistId}/analytics`);

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 24px;">
        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-label">Reproducciones Totales</span>
            <span class="stat-value">${stats.total_streams.toLocaleString()}</span>
            <span class="stat-trend">▲ Streams en EarRape</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Oyentes Mensuales</span>
            <span class="stat-value">${stats.monthly_listeners.toLocaleString()}</span>
            <span class="stat-trend">▲ Audiencia de Los Santos</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Álbumes Publicados</span>
            <span class="stat-value">${stats.total_albums || 0}</span>
            <span class="stat-trend">Discografía oficial</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Canciones Totales</span>
            <span class="stat-value">${stats.total_tracks}</span>
            <span class="stat-trend">Pistas activas</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Almacenamiento Usado</span>
            <span class="stat-value">${((stats.storage_used_bytes || 0) / (1024 * 1024 * 1024)).toFixed(2)} GB</span>
            <span class="stat-trend">Límite: 10.00 GB (${stats.storage_percent || 0}%)</span>
          </div>
        </div>

        <div class="upload-box-card">
          <h3 style="font-size: 1.2rem; font-weight: 800; margin-bottom: 12px;">Canciones Más Escuchadas de ${stats.artist_name}</h3>
          <div class="tracklist-container">
            ${stats.tracks.map((t, idx) => `
              <div class="track-row" onclick="window.app.playTrackById(${t.id})">
                <span class="track-index">${idx + 1}</span>
                <div class="track-main-info">
                  <img src="${t.cover_url || '/static/assets/default_cover.png'}" class="track-cover-mini"/>
                  <div>
                    <div class="track-title">${t.title}</div>
                    <div class="track-artist">${t.album || 'Single'}</div>
                  </div>
                </div>
                <span>${t.genre}</span>
                <span>${t.streams_count.toLocaleString()} streams</span>
                <span>${window.app.player.formatTime(t.duration)}</span>
                <button class="btn-icon-round" title="Eliminar" onclick="event.stopPropagation(); window.app.artistPortal.deleteTrack(${t.id})">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  async renderCatalogTab(container) {
    if (!this.currentArtistId) return;
    const data = await this.app.fetchAPI(`/api/artists/${this.currentArtistId}`);
    const albums = await this.app.fetchAPI(`/api/albums?artist_id=${this.currentArtistId}`) || [];

    container.innerHTML = `
      <div class="upload-box-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="font-size: 1.2rem; font-weight: 800;">Discografía Oficial de ${data.artist.name}</h3>
          <div style="display: flex; gap: 8px;">
            <button class="btn-pill btn-pill-secondary" onclick="window.app.artistPortal.setUploadType('new_album')">
              + Nuevo Álbum
            </button>
            <button class="btn-pill btn-pill-primary" onclick="window.app.artistPortal.setUploadType('single')">
              + Subir Sencillo
            </button>
          </div>
        </div>

        ${albums.length > 0 ? `
          <h4 style="font-size: 1rem; font-weight: 700; margin: 16px 0 8px 0; color: #c7d2fe;">Álbumes y EPs (${albums.length})</h4>
          <div class="cards-grid">
            ${albums.map(al => `
              <div class="music-card" onclick="window.app.navigate('album/${al.id}')">
                <div class="card-img-container">
                  <img src="${al.cover_url || '/static/assets/default_cover.png'}" />
                  <div class="card-play-btn" onclick="event.stopPropagation(); window.app.playAlbum(${al.id});">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  </div>
                </div>
                <div class="card-title">${al.title}</div>
                <div class="card-subtitle">${al.release_year} &bull; ${al.tracks_count} canciones</div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <h4 style="font-size: 1rem; font-weight: 700; margin: 24px 0 8px 0; color: #c7d2fe;">Todas las Canciones Publicadas (${data.songs.length})</h4>
        ${data.songs.length === 0 ? `
          <p style="color: var(--text-subdued); text-align: center; padding: 20px;">Aún no has publicado canciones con este artista.</p>
        ` : `
          <div class="tracklist-container">
            ${data.songs.map((s, idx) => `
              <div class="track-row" onclick="window.app.playTrackById(${s.id})">
                <span class="track-index">${idx + 1}</span>
                <div class="track-main-info">
                  <img src="${s.cover_url || '/static/assets/default_cover.png'}" class="track-cover-mini"/>
                  <div>
                    <div class="track-title">${s.title}</div>
                    <div class="track-artist">${s.album || 'Single'} &bull; ${s.release_date || '2026'}</div>
                  </div>
                </div>
                <span>${s.genre}</span>
                <span>${s.streams_count.toLocaleString()} streams</span>
                <span>${window.app.player.formatTime(s.duration)}</span>
                <button class="btn-icon-round" title="Eliminar canción" onclick="event.stopPropagation(); window.app.artistPortal.deleteTrack(${s.id})">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }

  async renderProfileTab(container) {
    if (!this.currentArtistId) return;
    const data = await this.app.fetchAPI(`/api/artists/${this.currentArtistId}`);
    if (!data || !data.artist) return;
    const artist = data.artist;

    container.innerHTML = `
      <div class="upload-box-card">
        <!-- Live Preview Header -->
        <div style="margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div>
              <h3 style="font-size: 1.35rem; font-weight: 800; color: #fff;">Perfil Público del Artista</h3>
              <p style="font-size: 0.85rem; color: var(--text-muted);">Personaliza tu imagen, biografía y presencia en EarRape</p>
            </div>
            <button type="button" class="btn-pill btn-pill-secondary" onclick="window.app.navigate('artist/${artist.id}')">
              👁️ Ver Perfil Público
            </button>
          </div>

          <!-- Banner & Avatar Live Preview Card -->
          <div style="position: relative; height: 160px; border-radius: 14px; overflow: hidden; background: #161226; border: 1px solid var(--border-glass);">
            <img id="preview-banner" src="${artist.banner_url || '/static/assets/default_cover.png'}" style="width: 100%; height: 100%; object-fit: cover; filter: brightness(0.65);" />
            <div style="position: absolute; bottom: 16px; left: 20px; display: flex; align-items: center; gap: 16px;">
              <img id="preview-avatar" src="${artist.avatar_url || '/static/assets/default_avatar.png'}" style="width: 72px; height: 72px; border-radius: 50%; object-fit: cover; border: 3px solid #fff; box-shadow: 0 8px 24px rgba(0,0,0,0.8);" />
              <div>
                <div style="font-family: 'Space Grotesk', sans-serif; font-size: 1.35rem; font-weight: 900; color: #fff;">${artist.name}</div>
                <div style="font-size: 0.78rem; color: #e2e8f0;">
                  ${artist.genre} &bull; ${(artist.monthly_listeners || 0).toLocaleString()} oyentes mensuales &bull; <span style="color: var(--accent-purple-light); font-weight: 700;">✓ Verificado</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <form id="edit-artist-form" style="display: flex; flex-direction: column; gap: 22px;">
          <div class="upload-grid">
            <div class="form-group">
              <label class="form-label">Nombre Artístico / Proyecto *</label>
              <input type="text" class="form-input" name="name" value="${artist.name}" required />
            </div>

            <div class="form-group">
              <label class="form-label">Género Principal *</label>
              <select class="form-select" name="genre">
                <option value="Synthwave" ${artist.genre === 'Synthwave' ? 'selected' : ''}>Synthwave / Retrowave</option>
                <option value="Indie Pop" ${artist.genre === 'Indie Pop' ? 'selected' : ''}>Indie Pop / Rock</option>
                <option value="Cyberpunk" ${artist.genre === 'Cyberpunk' ? 'selected' : ''}>Cyberpunk / Electronic</option>
                <option value="Acoustic" ${artist.genre === 'Acoustic' ? 'selected' : ''}>Acoustic / Folk</option>
                <option value="Hip Hop" ${artist.genre === 'Hip Hop' ? 'selected' : ''}>Hip Hop / Urban</option>
                <option value="Rock" ${artist.genre === 'Rock' ? 'selected' : ''}>Rock / Metal</option>
                <option value="Lo-Fi" ${artist.genre === 'Lo-Fi' ? 'selected' : ''}>Lo-Fi / Chillhop</option>
                <option value="Pop" ${artist.genre === 'Pop' ? 'selected' : ''}>Pop</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Biografía Oficial del Artista</label>
            <textarea class="form-textarea" name="bio" rows="4" placeholder="Cuéntale a tus oyentes tu trayectoria, influencias y próximos lanzamientos...">${artist.bio || ''}</textarea>
          </div>

          <div class="upload-grid">
            <div class="form-group">
              <label class="form-label">Actualizar Foto de Perfil (Avatar)</label>
              <div class="dropzone" style="padding: 20px;">
                <input type="file" id="input-avatar-file" name="avatar_file" accept="image/*" />
                <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 700;" id="avatar-label">
                  📷 Haz clic o arrastra una nueva foto cuadrada (JPG, PNG)
                </div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Actualizar Foto de Portada (Banner)</label>
              <div class="dropzone" style="padding: 20px;">
                <input type="file" id="input-banner-file" name="banner_file" accept="image/*" />
                <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 700;" id="banner-label">
                  🖼️ Haz clic o arrastra un banner panorámico (JPG, PNG)
                </div>
              </div>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px;">
            <button type="submit" id="btn-save-profile" class="btn-pill btn-pill-primary" style="padding: 12px 32px;">
              💾 Guardar Cambios en EarRape
            </button>
          </div>
        </form>
      </div>
    `;

    // Live preview for avatar file input
    const avatarInput = document.getElementById('input-avatar-file');
    avatarInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        document.getElementById('avatar-label').textContent = `✅ ${file.name}`;
        const previewEl = document.getElementById('preview-avatar');
        if (previewEl) previewEl.src = URL.createObjectURL(file);
      }
    });

    // Live preview for banner file input
    const bannerInput = document.getElementById('input-banner-file');
    bannerInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        document.getElementById('banner-label').textContent = `✅ ${file.name}`;
        const previewEl = document.getElementById('preview-banner');
        if (previewEl) previewEl.src = URL.createObjectURL(file);
      }
    });

    const form = document.getElementById('edit-artist-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('btn-save-profile');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Guardando...';
      }

      const formData = new FormData(form);
      try {
        const res = await fetch(`/api/artists/${this.currentArtistId}`, {
          method: 'PUT',
          body: formData
        });
        if (res.ok) {
          this.app.showToast('✨ Perfil de artista actualizado exitosamente');
          await this.render(document.querySelector('.view-content'));
        } else {
          const errData = await res.json();
          alert('Error al actualizar: ' + (errData.detail || 'No se pudo guardar'));
        }
      } catch (err) {
        alert('Error al actualizar: ' + err.message);
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = '💾 Guardar Cambios en EarRape';
        }
      }
    });
  }

  setUploadType(type) {
    this.uploadType = type;
    this.activeTab = 'upload';
    this.render(document.querySelector('.view-content'));
  }

  async deleteTrack(songId) {
    if (!confirm('¿Estás seguro de que deseas eliminar esta canción de EarRape?')) return;
    try {
      const res = await fetch(`/api/songs/${songId}`, { method: 'DELETE' });
      if (res.ok) {
        this.app.showToast('🗑️ Canción eliminada');
        await this.renderTabContent();
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  openNewArtistModal() {
    const name = prompt('Ingresa el nombre del nuevo artista:');
    if (!name) return;
    const genre = prompt('Género musical principal:', 'Pop');

    const formData = new FormData();
    formData.append('name', name);
    formData.append('genre', genre || 'Pop');

    fetch('/api/artists', {
      method: 'POST',
      body: formData
    })
      .then(res => res.json())
      .then(newArtist => {
        this.currentArtistId = newArtist.id;
        this.app.showToast(`🎙️ Artista "${newArtist.name}" registrado en EarRape`);
        this.render(document.querySelector('.view-content'));
      })
      .catch(err => alert('Error: ' + err.message));
  }
}
