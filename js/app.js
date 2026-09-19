/**
 * JobTrack Live — Interactive Real-Time Job Application Tracker
 * Works Standalone (GitHub Pages / Mobile / Desktop) & with Collaborative Server
 */

// Default Seed Applications
const defaultSeedJobs = [
  {
    id: "job-101",
    company: "Apple Inc.",
    role: "Senior iOS / Swift Platform Engineer",
    appliedDate: "2026-09-15",
    source: "LinkedIn",
    status: "Applied",
    contact: "Rachel Adams (Talent Partner)",
    followUpDate: "2026-09-24",
    notes: "Submitted portfolio with Swift, Metal, and UI architecture.",
    updatedAt: new Date().toISOString()
  },
  {
    id: "job-102",
    company: "Microsoft",
    role: "Senior Cloud Architect",
    appliedDate: "2026-09-12",
    source: "Referral",
    status: "Referral",
    contact: "David Kim (Partner Eng Lead)",
    followUpDate: "2026-09-22",
    notes: "Internal referral through Azure core team.",
    updatedAt: new Date().toISOString()
  },
  {
    id: "job-103",
    company: "Amazon Web Services",
    role: "Software Development Engineer II",
    appliedDate: "2026-09-05",
    source: "Company Site",
    status: "Interviewing",
    contact: "Jessica Taylor (Tech Recruiter)",
    followUpDate: "2026-09-21",
    notes: "Passed initial round. Final loop scheduled next week.",
    updatedAt: new Date().toISOString()
  },
  {
    id: "job-104",
    company: "Spotify",
    role: "Staff Frontend Engineer",
    appliedDate: "2026-08-25",
    source: "LinkedIn",
    status: "Selected",
    contact: "Johan Lind (Head of Talent)",
    followUpDate: "2026-09-25",
    notes: "Formal offer package received! Reviewing equity grant.",
    updatedAt: new Date().toISOString()
  },
  {
    id: "job-105",
    company: "Meta Platforms",
    role: "Production Engineer - Systems",
    appliedDate: "2026-08-15",
    source: "Indeed",
    status: "Rejected",
    contact: "Global Talent Team",
    followUpDate: "2026-08-30",
    notes: "Role filled internally. Advised to reapply next cycle.",
    updatedAt: new Date().toISOString()
  }
];

// Application State
const state = {
  jobs: [],
  selectedIds: new Set(),
  currentFilter: 'All',
  searchQuery: '',
  sortColumn: 'appliedDate',
  sortDirection: 'desc',
  activeEditCell: null,
  activeDropdownJobId: null,
  lastDeletedJob: null,
  onlineUsers: 1,
  isEventSourceConnected: false,
  isStandalone: false
};

// DOM Element References
const elements = {
  jobsTableBody: document.getElementById('jobsTableBody'),
  emptyState: document.getElementById('emptyState'),
  searchInput: document.getElementById('searchInput'),
  clearSearchBtn: document.getElementById('clearSearchBtn'),
  statusFilters: document.getElementById('statusFilters'),
  selectAllCheckbox: document.getElementById('selectAllCheckbox'),
  bulkActions: document.getElementById('bulkActions'),
  bulkCount: document.getElementById('bulkCount'),
  btnBulkDelete: document.getElementById('btnBulkDelete'),
  btnToggleAddRow: document.getElementById('btnToggleAddRow'),
  btnExportCsv: document.getElementById('btnExportCsv'),
  btnResetData: document.getElementById('btnResetData'),
  liveStatusBadge: document.getElementById('liveStatusBadge'),
  liveStatusText: document.getElementById('liveStatusText'),
  activeClientsCount: document.getElementById('activeClientsCount'),
  toastContainer: document.getElementById('toastContainer'),
  
  // Stats & Progress Bar
  totalAppsCount: document.getElementById('totalAppsCount'),
  interviewRate: document.getElementById('interviewRate'),
  interviewCountSub: document.getElementById('interviewCountSub'),
  selectedRate: document.getElementById('selectedRate'),
  selectedCountSub: document.getElementById('selectedCountSub'),
  followUpCount: document.getElementById('followUpCount'),
  followUpSub: document.getElementById('followUpSub'),
  statusLegend: document.getElementById('statusLegend'),
  segApplied: document.getElementById('segApplied'),
  segReferral: document.getElementById('segReferral'),
  segInterviewing: document.getElementById('segInterviewing'),
  segSelected: document.getElementById('segSelected'),
  segRejected: document.getElementById('segRejected'),

  // Filter Counters
  filterCountAll: document.getElementById('filterCountAll'),
  filterCountApplied: document.getElementById('filterCountApplied'),
  filterCountReferral: document.getElementById('filterCountReferral'),
  filterCountInterviewing: document.getElementById('filterCountInterviewing'),
  filterCountSelected: document.getElementById('filterCountSelected'),
  filterCountRejected: document.getElementById('filterCountRejected'),

  // Inline Add Inputs
  inlineAddRow: document.getElementById('inlineAddRow'),
  newCompany: document.getElementById('newCompany'),
  newRole: document.getElementById('newRole'),
  newAppliedDate: document.getElementById('newAppliedDate'),
  newSource: document.getElementById('newSource'),
  newStatus: document.getElementById('newStatus'),
  newContact: document.getElementById('newContact'),
  newFollowUpDate: document.getElementById('newFollowUpDate'),
  newNotes: document.getElementById('newNotes'),
  btnSubmitNewJob: document.getElementById('btnSubmitNewJob'),

  // Notes Modal
  notesModal: document.getElementById('notesModal'),
  modalCompanyTitle: document.getElementById('modalCompanyTitle'),
  modalNotesTextarea: document.getElementById('modalNotesTextarea'),
  closeNotesModal: document.getElementById('closeNotesModal'),
  cancelNotesModal: document.getElementById('cancelNotesModal'),
  saveNotesModal: document.getElementById('saveNotesModal')
};

