/**
 * JobTrack Live — Collaborative Real-Time Job Application Tracker
 * Frontend Client Logic
 */

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
  isEventSourceConnected: false
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
// Initialization & Real-Time SSE Setup
// ============================================================================
async function initApp() {
  // Set default applied date in quick add to today
  elements.newAppliedDate.value = new Date().toISOString().split('T')[0];
  
  // Fetch initial jobs
  await fetchJobs();
  
  // Connect real-time Server-Sent Events for multi-user collaboration
  setupEventSource();
  
  // Bind UI Events
  bindEvents();
}

// Fetch all jobs from backend
async function fetchJobs() {
  try {
    const res = await fetch('/api/jobs');
    const data = await res.json();
    if (data.success && Array.isArray(data.jobs)) {
      state.jobs = data.jobs;
      renderAll();
    }
  } catch (err) {
    console.error('Failed to fetch jobs:', err);
    showToast('Failed to load applications from server', 'danger');
  }
}

// Establish Server-Sent Events connection for instant live sync
function setupEventSource() {
  const eventSource = new EventSource('/api/jobs/stream');

  eventSource.addEventListener('connected', (e) => {
    state.isEventSourceConnected = true;
    updateLiveStatus(true);
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
      // Avoid duplicate if already locally added
      const exists = state.jobs.some(j => j.id === newJob.id);
      if (!exists) {
        state.jobs.unshift(newJob);
        renderAll();
        showToast(`New job added: ${newJob.company}`, 'info');
      }
    } catch (err) {
      console.error('Error handling job_created event:', err);
    }
  });

  eventSource.addEventListener('job_updated', (e) => {
    try {
      const updatedJob = JSON.parse(e.data);
      const index = state.jobs.findIndex(j => j.id === updatedJob.id);
      if (index !== -1) {
        state.jobs[index] = updatedJob;
        renderAll();
      }
    } catch (err) {
      console.error('Error handling job_updated event:', err);
    }
  });

  eventSource.addEventListener('job_deleted', (e) => {
    try {
      const { id } = JSON.parse(e.data);
      state.jobs = state.jobs.filter(j => j.id !== id);
      state.selectedIds.delete(id);
      renderAll();
    } catch (err) {
      console.error('Error handling job_deleted event:', err);
    }
  });

  eventSource.addEventListener('bulk_deleted', (e) => {
    try {
      const { ids } = JSON.parse(e.data);
      const idSet = new Set(ids);
      state.jobs = state.jobs.filter(j => !idSet.has(j.id));
      ids.forEach(id => state.selectedIds.delete(id));
      renderAll();
    } catch (err) {
      console.error('Error handling bulk_deleted event:', err);
    }
  });

  eventSource.addEventListener('jobs_reset', (e) => {
    try {
      const { jobs } = JSON.parse(e.data);
      state.jobs = jobs;
      state.selectedIds.clear();
      renderAll();
      showToast('Applications reset to demo data', 'info');
    } catch (err) {
      console.error('Error handling jobs_reset event:', err);
    }
  });

  eventSource.onerror = () => {
    updateLiveStatus(false);
  };
}

function updateLiveStatus(isConnected) {
  if (isConnected) {
    elements.liveStatusBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    elements.liveStatusText.textContent = 'Live Sync (No Login)';
  } else {
    elements.liveStatusBadge.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    elements.liveStatusText.textContent = 'Reconnecting...';
  }
}

function updateClientCount(count) {
  state.onlineUsers = count;
  elements.activeClientsCount.textContent = `${count} online`;
}

