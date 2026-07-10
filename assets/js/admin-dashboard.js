document.addEventListener('DOMContentLoaded', () => {
  const localHosts = ['localhost', '127.0.0.1', '::1'];
  const isLocalHost = localHosts.includes(window.location.hostname);
  const isFileProtocol = window.location.protocol === 'file:';
  const isWrongLocalOrigin = (isLocalHost && window.location.port !== '3000') || isFileProtocol;

  if (isWrongLocalOrigin) {
    const fileName = (window.location.pathname.split('/').pop() || 'admin-dashboard.html');
    const targetUrl = `http://localhost:3000/${fileName}${window.location.search}${window.location.hash}`;
    window.location.replace(targetUrl);
    return;
  }

  const tabBtns = document.querySelectorAll('.tab-btn');
  const activeCategoryTitle = document.getElementById('activeCategoryTitle');
  const activeCategoryCount = document.getElementById('activeCategoryCount');
  const adminWorksGrid = document.getElementById('adminWorksGrid');
  const adminWorksEmpty = document.getElementById('adminWorksEmpty');
  const dashboardSearchForm = document.getElementById('dashboardSearchForm');
  const dashboardSearchInput = document.getElementById('dashboardSearchInput');
  const adminPrevPageBtn = document.getElementById('adminPrevPageBtn');
  const adminNextPageBtn = document.getElementById('adminNextPageBtn');
  const adminPageInfo = document.getElementById('adminPageInfo');
  const dashboardLogoutBtn = document.getElementById('dashboardLogoutBtn');

  // New work modal elements
  const openNewWorkModalBtn = document.getElementById('openNewWorkModalBtn');
  const newWorkModal = document.getElementById('newWorkModal');
  const newWorkForm = document.getElementById('newWorkForm');
  const newCategorySelect = document.getElementById('newCategory');
  const closeNewWorkBtns = document.querySelectorAll('.close-new-work-modal');

  // Edit work modal elements
  const dashboardEditModal = document.getElementById('dashboardEditModal');
  const dashboardEditForm = document.getElementById('dashboardEditForm');
  const dashEditWorkId = document.getElementById('dashEditWorkId');
  const dashEditTitle = document.getElementById('dashEditTitle');
  const dashEditCategory = document.getElementById('dashEditCategory');
  const dashEditDescription = document.getElementById('dashEditDescription');
  const dashEditYear = document.getElementById('dashEditYear');
  const dashEditImage = document.getElementById('dashEditImage');
  const closeDashEditBtns = document.querySelectorAll('.close-dash-edit-modal');

  let selectedCategory = 'All';
  let currentPage = 1;
  const pageLimit = 9;
  let currentQuery = '';
  let totalPages = 1;
  let currentWorks = [];
  const API_BASE = '';

  async function api(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, { credentials: API_BASE ? 'include' : 'same-origin', ...options });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 405 && path.startsWith('/api/')) {
        throw new Error('Method not allowed by static server. Start backend with npm start and use http://localhost:3000.');
      }
      throw new Error(body.error || 'Server error');
    }
    return body;
  }

  async function checkAdminSession() {
    try {
      const res = await api('/api/auth/me');
      if (!res.authenticated) {
        window.location.href = 'works.html';
      }
    } catch (_err) {
      window.location.href = 'works.html';
    }
  }

  function renderDashboardWorks() {
    if (!adminWorksGrid || !adminWorksEmpty) return;
    adminWorksGrid.innerHTML = '';

    if (!currentWorks.length) {
      adminWorksEmpty.classList.remove('hidden');
    } else {
      adminWorksEmpty.classList.add('hidden');
      currentWorks.forEach(work => {
        const card = document.createElement('article');
        card.className = 'admin-work-card';

        card.innerHTML = `
          <img src="${work.imageUrl}" alt="${work.title}">
          <div class="admin-card-body">
            <div class="admin-card-meta">
              <div class="admin-card-category">${work.category || 'Landscape Paintings'} • ${work.year || 'N/A'}</div>
              <h3>${work.title}</h3>
              <p class="admin-card-desc">${work.description || 'No description'}</p>
            </div>
            <div class="admin-card-footer">
              <button type="button" class="ghost-btn edit-btn">Edit</button>
              <button type="button" class="ghost-btn delete-btn" style="border-color: #a33; color: #e66;">Delete</button>
            </div>
          </div>
        `;

        card.querySelector('.edit-btn').addEventListener('click', () => {
          openEditModal(work);
        });

        card.querySelector('.delete-btn').addEventListener('click', () => {
          deleteArtwork(work);
        });

        adminWorksGrid.appendChild(card);
      });
    }

    if (adminPageInfo) {
      adminPageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
      if (adminPrevPageBtn) adminPrevPageBtn.disabled = currentPage <= 1;
      if (adminNextPageBtn) adminNextPageBtn.disabled = currentPage >= totalPages;
    }
  }

  async function loadDashboardWorks() {
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageLimit)
      });
      if (currentQuery) params.set('q', currentQuery);
      if (selectedCategory !== 'All') params.set('category', selectedCategory);

      const res = await api(`/api/works?${params.toString()}`);
      currentWorks = Array.isArray(res) ? res : (res.items || []);
      const totalItems = res.pagination ? res.pagination.totalItems : currentWorks.length;
      totalPages = res.pagination ? res.pagination.totalPages : 1;

      if (activeCategoryTitle) activeCategoryTitle.textContent = selectedCategory === 'All' ? 'All Categories' : selectedCategory;
      if (activeCategoryCount) activeCategoryCount.textContent = `${totalItems} total artwork(s) in view`;

      renderDashboardWorks();
    } catch (err) {
      if (activeCategoryCount) activeCategoryCount.textContent = `Error loading works: ${err.message}`;
    }
  }

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedCategory = btn.getAttribute('data-category');
      currentPage = 1;
      loadDashboardWorks();
    });
  });

  if (dashboardSearchForm && dashboardSearchInput) {
    dashboardSearchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      currentQuery = String(dashboardSearchInput.value || '').trim();
      currentPage = 1;
      loadDashboardWorks();
    });
  }

  if (adminPrevPageBtn) {
    adminPrevPageBtn.addEventListener('click', () => {
      if (currentPage > 1) { currentPage--; loadDashboardWorks(); }
    });
  }

  if (adminNextPageBtn) {
    adminNextPageBtn.addEventListener('click', () => {
      if (currentPage < totalPages) { currentPage++; loadDashboardWorks(); }
    });
  }

  if (dashboardLogoutBtn) {
    dashboardLogoutBtn.addEventListener('click', async () => {
      await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
      window.location.href = 'works.html';
    });
  }

  // New Work Modal Handlers
  if (openNewWorkModalBtn && newWorkModal) {
    openNewWorkModalBtn.addEventListener('click', () => {
      if (selectedCategory !== 'All' && newCategorySelect) {
        newCategorySelect.value = selectedCategory;
      }
      newWorkModal.classList.remove('hidden');
    });
  }

  closeNewWorkBtns.forEach(btn => {
    btn.addEventListener('click', () => newWorkModal && newWorkModal.classList.add('hidden'));
  });

  if (newWorkForm) {
    newWorkForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('/api/works', { method: 'POST', body: new FormData(newWorkForm) });
        newWorkForm.reset();
        newWorkModal.classList.add('hidden');
        currentPage = 1;
        loadDashboardWorks();
      } catch (err) {
        alert(`Upload failed: ${err.message}`);
      }
    });
  }

  // Edit Work Modal Handlers
  function openEditModal(work) {
    if (!dashboardEditModal) return;
    dashEditWorkId.value = work.id;
    dashEditTitle.value = work.title || '';
    dashEditCategory.value = work.category || 'Landscape Paintings';
    dashEditDescription.value = work.description || '';
    dashEditYear.value = work.year || '';
    if (dashEditImage) dashEditImage.value = '';
    dashboardEditModal.classList.remove('hidden');
  }

  closeDashEditBtns.forEach(btn => {
    btn.addEventListener('click', () => dashboardEditModal && dashboardEditModal.classList.add('hidden'));
  });

  if (dashboardEditForm) {
    dashboardEditForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api(`/api/works/${dashEditWorkId.value}`, { method: 'PUT', body: new FormData(dashboardEditForm) });
        dashboardEditModal.classList.add('hidden');
        loadDashboardWorks();
      } catch (err) {
        alert(`Update failed: ${err.message}`);
      }
    });
  }

  async function deleteArtwork(work) {
    if (!confirm(`Delete artwork "${work.title}"?`)) return;
    try {
      await api(`/api/works/${work.id}`, { method: 'DELETE' });
      if (currentWorks.length === 1 && currentPage > 1) currentPage--;
      loadDashboardWorks();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  }

  checkAdminSession();
  loadDashboardWorks();
});