let currentModalJobId = null;

// ============================================================================
// Initialization
// ============================================================================
async function initApp() {
  if (elements.newAppliedDate) {
    elements.newAppliedDate.value = new Date().toISOString().split('T')[0];
  }
  
  await fetchJobs();
  setupEventSource();
  bindEvents();
}

const STORAGE_KEY = 'jobtrack_persistent_store';
const INIT_KEY = 'jobtrack_initialized_flag';

// Local Storage Helper
function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.jobs));
    localStorage.setItem(INIT_KEY, 'true');
  } catch (err) {
    console.warn('Storage save failed:', err);
  }
}

function loadFromStorage() {
  try {
    const isInit = localStorage.getItem(INIT_KEY);
    if (isInit === 'true') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
      return [];
    }
  } catch (err) {
    console.warn('Storage load failed:', err);
  }
  return null;
}

// Load applications (Strictly preserves user state and syncs with backend server if available)
async function fetchJobs() {
  let backendLoaded = false;

  // 1. Try to fetch from server API (works on localhost, LAN IP 192.168.x.x, or hosted cloud backend)
  try {
    const res = await fetch('/api/jobs', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.jobs)) {
        state.jobs = data.jobs;
        saveToStorage();
        renderAll();
        backendLoaded = true;
      }
    }
  } catch (_) {
    // Backend not reachable (e.g. running standalone on GitHub Pages or offline)
  }

  // 2. If backend is not available, use local device storage
  if (!backendLoaded) {
    const savedLocal = loadFromStorage();
    if (savedLocal !== null) {
      // User has state saved on this device
      state.jobs = savedLocal;
      renderAll();
    } else {
      // Brand new visit in standalone mode: load seed data
      state.jobs = [...defaultSeedJobs];
      saveToStorage();
      renderAll();
    }
  }
}

// Real-Time Server-Sent Events setup
function setupEventSource() {
  if (window.location.protocol === 'file:' || state.isStandalone) {
    updateLiveStatus(true, true);
    return;
  }

  try {
    const eventSource = new EventSource('/api/jobs/stream');

    eventSource.addEventListener('connected', (e) => {
      state.isEventSourceConnected = true;
      updateLiveStatus(true, false);
      try {
        const data = JSON.parse(e.data);
        if (data.clientCount) updateClientCount(data.clientCount);
      } catch (_) {}
    });

    eventSource.addEventListener('client_count', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.clientCount) updateClientCount(data.clientCount);
      } catch (_) {}
    });

    eventSource.addEventListener('job_created', (e) => {
      try {
        const newJob = JSON.parse(e.data);
        if (!state.jobs.some(j => j.id === newJob.id)) {
          state.jobs.unshift(newJob);
          saveToStorage();
          renderAll();
          showToast(`New application: ${newJob.company}`, 'info');
        }
      } catch (_) {}
    });

    eventSource.addEventListener('job_updated', (e) => {
      try {
        const updatedJob = JSON.parse(e.data);
        const index = state.jobs.findIndex(j => j.id === updatedJob.id);
        if (index !== -1) {
          state.jobs[index] = updatedJob;
          saveToStorage();
          renderAll();
        }
      } catch (_) {}
    });

    eventSource.addEventListener('job_deleted', (e) => {
      try {
        const { id } = JSON.parse(e.data);
        state.jobs = state.jobs.filter(j => j.id !== id);
        state.selectedIds.delete(id);
        saveToStorage();
        renderAll();
      } catch (_) {}
    });

    eventSource.addEventListener('bulk_deleted', (e) => {
      try {
        const { ids } = JSON.parse(e.data);
        if (Array.isArray(ids)) {
          const idSet = new Set(ids);
          state.jobs = state.jobs.filter(j => !idSet.has(j.id));
          ids.forEach(id => state.selectedIds.delete(id));
          saveToStorage();
          renderAll();
        }
      } catch (_) {}
    });

    eventSource.addEventListener('jobs_reset', (e) => {
      try {
        const { jobs } = JSON.parse(e.data);
        if (Array.isArray(jobs)) {
          state.jobs = jobs;
          saveToStorage();
          renderAll();
        }
      } catch (_) {}
    });

    eventSource.onerror = () => {
      updateLiveStatus(true, true);
    };
  } catch (_) {
    updateLiveStatus(true, true);
  }
}