// ============================================================================
// Event Listeners Binding
// ============================================================================
function bindEvents() {
  // Search input
  elements.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    elements.clearSearchBtn.style.display = state.searchQuery ? 'block' : 'none';
    renderTable();
  });

  elements.clearSearchBtn.addEventListener('click', () => {
    elements.searchInput.value = '';
    state.searchQuery = '';
    elements.clearSearchBtn.style.display = 'none';
    renderTable();
  });

  // Status Filter Chips
  elements.statusFilters.addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    state.currentFilter = chip.dataset.filter;
    renderTable();
  });

  // Table Header Sorting
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

  // Bulk Delete
  elements.btnBulkDelete.addEventListener('click', handleBulkDelete);

  // Focus Inline Add
  elements.btnToggleAddRow.addEventListener('click', () => {
    elements.newCompany.focus();
    elements.inlineAddRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // Inline Quick Add Submission
  elements.btnSubmitNewJob.addEventListener('click', handleAddNewJob);
  elements.inlineAddRow.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddNewJob();
    }
  });

  // Export to CSV
  elements.btnExportCsv.addEventListener('click', exportToCSV);

  // Reset Demo Data
  elements.btnResetData.addEventListener('click', handleResetDemo);

  // Notes Modal Actions
  elements.closeNotesModal.addEventListener('click', closeNotesModal);
  elements.cancelNotesModal.addEventListener('click', closeNotesModal);
  elements.saveNotesModal.addEventListener('click', saveNotesModal);
  elements.notesModal.addEventListener('click', (e) => {
    if (e.target === elements.notesModal) closeNotesModal();
  });

  // Document click to dismiss status dropdowns & inline edits
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.status-pill-container')) {
      closeAllStatusDropdowns();
    }
  });
}

function updateSortHeaderIndicators() {
  document.querySelectorAll('th.sortable').forEach(th => {
    const arrow = th.querySelector('.sort-arrow');
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
    list = list.filter(j => j.status.toLowerCase() === state.currentFilter.toLowerCase());
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

  // Counts by status
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
      // If follow up date is overdue or in the future
      if (job.followUpDate >= todayStr || job.status === 'Interviewing') {
        pendingFollowUps++;
      }
    }
  });

  // Percentages
  const pcts = {
    Applied: total > 0 ? ((counts.Applied / total) * 100).toFixed(1) : 0,
    Referral: total > 0 ? ((counts.Referral / total) * 100).toFixed(1) : 0,
    Interviewing: total > 0 ? ((counts.Interviewing / total) * 100).toFixed(1) : 0,
    Selected: total > 0 ? ((counts.Selected / total) * 100).toFixed(1) : 0,
    Rejected: total > 0 ? ((counts.Rejected / total) * 100).toFixed(1) : 0,
  };

  // Headline Stats Cards
  elements.totalAppsCount.textContent = total;
  
  // Interview Rate = (Interviewing + Selected) / Total
  const interviewSuccessRate = total > 0 
    ? (((counts.Interviewing + counts.Selected) / total) * 100).toFixed(0)
    : 0;
  elements.interviewRate.textContent = `${interviewSuccessRate}%`;
  elements.interviewCountSub.textContent = `${counts.Interviewing} in progress`;

  // Selected / Offer Rate = Selected / Total
  const selectedRate = total > 0 
    ? ((counts.Selected / total) * 100).toFixed(0)
    : 0;
  elements.selectedRate.textContent = `${selectedRate}%`;
  elements.selectedCountSub.textContent = `${counts.Selected} ${counts.Selected === 1 ? 'offer' : 'offers'}`;

  // Follow-up count
  if (elements.followUpCount) elements.followUpCount.textContent = pendingFollowUps;
  if (elements.followUpSub) elements.followUpSub.textContent = pendingFollowUps === 1 ? 'requires attention' : 'require attention';

  // Filter Buttons Counts
  elements.filterCountAll.textContent = total;
  elements.filterCountApplied.textContent = counts.Applied;
  elements.filterCountReferral.textContent = counts.Referral;
  elements.filterCountInterviewing.textContent = counts.Interviewing;
  elements.filterCountSelected.textContent = counts.Selected;
  elements.filterCountRejected.textContent = counts.Rejected;

  // Update Multi-Segment Progress Breakdown Bar
  elements.segApplied.style.width = `${pcts.Applied}%`;
  elements.segApplied.textContent = pcts.Applied > 6 ? `${pcts.Applied}%` : '';
  elements.segApplied.title = `Applied: ${counts.Applied} (${pcts.Applied}%)`;

  elements.segReferral.style.width = `${pcts.Referral}%`;
  elements.segReferral.textContent = pcts.Referral > 6 ? `${pcts.Referral}%` : '';
  elements.segReferral.title = `Referral: ${counts.Referral} (${pcts.Referral}%)`;

  elements.segInterviewing.style.width = `${pcts.Interviewing}%`;
  elements.segInterviewing.textContent = pcts.Interviewing > 6 ? `${pcts.Interviewing}%` : '';
  elements.segInterviewing.title = `Interviewing: ${counts.Interviewing} (${pcts.Interviewing}%)`;

  elements.segSelected.style.width = `${pcts.Selected}%`;
  elements.segSelected.textContent = pcts.Selected > 6 ? `${pcts.Selected}%` : '';
  elements.segSelected.title = `Selected: ${counts.Selected} (${pcts.Selected}%)`;

  elements.segRejected.style.width = `${pcts.Rejected}%`;
  elements.segRejected.textContent = pcts.Rejected > 6 ? `${pcts.Rejected}%` : '';
  elements.segRejected.title = `Rejected: ${counts.Rejected} (${pcts.Rejected}%)`;

  // Render Status Breakdown Legend with Live Percentages
  renderBreakdownLegend(counts, pcts);
}

