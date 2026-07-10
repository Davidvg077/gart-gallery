document.addEventListener('DOMContentLoaded', () => {
  const localHosts = ['localhost', '127.0.0.1', '::1'];
  const isLocalHost = localHosts.includes(window.location.hostname);
  const isFileProtocol = window.location.protocol === 'file:';
  const isWrongLocalOrigin = (isLocalHost && window.location.port !== '3000') || isFileProtocol;

  if (isWrongLocalOrigin) {
    const fileName = (window.location.pathname.split('/').pop() || 'index.html');
    const targetUrl = `http://localhost:3000/${fileName}${window.location.search}${window.location.hash}`;
    window.location.replace(targetUrl);
    return;
  }

  const worksList = document.getElementById('worksList');
  const worksEmpty = document.getElementById('worksEmpty');
  const worksSearchForm = document.getElementById('worksSearchForm');
  const worksSearchInput = document.getElementById('worksSearchInput');
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const pageInfo = document.getElementById('pageInfo');

  const adminPortalModal = document.getElementById('adminPortalModal');
  const openArtistPortalLinks = document.querySelectorAll('.open-artist-portal-link');
  const closeAdminPortalBtns = document.querySelectorAll('.close-admin-portal-btn');

  const loginForm = document.getElementById('adminLoginForm') || document.getElementById('loginForm');
  const uploadForm = document.getElementById('uploadForm');
  const uploadPanel = document.getElementById('uploadPanel');
  const logoutBtn = document.getElementById('logoutBtn');
  const authStatus = document.getElementById('authStatus');

  const editModal = document.getElementById('editModal');
  const editForm = document.getElementById('editForm');
  const editWorkId = document.getElementById('editWorkId');
  const editTitle = document.getElementById('editTitle');
  const editCategory = document.getElementById('editCategory');
  const editDescription = document.getElementById('editDescription');
  const editYear = document.getElementById('editYear');
  const editImage = document.getElementById('editImage');
  const closeModalBtn = document.getElementById('closeModalBtn');

  const activeCategory = document.body.getAttribute('data-category') || '';
  const API_BASE = '';

  let isAuthenticated = false;
  let currentPage = 1;
  const pageLimit = 6;
  let currentQuery = '';
  let totalPages = 1;
  let currentWorks = [];

  function setStatus(message) {
    if (authStatus) {
      authStatus.textContent = message;
    }
  }

  async function api(path, options = {}) {
    let response;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        credentials: API_BASE ? 'include' : 'same-origin',
        ...options
      });
    } catch (_error) {
      throw new Error('Cannot reach server. Start backend with: npm start');
    }

    let body = {};
    try {
      body = await response.json();
    } catch (_error) {
      body = {};
    }

    if (!response.ok) {
      if (response.status === 404 && path.startsWith('/api/')) {
        throw new Error('API not found. Run this project as Web Service (Node), not static only.');
      }
      if (response.status === 405 && path.startsWith('/api/')) {
        throw new Error('Method not allowed by static server. Start backend with npm start and use http://localhost:3000.');
      }
      throw new Error(body.error || `Request failed (${response.status})`);
    }

    return body;
  }

  function openAdminPortal(e) {
    if (e) {
      e.preventDefault();
    }
    if (!adminPortalModal) {
      return;
    }
    adminPortalModal.classList.remove('hidden');
    adminPortalModal.setAttribute('aria-hidden', 'false');
  }

  function closeAdminPortal(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!adminPortalModal) {
      return;
    }
    adminPortalModal.classList.add('hidden');
    adminPortalModal.setAttribute('aria-hidden', 'true');
  }

  openArtistPortalLinks.forEach((link) => {
    link.addEventListener('click', openAdminPortal);
  });

  closeAdminPortalBtns.forEach((btn) => {
    btn.addEventListener('click', closeAdminPortal);
  });

  if (adminPortalModal) {
    adminPortalModal.addEventListener('click', (e) => {
      if (e.target === adminPortalModal) {
        closeAdminPortal(e);
      }
    });
  }

  function setAuthState(authenticated) {
    isAuthenticated = Boolean(authenticated);
    if (loginForm) {
      loginForm.classList.toggle('hidden', isAuthenticated);
    }
    if (uploadPanel) {
      uploadPanel.classList.toggle('hidden', !isAuthenticated);
    }
    setStatus(isAuthenticated ? 'Signed in.' : 'Sign in to manage works.');
    if (worksList) {
      renderWorks();
    }
  }

  async function checkAuth() {
    try {
      const result = await api('/api/auth/me');
      setAuthState(Boolean(result.authenticated));
    } catch (_error) {
      setAuthState(false);
    }
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const formData = new FormData(loginForm);
      const payload = {
        username: String(formData.get('username') || '').trim(),
        password: String(formData.get('password') || '')
      };

      try {
        await api('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        loginForm.reset();
        setAuthState(true);
        window.location.href = 'admin-dashboard.html';
      } catch (error) {
        setStatus(error.message);
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await api('/api/auth/logout', { method: 'POST' });
        setAuthState(false);
      } catch (error) {
        setStatus(error.message);
      }
    });
  }

  if (uploadForm) {
    uploadForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(uploadForm);

      try {
        await api('/api/works', {
          method: 'POST',
          body: data
        });
        uploadForm.reset();
        setStatus('Work uploaded successfully.');
        if (worksList) {
          currentPage = 1;
          await loadWorks();
        }
      } catch (error) {
        setStatus(error.message);
      }
    });
  }

  function openEditModal(work) {
    if (!editModal) {
      return;
    }
    editWorkId.value = work.id;
    editTitle.value = work.title || '';
    if (editCategory) {
      editCategory.value = work.category || 'Landscape Paintings';
    }
    editDescription.value = work.description || '';
    editYear.value = work.year || '';
    if (editImage) {
      editImage.value = '';
    }
    editModal.classList.remove('hidden');
    editModal.setAttribute('aria-hidden', 'false');
  }

  function closeEditModal(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!editModal) {
      return;
    }
    editModal.classList.add('hidden');
    editModal.setAttribute('aria-hidden', 'true');
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeEditModal);
  }

  if (editModal) {
    editModal.addEventListener('click', (e) => {
      if (e.target === editModal) {
        closeEditModal(e);
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') {
      return;
    }
    if (editModal && !editModal.classList.contains('hidden')) {
      closeEditModal(e);
      return;
    }
    if (adminPortalModal && !adminPortalModal.classList.contains('hidden')) {
      closeAdminPortal(e);
    }
  });

  if (editForm) {
    editForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const id = editWorkId.value;
      const formData = new FormData(editForm);

      try {
        await api(`/api/works/${id}`, {
          method: 'PUT',
          body: formData
        });
        closeEditModal();
        setStatus('Work updated successfully.');
        if (worksList) {
          await loadWorks();
        }
      } catch (error) {
        setStatus(error.message);
      }
    });
  }

  function createWorkCard(work) {
    const article = document.createElement('article');
    article.className = 'work-item';

    const image = document.createElement('img');
    image.src = work.imageUrl;
    image.alt = work.title;

    const info = document.createElement('div');
    info.className = 'work-info';

    const title = document.createElement('h3');
    title.textContent = work.title;

    const description = document.createElement('p');
    description.textContent = work.description || 'No description';

    const meta = document.createElement('p');
    meta.className = 'work-meta';

    const createdDate = new Date(work.createdAt);
    const dateLabel = Number.isNaN(createdDate.getTime())
      ? ''
      : createdDate.toLocaleDateString('en-US');

    meta.textContent = [work.category, work.year, dateLabel].filter(Boolean).join(' • ');

    info.appendChild(title);
    info.appendChild(description);
    info.appendChild(meta);

    if (isAuthenticated) {
      const actions = document.createElement('div');
      actions.className = 'work-actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => openEditModal(work));

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => deleteWork(work));

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
      info.appendChild(actions);
    }

    article.appendChild(image);
    article.appendChild(info);

    return article;
  }

  function updatePagination() {
    if (!pageInfo || !prevPageBtn || !nextPageBtn) {
      return;
    }
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
  }

  function renderWorks() {
    if (!worksList || !worksEmpty) {
      return;
    }

    worksList.innerHTML = '';

    if (!currentWorks.length) {
      worksEmpty.classList.remove('hidden');
      updatePagination();
      return;
    }

    worksEmpty.classList.add('hidden');
    currentWorks.forEach((work) => {
      worksList.appendChild(createWorkCard(work));
    });
    updatePagination();
  }

  async function loadWorks() {
    if (!worksList) {
      return;
    }

    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageLimit)
      });

      if (currentQuery) {
        params.set('q', currentQuery);
      }
      if (activeCategory) {
        params.set('category', activeCategory);
      }

      const result = await api(`/api/works?${params.toString()}`);
      currentWorks = Array.isArray(result) ? result : (result.items || []);
      totalPages = Array.isArray(result)
        ? 1
        : Math.max(1, Number(result.pagination && result.pagination.totalPages) || 1);

      renderWorks();
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function deleteWork(work) {
    const confirmDelete = window.confirm(`Delete work "${work.title}"?`);
    if (!confirmDelete) {
      return;
    }

    try {
      await api(`/api/works/${work.id}`, { method: 'DELETE' });
      setStatus('Work deleted successfully.');

      if (currentWorks.length === 1 && currentPage > 1) {
        currentPage -= 1;
      }
      await loadWorks();
    } catch (error) {
      setStatus(error.message);
    }
  }

  if (worksSearchForm && worksSearchInput) {
    worksSearchForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      currentQuery = String(worksSearchInput.value || '').trim();
      currentPage = 1;
      await loadWorks();
    });
  }

  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', async () => {
      if (currentPage <= 1) {
        return;
      }
      currentPage -= 1;
      await loadWorks();
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', async () => {
      if (currentPage >= totalPages) {
        return;
      }
      currentPage += 1;
      await loadWorks();
    });
  }

  checkAuth();
  if (worksList) {
    loadWorks();
  }
});