function updateLiveStatus(isOk, isStandaloneMode = false) {
  if (!elements.liveStatusBadge) return;
  if (isStandaloneMode) {
    elements.liveStatusBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    elements.liveStatusText.textContent = 'Active (No Login)';
    elements.activeClientsCount.textContent = 'Live';
  } else if (isOk) {
    elements.liveStatusBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    elements.liveStatusText.textContent = 'Live Sync (No Login)';
  } else {
    elements.liveStatusText.textContent = 'Active (Offline)';
  }
}

function updateClientCount(count) {
  state.onlineUsers = count;
  if (elements.activeClientsCount) {
    elements.activeClientsCount.textContent = `${count} online`;
  }
}

// ============================================================================
// Event Listeners Binding
// ============================================================================
function bindEvents() {
  // Search input
  if (elements.searchInput) {
    elements.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim().toLowerCase();
      if (elements.clearSearchBtn) {
        elements.clearSearchBtn.style.display = state.searchQuery ? 'block' : 'none';
      }
      renderTable();
    });
  }

  if (elements.clearSearchBtn) {
    elements.clearSearchBtn.addEventListener('click', () => {
      elements.searchInput.value = '';
      state.searchQuery = '';
      elements.clearSearchBtn.style.display = 'none';
      renderTable();
    });
  }

  // Filter Chips
  if (elements.statusFilters) {
    elements.statusFilters.addEventListener('click', (e) => {
      const chip = e.target.closest('.filter-chip');
      if (!chip) return;
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.currentFilter = chip.dataset.filter;
      renderTable();
    });
  }

  // Header Sorting
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (state.sortColumn === col) {
        state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortColumn = col;
        state.sortDirection = 'asc';
      }
      updateSortHeaderIndicators();
      renderTable();
    });
  });

  // Select All Checkbox
  if (elements.selectAllCheckbox) {
    elements.selectAllCheckbox.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      const visibleJobs = getFilteredAndSortedJobs();
      if (isChecked) {
        visibleJobs.forEach(j => state.selectedIds.add(j.id));
      } else {
        state.selectedIds.clear();
      }
      updateBulkToolbar();
      renderTable();
    });
  }

  if (elements.btnBulkDelete) {
    elements.btnBulkDelete.addEventListener('click', handleBulkDelete);
  }

  if (elements.btnToggleAddRow) {
    elements.btnToggleAddRow.addEventListener('click', () => {
      if (elements.newCompany) elements.newCompany.focus();
      if (elements.inlineAddRow) {
        elements.inlineAddRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  // Inline Quick Add
  if (elements.btnSubmitNewJob) {
    elements.btnSubmitNewJob.addEventListener('click', handleAddNewJob);
  }
  if (elements.inlineAddRow) {
    elements.inlineAddRow.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddNewJob();
      }
    });
  }

  if (elements.btnExportCsv) {
    elements.btnExportCsv.addEventListener('click', exportToCSV);
  }

  // Notes Modal Actions
  if (elements.closeNotesModal) elements.closeNotesModal.addEventListener('click', closeNotesModal);
  if (elements.cancelNotesModal) elements.cancelNotesModal.addEventListener('click', closeNotesModal);
  if (elements.saveNotesModal) elements.saveNotesModal.addEventListener('click', saveNotesModal);
  if (elements.notesModal) {
    elements.notesModal.addEventListener('click', (e) => {
      if (e.target === elements.notesModal) closeNotesModal();
    });
  }

  // Dismiss status dropdowns
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.status-pill-container')) {
      closeAllStatusDropdowns();
    }
  });
}

function updateSortHeaderIndicators() {
  document.querySelectorAll('th.sortable').forEach(th => {
    const arrow = th.querySelector('.sort-arrow');
    if (!arrow) return;
    if (th.dataset.sort === state.sortColumn) {
      arrow.textContent = state.sortDirection === 'asc' ? '▲' : '▼';
      arrow.style.color = '#fff';
    } else {
      arrow.textContent = '↕';
      arrow.style.color = 'var(--text-muted)';
    }
  });
}