function renderBreakdownLegend(counts, pcts) {
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
  const visibleJobs = getFilteredAndSortedJobs();
  
  // Remove existing data rows (keep the inlineAddRow)
  const existingRows = elements.jobsTableBody.querySelectorAll('tr:not(#inlineAddRow)');
  existingRows.forEach(r => r.remove());

  if (visibleJobs.length === 0) {
    elements.emptyState.style.display = 'block';
  } else {
    elements.emptyState.style.display = 'none';

    // Render each job row
    visibleJobs.forEach(job => {
      const tr = createJobRowElement(job);
      elements.jobsTableBody.appendChild(tr);
    });
  }

  // Update header checkbox
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

function createJobRowElement(job) {
  const tr = document.createElement('tr');
  tr.id = `row-${job.id}`;
  tr.dataset.jobId = job.id;
  if (state.selectedIds.has(job.id)) {
    tr.classList.add('row-selected');
  }

  // Avatar initial
  const avatarLetter = (job.company || 'J').charAt(0).toUpperCase();

  // Follow up display
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

  // Attach Row Events
  attachRowListeners(tr, job);
  return tr;
}

function attachRowListeners(tr, job) {
  // Checkbox selection
  const checkbox = tr.querySelector('.row-checkbox');
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

  // Status Pill Click -> Open 1-Click Dropdown
  const statusPill = tr.querySelector('.status-pill');
  statusPill.addEventListener('click', (e) => {
    e.stopPropagation();
    openStatusDropdown(job.id);
  });

  // Notes Preview Click -> Open Notes Modal
  const notesPreview = tr.querySelector('.notes-preview');
  notesPreview.addEventListener('click', () => {
    openNotesModal(job);
  });

  // Duplicate Action
  const duplicateBtn = tr.querySelector('.btn-icon-duplicate');
  duplicateBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleDuplicateJob(job);
  });

  // Delete Action
  const deleteBtn = tr.querySelector('.btn-icon-delete');
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleDeleteJob(job.id);
  });

  // Inline Editable Cells (Company, Role, Contact, Applied Date, Follow-up Date, Source)
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

  // Save on blur or Enter, cancel on Escape
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

  // Optimistic update
  const job = state.jobs.find(j => j.id === jobId);
  if (job) {
    job[field] = finalValue;
    renderAll();
  }

  try {
    const res = await fetch(`/api/jobs/${jobId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: finalValue })
    });
    if (!res.ok) throw new Error('Update failed');
    showToast(`Saved ${field} update`, 'success');
  } catch (err) {
    console.error(err);
    showToast('Failed to save update', 'danger');
    if (job) job[field] = originalValue;
    renderAll();
  }
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

  const prevStatus = job.status;
  job.status = newStatus;
  renderAll();

  try {
    const res = await fetch(`/api/jobs/${jobId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (!res.ok) throw new Error('Status update failed');
    showToast(`Status updated to ${newStatus}`, 'success');
  } catch (err) {
    console.error(err);
    job.status = prevStatus;
    renderAll();
    showToast('Failed to update status', 'danger');
  }
}

// ============================================================================
// Add, Delete, Duplicate Actions
// ============================================================================
async function handleAddNewJob() {
  const company = elements.newCompany.value.trim();
  if (!company) {
    elements.newCompany.focus();
    showToast('Please enter a company name', 'danger');
    return;
  }

  const payload = {
    company: company,
    role: elements.newRole.value.trim() || 'Software Engineer',
    appliedDate: elements.newAppliedDate.value || new Date().toISOString().split('T')[0],
    source: elements.newSource.value,
    status: elements.newStatus.value,
    contact: elements.newContact.value.trim(),
    followUpDate: elements.newFollowUpDate.value || '',
    notes: elements.newNotes.value.trim()
  };

  try {
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success && data.job) {
      // Clear inputs
      elements.newCompany.value = '';
      elements.newRole.value = '';
      elements.newAppliedDate.value = new Date().toISOString().split('T')[0];
      elements.newContact.value = '';
      elements.newFollowUpDate.value = '';
      elements.newNotes.value = '';
      elements.newStatus.value = 'Applied';
      elements.newSource.value = 'LinkedIn';

      showToast(`Added ${data.job.company} application!`, 'success');
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to add job application', 'danger');
  }
}

async function handleDeleteJob(jobId) {
  const job = state.jobs.find(j => j.id === jobId);
  if (!job) return;

  state.lastDeletedJob = { ...job };

  // Optimistically remove
  state.jobs = state.jobs.filter(j => j.id !== jobId);
  state.selectedIds.delete(jobId);
  renderAll();

  showToast(`Deleted ${job.company} application`, 'danger', {
    actionText: 'Undo',
    actionCallback: () => handleUndoDelete()
  });

  try {
    const res = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
  } catch (err) {
    console.error(err);
    showToast('Failed to delete on server', 'danger');
    // Restore
    state.jobs.unshift(job);
    renderAll();
  }
}

async function handleUndoDelete() {
  if (!state.lastDeletedJob) return;
  const jobToRestore = state.lastDeletedJob;
  state.lastDeletedJob = null;

  try {
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jobToRestore)
    });
    if (res.ok) {
      showToast(`Restored ${jobToRestore.company}`, 'success');
    }
  } catch (err) {
    console.error(err);
  }
}