// ============================================================================
// Core Data Processing & Stats Calculations
// ============================================================================
function getFilteredAndSortedJobs() {
  let list = [...state.jobs];

  // 1. Status Filter
  if (state.currentFilter !== 'All') {
    list = list.filter(j => (j.status || '').toLowerCase() === state.currentFilter.toLowerCase());
  }

  // 2. Search Query
  if (state.searchQuery) {
    const q = state.searchQuery;
    list = list.filter(j => 
      (j.company && j.company.toLowerCase().includes(q)) ||
      (j.role && j.role.toLowerCase().includes(q)) ||
      (j.contact && j.contact.toLowerCase().includes(q)) ||
      (j.notes && j.notes.toLowerCase().includes(q)) ||
      (j.source && j.source.toLowerCase().includes(q))
    );
  }

  // 3. Sorting
  list.sort((a, b) => {
    let valA = a[state.sortColumn] || '';
    let valB = b[state.sortColumn] || '';

    if (state.sortColumn === 'appliedDate' || state.sortColumn === 'followUpDate') {
      valA = new Date(valA || '1970-01-01').getTime();
      valB = new Date(valB || '1970-01-01').getTime();
    } else {
      valA = valA.toString().toLowerCase();
      valB = valB.toString().toLowerCase();
    }

    if (valA < valB) return state.sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return state.sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  return list;
}

function updateMetricsAndBreakdown() {
  const total = state.jobs.length;

  const counts = {
    Applied: 0,
    Referral: 0,
    Interviewing: 0,
    Selected: 0,
    Rejected: 0
  };

  let pendingFollowUps = 0;
  const todayStr = new Date().toISOString().split('T')[0];

  state.jobs.forEach(job => {
    if (counts[job.status] !== undefined) {
      counts[job.status]++;
    }
    if (job.followUpDate) {
      if (job.followUpDate >= todayStr || job.status === 'Interviewing') {
        pendingFollowUps++;
      }
    }
  });

  const pcts = {
    Applied: total > 0 ? ((counts.Applied / total) * 100).toFixed(1) : 0,
    Referral: total > 0 ? ((counts.Referral / total) * 100).toFixed(1) : 0,
    Interviewing: total > 0 ? ((counts.Interviewing / total) * 100).toFixed(1) : 0,
    Selected: total > 0 ? ((counts.Selected / total) * 100).toFixed(1) : 0,
    Rejected: total > 0 ? ((counts.Rejected / total) * 100).toFixed(1) : 0,
  };

  if (elements.totalAppsCount) elements.totalAppsCount.textContent = total;

  const interviewSuccessRate = total > 0 
    ? (((counts.Interviewing + counts.Selected) / total) * 100).toFixed(0)
    : 0;
  if (elements.interviewRate) elements.interviewRate.textContent = `${interviewSuccessRate}%`;
  if (elements.interviewCountSub) elements.interviewCountSub.textContent = `${counts.Interviewing} in progress`;

  const selectedRate = total > 0 
    ? ((counts.Selected / total) * 100).toFixed(0)
    : 0;
  if (elements.selectedRate) elements.selectedRate.textContent = `${selectedRate}%`;
  if (elements.selectedCountSub) elements.selectedCountSub.textContent = `${counts.Selected} ${counts.Selected === 1 ? 'offer' : 'offers'}`;

  if (elements.followUpCount) elements.followUpCount.textContent = pendingFollowUps;
  if (elements.followUpSub) elements.followUpSub.textContent = pendingFollowUps === 1 ? 'requires attention' : 'require attention';

  if (elements.filterCountAll) elements.filterCountAll.textContent = total;
  if (elements.filterCountApplied) elements.filterCountApplied.textContent = counts.Applied;
  if (elements.filterCountReferral) elements.filterCountReferral.textContent = counts.Referral;
  if (elements.filterCountInterviewing) elements.filterCountInterviewing.textContent = counts.Interviewing;
  if (elements.filterCountSelected) elements.filterCountSelected.textContent = counts.Selected;
  if (elements.filterCountRejected) elements.filterCountRejected.textContent = counts.Rejected;

  if (elements.segApplied) {
    elements.segApplied.style.width = `${pcts.Applied}%`;
    elements.segApplied.textContent = pcts.Applied > 6 ? `${pcts.Applied}%` : '';
    elements.segApplied.title = `Applied: ${counts.Applied} (${pcts.Applied}%)`;
  }
  if (elements.segReferral) {
    elements.segReferral.style.width = `${pcts.Referral}%`;
    elements.segReferral.textContent = pcts.Referral > 6 ? `${pcts.Referral}%` : '';
    elements.segReferral.title = `Referral: ${counts.Referral} (${pcts.Referral}%)`;
  }
  if (elements.segInterviewing) {
    elements.segInterviewing.style.width = `${pcts.Interviewing}%`;
    elements.segInterviewing.textContent = pcts.Interviewing > 6 ? `${pcts.Interviewing}%` : '';
    elements.segInterviewing.title = `Interviewing: ${counts.Interviewing} (${pcts.Interviewing}%)`;
  }
  if (elements.segSelected) {
    elements.segSelected.style.width = `${pcts.Selected}%`;
    elements.segSelected.textContent = pcts.Selected > 6 ? `${pcts.Selected}%` : '';
    elements.segSelected.title = `Selected: ${counts.Selected} (${pcts.Selected}%)`;
  }
  if (elements.segRejected) {
    elements.segRejected.style.width = `${pcts.Rejected}%`;
    elements.segRejected.textContent = pcts.Rejected > 6 ? `${pcts.Rejected}%` : '';
    elements.segRejected.title = `Rejected: ${counts.Rejected} (${pcts.Rejected}%)`;
  }

  renderBreakdownLegend(counts, pcts);
}

function renderBreakdownLegend(counts, pcts) {
  if (!elements.statusLegend) return;
  const legendItems = [
    { label: 'Applied', color: 'var(--status-applied)', count: counts.Applied, pct: pcts.Applied },
    { label: 'Referral', color: 'var(--status-referral)', count: counts.Referral, pct: pcts.Referral },
    { label: 'Interviewing', color: 'var(--status-interview)', count: counts.Interviewing, pct: pcts.Interviewing },
    { label: 'Selected', color: 'var(--status-selected)', count: counts.Selected, pct: pcts.Selected },
    { label: 'Rejected', color: 'var(--status-rejected)', count: counts.Rejected, pct: pcts.Rejected }
  ];

  elements.statusLegend.innerHTML = legendItems.map(item => `
    <div class="legend-pill" title="${item.label}: ${item.count} applications (${item.pct}%)">
      <span class="legend-dot" style="background: ${item.color};"></span>
      <span>${item.label}</span>
      <span class="legend-pct">${item.pct}%</span>
    </div>
  `).join('');
}

// ============================================================================
// Table Rendering & Inline Editing
// ============================================================================
function renderAll() {
  updateMetricsAndBreakdown();
  renderTable();
  updateBulkToolbar();
}

function renderTable() {
  if (!elements.jobsTableBody) return;
  const visibleJobs = getFilteredAndSortedJobs();
  
  const existingRows = elements.jobsTableBody.querySelectorAll('tr:not(#inlineAddRow)');
  existingRows.forEach(r => r.remove());

  if (visibleJobs.length === 0) {
    if (elements.emptyState) elements.emptyState.style.display = 'block';
  } else {
    if (elements.emptyState) elements.emptyState.style.display = 'none';

    visibleJobs.forEach(job => {
      const tr = createJobRowElement(job);
      elements.jobsTableBody.appendChild(tr);
    });
  }

  if (elements.selectAllCheckbox) {
    if (visibleJobs.length > 0 && visibleJobs.every(j => state.selectedIds.has(j.id))) {
      elements.selectAllCheckbox.checked = true;
      elements.selectAllCheckbox.indeterminate = false;
    } else if (visibleJobs.some(j => state.selectedIds.has(j.id))) {
      elements.selectAllCheckbox.checked = false;
      elements.selectAllCheckbox.indeterminate = true;
    } else {
      elements.selectAllCheckbox.checked = false;
      elements.selectAllCheckbox.indeterminate = false;
    }
  }
}

function createJobRowElement(job) {
  const tr = document.createElement('tr');
  tr.id = `row-${job.id}`;
  tr.dataset.jobId = job.id;
  if (state.selectedIds.has(job.id)) {
    tr.classList.add('row-selected');
  }

  const avatarLetter = (job.company || 'J').charAt(0).toUpperCase();
  const followUpBadgeHtml = formatFollowUpBadge(job.followUpDate);

  tr.innerHTML = `
    <!-- Checkbox -->
    <td class="td-checkbox">
      <input type="checkbox" class="row-checkbox" data-id="${job.id}" ${state.selectedIds.has(job.id) ? 'checked' : ''}>
    </td>

    <!-- Company (Inline editable) -->
    <td class="td-company">
      <div class="company-cell-wrapper">
        <div class="company-avatar">${avatarLetter}</div>
        <span class="company-name editable-cell text-truncate" data-field="company" title="${escapeHtml(job.company)}">${escapeHtml(job.company)}</span>
      </div>
    </td>

    <!-- Role (Inline editable) -->
    <td class="td-role">
      <span class="role-text editable-cell text-truncate" data-field="role" title="${escapeHtml(job.role || '—')}">${escapeHtml(job.role || '—')}</span>
    </td>

    <!-- Applied Date (Inline editable date) -->
    <td class="td-applied">
      <span class="editable-cell" data-field="appliedDate" data-type="date" title="Click to change applied date">
        ${formatDate(job.appliedDate)}
      </span>
    </td>

    <!-- Source (Inline editable select) -->
    <td class="td-source">
      <span class="badge-source editable-cell" data-field="source" data-type="source-select" title="Click to change source">
        ${escapeHtml(job.source || 'Other')}
      </span>
    </td>

    <!-- Status Pill with 1-Click Dropdown Switcher -->
    <td class="td-status">
      <div class="status-pill-container" id="statusContainer-${job.id}">
        <button type="button" class="status-pill pill-${(job.status || 'applied').toLowerCase()}" data-id="${job.id}" title="Click to change status">
          <span class="pill-dot"></span>
          <span>${escapeHtml(job.status || 'Applied')}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
      </div>
    </td>

    <!-- Contact / Recruiter (Inline editable) -->
    <td class="td-contact">
      <span class="editable-cell text-truncate" data-field="contact" title="${escapeHtml(job.contact || 'Click to edit contact')}">
        ${job.contact ? escapeHtml(job.contact) : '<span style="color: var(--text-muted)">Add contact</span>'}
      </span>
    </td>

    <!-- Follow-up Date (Inline editable date) -->
    <td class="td-followup">
      <span class="editable-cell" data-field="followUpDate" data-type="date" title="Click to edit follow-up date">
        ${followUpBadgeHtml}
      </span>
    </td>

    <!-- Notes (Click to preview/modal) -->
    <td class="td-notes">
      <div class="notes-preview text-truncate" data-id="${job.id}" title="${escapeHtml(job.notes || 'Click to add notes')}">
        ${job.notes ? escapeHtml(job.notes) : '<span style="color: var(--text-muted); font-style: italic;">+ Add notes</span>'}
      </div>
    </td>

    <!-- Actions (Delete, Duplicate) -->
    <td class="td-actions text-right">
      <div class="action-buttons">
        <button type="button" class="btn-icon btn-icon-duplicate" data-id="${job.id}" title="Duplicate this application">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="13" height="13" x="9" y="9" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
        <button type="button" class="btn-icon btn-icon-delete" data-id="${job.id}" title="Delete application">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </td>
  `;

  attachRowListeners(tr, job);
  return tr;
}

function attachRowListeners(tr, job) {
  const checkbox = tr.querySelector('.row-checkbox');
  if (checkbox) {
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        state.selectedIds.add(job.id);
        tr.classList.add('row-selected');
      } else {
        state.selectedIds.delete(job.id);
        tr.classList.remove('row-selected');
      }
      updateBulkToolbar();
    });
  }

  const statusPill = tr.querySelector('.status-pill');
  if (statusPill) {
    statusPill.addEventListener('click', (e) => {
      e.stopPropagation();
      openStatusDropdown(job.id);
    });
  }

  const notesPreview = tr.querySelector('.notes-preview');
  if (notesPreview) {
    notesPreview.addEventListener('click', () => {
      openNotesModal(job);
    });
  }

  const duplicateBtn = tr.querySelector('.btn-icon-duplicate');
  if (duplicateBtn) {
    duplicateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDuplicateJob(job);
    });
  }

  const deleteBtn = tr.querySelector('.btn-icon-delete');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDeleteJob(job.id);
    });
  }

  tr.querySelectorAll('.editable-cell').forEach(cell => {
    cell.addEventListener('click', (e) => {
      e.stopPropagation();
      startInlineCellEdit(cell, job);
    });
  });
}

// ============================================================================
// Direct Inline Editing Implementation
// ============================================================================
function startInlineCellEdit(cellElement, job) {
  if (state.activeEditCell) {
    commitInlineCellEdit();
  }

  const field = cellElement.dataset.field;
  const type = cellElement.dataset.type || 'text';
  const currentValue = job[field] || '';

  state.activeEditCell = {
    element: cellElement,
    jobId: job.id,
    field: field,
    originalValue: currentValue
  };

  cellElement.style.display = 'none';

  let input;
  if (type === 'date') {
    input = document.createElement('input');
    input.type = 'date';
    input.className = 'inline-cell-input';
    input.value = currentValue;
  } else if (type === 'source-select') {
    input = document.createElement('select');
    input.className = 'inline-cell-input';
    const sources = ['LinkedIn', 'Referral', 'Indeed', 'Company Site', 'Glassdoor', 'Other'];
    sources.forEach(src => {
      const opt = document.createElement('option');
      opt.value = src;
      opt.textContent = src;
      if (src === currentValue) opt.selected = true;
      input.appendChild(opt);
    });
  } else {
    input = document.createElement('input');
    input.type = 'text';
    input.className = 'inline-cell-input';
    input.value = currentValue;
  }

  cellElement.parentNode.insertBefore(input, cellElement.nextSibling);
  input.focus();
  if (input.select && type !== 'date') input.select();

  input.addEventListener('blur', () => {
    commitInlineCellEdit(input.value);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitInlineCellEdit(input.value);
    } else if (e.key === 'Escape') {
      cancelInlineCellEdit();
    }
  });
}