async function handleDuplicateJob(job) {
  const duplicate = {
    company: `${job.company} (Copy)`,
    role: job.role,
    appliedDate: new Date().toISOString().split('T')[0],
    source: job.source,
    status: job.status,
    contact: job.contact,
    followUpDate: job.followUpDate,
    notes: job.notes
  };

  try {
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(duplicate)
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Duplicated ${job.company}`, 'info');
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to duplicate job', 'danger');
  }
}

async function handleBulkDelete() {
  const ids = Array.from(state.selectedIds);
  if (ids.length === 0) return;

  if (!confirm(`Are you sure you want to delete ${ids.length} selected applications?`)) {
    return;
  }

  try {
    const res = await fetch('/api/jobs/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    if (res.ok) {
      state.selectedIds.clear();
      showToast(`Deleted ${ids.length} applications`, 'danger');
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to bulk delete', 'danger');
  }
}

async function handleResetDemo() {
  if (!confirm('Reset all jobs back to default demo applications? Any edits will be overwritten.')) {
    return;
  }
  try {
    const res = await fetch('/api/jobs/reset', { method: 'POST' });
    if (res.ok) {
      showToast('Reset to demo applications complete', 'info');
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to reset demo data', 'danger');
  }
}

// ============================================================================
// Notes Modal Handling
// ============================================================================
function openNotesModal(job) {
  currentModalJobId = job.id;
  elements.modalCompanyTitle.textContent = `${job.company} — Notes`;
  elements.modalNotesTextarea.value = job.notes || '';
  elements.notesModal.style.display = 'flex';
  elements.modalNotesTextarea.focus();
}

function closeNotesModal() {
  elements.notesModal.style.display = 'none';
  currentModalJobId = null;
}

async function saveNotesModal() {
  if (!currentModalJobId) return;
  const newNotes = elements.modalNotesTextarea.value.trim();
  const job = state.jobs.find(j => j.id === currentModalJobId);
  if (job) {
    job.notes = newNotes;
    renderAll();
  }

  try {
    const res = await fetch(`/api/jobs/${currentModalJobId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: newNotes })
    });
    if (res.ok) {
      showToast('Notes saved', 'success');
      closeNotesModal();
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to save notes', 'danger');
  }
}

// ============================================================================
// Bulk Actions Toolbar Helper
// ============================================================================
function updateBulkToolbar() {
  const count = state.selectedIds.size;
  if (count > 0) {
    elements.bulkActions.style.display = 'flex';
    elements.bulkCount.textContent = `${count} selected`;
  } else {
    elements.bulkActions.style.display = 'none';
  }
}

// ============================================================================
// Export to CSV
// ============================================================================
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

// ============================================================================
// Helper Formatting Functions
// ============================================================================
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
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

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

  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Kickoff
document.addEventListener('DOMContentLoaded', initApp);