async function commitInlineCellEdit(newValue) {
  if (!state.activeEditCell) return;

  const { element, jobId, field, originalValue } = state.activeEditCell;
  const input = element.nextSibling;

  const finalValue = newValue !== undefined ? newValue.trim() : (input ? input.value.trim() : originalValue);

  if (input && input.parentNode) {
    input.parentNode.removeChild(input);
  }
  element.style.display = '';
  state.activeEditCell = null;

  if (finalValue === originalValue) return;

  const job = state.jobs.find(j => j.id === jobId);
  if (job) {
    job[field] = finalValue;
    job.updatedAt = new Date().toISOString();
    saveToStorage();
    renderAll();
    showToast(`Updated ${field}`, 'success');
  }

  try {
    await fetch(`/api/jobs/${jobId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: finalValue })
    });
  } catch (_) {}
}

function cancelInlineCellEdit() {
  if (!state.activeEditCell) return;
  const { element } = state.activeEditCell;
  const input = element.nextSibling;
  if (input && input.parentNode) {
    input.parentNode.removeChild(input);
  }
  element.style.display = '';
  state.activeEditCell = null;
}

// ============================================================================
// 1-Click Status Dropdown Switcher
// ============================================================================
function openStatusDropdown(jobId) {
  closeAllStatusDropdowns();

  const container = document.getElementById(`statusContainer-${jobId}`);
  if (!container) return;

  state.activeDropdownJobId = jobId;

  const statuses = [
    { label: 'Applied', color: 'var(--status-applied)' },
    { label: 'Referral', color: 'var(--status-referral)' },
    { label: 'Interviewing', color: 'var(--status-interview)' },
    { label: 'Selected', color: 'var(--status-selected)' },
    { label: 'Rejected', color: 'var(--status-rejected)' }
  ];

  const menu = document.createElement('div');
  menu.className = 'status-dropdown-menu';
  menu.id = `statusMenu-${jobId}`;

  menu.innerHTML = statuses.map(s => `
    <button type="button" class="status-dropdown-item" data-status="${s.label}">
      <span class="pill-dot" style="background: ${s.color};"></span>
      <span>${s.label}</span>
    </button>
  `).join('');

  menu.querySelectorAll('.status-dropdown-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const newStatus = item.dataset.status;
      handleUpdateStatus(jobId, newStatus);
      closeAllStatusDropdowns();
    });
  });

  container.appendChild(menu);
}

function closeAllStatusDropdowns() {
  document.querySelectorAll('.status-dropdown-menu').forEach(m => m.remove());
  state.activeDropdownJobId = null;
}

async function handleUpdateStatus(jobId, newStatus) {
  const job = state.jobs.find(j => j.id === jobId);
  if (!job || job.status === newStatus) return;

  job.status = newStatus;
  job.updatedAt = new Date().toISOString();
  saveToStorage();
  renderAll();
  showToast(`Status set to ${newStatus}`, 'success');

  try {
    await fetch(`/api/jobs/${jobId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
  } catch (_) {}
}

// ============================================================================
// Add, Delete, Duplicate Actions
// ============================================================================
async function handleAddNewJob() {
  const company = elements.newCompany ? elements.newCompany.value.trim() : '';
  if (!company) {
    if (elements.newCompany) elements.newCompany.focus();
    showToast('Please enter a company name', 'danger');
    return;
  }

  const newJob = {
    id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    company: company,
    role: (elements.newRole ? elements.newRole.value.trim() : '') || 'Software Engineer',
    appliedDate: (elements.newAppliedDate ? elements.newAppliedDate.value : '') || new Date().toISOString().split('T')[0],
    source: elements.newSource ? elements.newSource.value : 'LinkedIn',
    status: elements.newStatus ? elements.newStatus.value : 'Applied',
    contact: elements.newContact ? elements.newContact.value.trim() : '',
    followUpDate: elements.newFollowUpDate ? elements.newFollowUpDate.value : '',
    notes: elements.newNotes ? elements.newNotes.value.trim() : '',
    updatedAt: new Date().toISOString()
  };

  state.jobs.unshift(newJob);
  saveToStorage();
  renderAll();

  // Reset inputs
  if (elements.newCompany) elements.newCompany.value = '';
  if (elements.newRole) elements.newRole.value = '';
  if (elements.newAppliedDate) elements.newAppliedDate.value = new Date().toISOString().split('T')[0];
  if (elements.newContact) elements.newContact.value = '';
  if (elements.newFollowUpDate) elements.newFollowUpDate.value = '';
  if (elements.newNotes) elements.newNotes.value = '';
  if (elements.newStatus) elements.newStatus.value = 'Applied';
  if (elements.newSource) elements.newSource.value = 'LinkedIn';

  showToast(`Added ${newJob.company} application!`, 'success');

  try {
    await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newJob)
    });
  } catch (_) {}
}

async function handleDeleteJob(jobId) {
  const job = state.jobs.find(j => j.id === jobId);
  if (!job) return;

  state.lastDeletedJob = { ...job };
  state.jobs = state.jobs.filter(j => j.id !== jobId);
  state.selectedIds.delete(jobId);
  saveToStorage();
  renderAll();

  showToast(`Deleted ${job.company}`, 'danger', {
    actionText: 'Undo',
    actionCallback: () => handleUndoDelete()
  });

  try {
    await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
  } catch (_) {}
}

async function handleUndoDelete() {
  if (!state.lastDeletedJob) return;
  const jobToRestore = state.lastDeletedJob;
  state.lastDeletedJob = null;

  state.jobs.unshift(jobToRestore);
  saveToStorage();
  renderAll();
  showToast(`Restored ${jobToRestore.company}`, 'success');

  try {
    await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jobToRestore)
    });
  } catch (_) {}
}

async function handleDuplicateJob(job) {
  const duplicate = {
    id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    company: `${job.company} (Copy)`,
    role: job.role,
    appliedDate: new Date().toISOString().split('T')[0],
    source: job.source,
    status: job.status,
    contact: job.contact,
    followUpDate: job.followUpDate,
    notes: job.notes,
    updatedAt: new Date().toISOString()
  };

  state.jobs.unshift(duplicate);
  saveToStorage();
  renderAll();
  showToast(`Duplicated ${job.company}`, 'info');

  try {
    await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(duplicate)
    });
  } catch (_) {}
}

async function handleBulkDelete() {
  const ids = Array.from(state.selectedIds);
  if (ids.length === 0) return;

  if (!confirm(`Delete ${ids.length} selected applications?`)) {
    return;
  }

  const idSet = new Set(ids);
  state.jobs = state.jobs.filter(j => !idSet.has(j.id));
  state.selectedIds.clear();
  saveToStorage();
  renderAll();
  showToast(`Deleted ${ids.length} applications`, 'danger');

  try {
    await fetch('/api/jobs/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
  } catch (_) {}
}

// Notes Modal Handling
function openNotesModal(job) {
  currentModalJobId = job.id;
  if (elements.modalCompanyTitle) elements.modalCompanyTitle.textContent = `${job.company} — Notes`;
  if (elements.modalNotesTextarea) elements.modalNotesTextarea.value = job.notes || '';
  if (elements.notesModal) elements.notesModal.style.display = 'flex';
  if (elements.modalNotesTextarea) elements.modalNotesTextarea.focus();
}

function closeNotesModal() {
  if (elements.notesModal) elements.notesModal.style.display = 'none';
  currentModalJobId = null;
}

async function saveNotesModal() {
  if (!currentModalJobId) return;
  const newNotes = elements.modalNotesTextarea ? elements.modalNotesTextarea.value.trim() : '';
  const job = state.jobs.find(j => j.id === currentModalJobId);
  if (job) {
    job.notes = newNotes;
    job.updatedAt = new Date().toISOString();
    saveToStorage();
    renderAll();
  }

  closeNotesModal();
  showToast('Notes saved', 'success');

  try {
    await fetch(`/api/jobs/${currentModalJobId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: newNotes })
    });
  } catch (_) {}
}

function updateBulkToolbar() {
  if (!elements.bulkActions) return;
  const count = state.selectedIds.size;
  if (count > 0) {
    elements.bulkActions.style.display = 'flex';
    if (elements.bulkCount) elements.bulkCount.textContent = `${count} selected`;
  } else {
    elements.bulkActions.style.display = 'none';
  }
}

// Export to CSV
function exportToCSV() {
  if (state.jobs.length === 0) {
    showToast('No applications to export', 'danger');
    return;
  }

  const headers = ['Company', 'Role', 'Applied Date', 'Source', 'Status', 'Contact/Recruiter', 'Follow-up Date', 'Notes'];
  const rows = state.jobs.map(j => [
    `"${(j.company || '').replace(/"/g, '""')}"`,
    `"${(j.role || '').replace(/"/g, '""')}"`,
    `"${j.appliedDate || ''}"`,
    `"${(j.source || '').replace(/"/g, '""')}"`,
    `"${(j.status || '').replace(/"/g, '""')}"`,
    `"${(j.contact || '').replace(/"/g, '""')}"`,
    `"${j.followUpDate || ''}"`,
    `"${(j.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `job_applications_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Exported applications to CSV', 'success');
}

// Formatting helpers
function formatDate(dateString) {
  if (!dateString) return '—';
  try {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const date = new Date(parts[0], parts[1] - 1, parts[2]);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return dateString;
  } catch (_) {
    return dateString;
  }
}

function formatFollowUpBadge(dateString) {
  if (!dateString) return '<span style="color: var(--text-muted)">—</span>';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parts = dateString.split('-');
  if (parts.length !== 3) return dateString;

  const target = new Date(parts[0], parts[1] - 1, parts[2]);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));
  const formattedDate = target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (diffDays < 0) {
    return `<span class="followup-badge followup-overdue" title="${formattedDate} (Overdue by ${Math.abs(diffDays)}d)">⚠️ ${formattedDate} (Overdue)</span>`;
  } else if (diffDays === 0) {
    return `<span class="followup-badge followup-today" title="Due today">⏰ Today</span>`;
  } else if (diffDays <= 3) {
    return `<span class="followup-badge followup-today" title="${formattedDate} (In ${diffDays} days)">🔔 In ${diffDays}d</span>`;
  } else {
    return `<span class="followup-badge followup-upcoming">${formattedDate}</span>`;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, type = 'info', action = null) {
  if (!elements.toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconSpan = document.createElement('span');
  iconSpan.className = 'toast-icon';
  if (type === 'danger') {
    iconSpan.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
  } else if (type === 'success') {
    iconSpan.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
  } else {
    iconSpan.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
  }
  toast.appendChild(iconSpan);

  const messageSpan = document.createElement('span');
  messageSpan.className = 'toast-message';
  messageSpan.textContent = message;
  toast.appendChild(messageSpan);

  if (action && action.actionText && action.actionCallback) {
    const actionBtn = document.createElement('button');
    actionBtn.className = 'toast-action';
    actionBtn.textContent = action.actionText;
    actionBtn.addEventListener('click', () => {
      action.actionCallback();
      toast.remove();
    });
    toast.appendChild(actionBtn);
  }

  elements.toastContainer.prepend(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-12px)';
    toast.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    setTimeout(() => toast.remove(), 260);
  }, 4500);
}

// Boot
document.addEventListener('DOMContentLoaded', initApp);
