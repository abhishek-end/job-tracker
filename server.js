const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'jobs.json');
const DEFAULT_SEED_FILE = path.join(DATA_DIR, 'seed_default.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial default seed for resets
const defaultSeedJobs = [
  {
    id: "job-101",
    company: "Stripe",
    role: "Automation Tester",
    appliedDate: "2026-09-12",
    source: "Referral",
    status: "Interviewing",
    contact: "9876543210",
    followUpDate: "2026-09-22",
    notes: "Passed test framework round. Final architectural loop scheduled next Tuesday.",
    updatedAt: new Date().toISOString()
  },
  {
    id: "job-102",
    company: "Google",
    role: "Manual Tester",
    appliedDate: "2026-09-08",
    source: "Company Site",
    status: "Interviewing",
    contact: "9812345678",
    followUpDate: "2026-09-20",
    notes: "Completed round 2 test case interview. Follow-up on hiring committee decision.",
    updatedAt: new Date().toISOString()
  },
  {
    id: "job-103",
    company: "Figma",
    role: "Both Functional",
    appliedDate: "2026-08-28",
    source: "LinkedIn",
    status: "Selected",
    contact: "9123456780",
    followUpDate: "2026-09-25",
    notes: "Offer letter received! Reviewing equity package and benefits before signing.",
    updatedAt: new Date().toISOString()
  },
  {
    id: "job-104",
    company: "Anthropic",
    role: "API Tester",
    appliedDate: "2026-09-14",
    source: "Referral",
    status: "Referral",
    contact: "9988776655",
    followUpDate: "2026-09-21",
    notes: "Referred by former colleague. Application fast-tracked to recruiter phone screen.",
    updatedAt: new Date().toISOString()
  },
  {
    id: "job-105",
    company: "Airbnb",
    role: "QA / SDET",
    appliedDate: "2026-09-15",
    source: "LinkedIn",
    status: "Applied",
    contact: "9112233445",
    followUpDate: "2026-09-24",
    notes: "Submitted portfolio featuring automation work. Automated confirmation received.",
    updatedAt: new Date().toISOString()
  }
];

// In-memory jobs store
let jobs = [];

function loadJobs() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      jobs = JSON.parse(raw);
    } else {
      jobs = [...defaultSeedJobs];
      saveJobs();
    }
  } catch (err) {
    console.error('Error loading jobs, initializing default:', err);
    jobs = [...defaultSeedJobs];
    saveJobs();
  }
}

function saveJobs() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(jobs, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist jobs file:', err);
  }
}

loadJobs();

// SSE Clients for Real-Time Synchronization
const sseClients = new Set();

function broadcast(eventType, data) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    client.write(payload);
  }
}

// SSE Connection Endpoint
app.get('/api/jobs/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial connected ping
  res.write(`event: connected\ndata: ${JSON.stringify({ clientCount: sseClients.size + 1 })}\n\n`);
  sseClients.add(res);

  // Notify other clients of updated count
  broadcast('client_count', { clientCount: sseClients.size });

  req.on('close', () => {
    sseClients.delete(res);
    broadcast('client_count', { clientCount: sseClients.size });
  });
});

// GET /api/jobs - List all jobs
app.get('/api/jobs', (req, res) => {
  res.json({
    success: true,
    total: jobs.length,
    jobs: jobs
  });
});

// POST /api/jobs - Create a new job
app.post('/api/jobs', (req, res) => {
  const { company, role, appliedDate, source, status, contact, followUpDate, notes } = req.body;
  
  if (!company || !company.trim()) {
    return res.status(400).json({ error: 'Company name is required' });
  }

  const validStatuses = ['Applied', 'Referral', 'Interviewing', 'Selected', 'Rejected'];
  const finalStatus = validStatuses.includes(status) ? status : 'Applied';

  const newJob = {
    id: req.body.id || `job-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    company: company.trim(),
    role: (role || 'Manual Tester').trim(),
    appliedDate: appliedDate || new Date().toISOString().split('T')[0],
    source: source || 'LinkedIn',
    status: finalStatus,
    contact: (contact || '').toString().trim().replace(/\D/g, ''),
    followUpDate: followUpDate || '',
    notes: (notes || '').trim(),
    updatedAt: new Date().toISOString()
  };

  jobs.unshift(newJob);
  saveJobs();
  broadcast('job_created', newJob);

  res.status(201).json({ success: true, job: newJob });
});

// PUT /api/jobs/:id - Update job fields (supports partial inline edits)
app.put('/api/jobs/:id', (req, res) => {
  const { id } = req.params;
  const index = jobs.findIndex(j => j.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const allowedFields = ['company', 'role', 'appliedDate', 'source', 'status', 'contact', 'followUpDate', 'notes'];
  const current = jobs[index];
  
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      if (field === 'contact') {
        current[field] = req.body[field].toString().replace(/\D/g, '');
      } else {
        current[field] = req.body[field];
      }
    }
  });

  current.updatedAt = new Date().toISOString();
  jobs[index] = current;
  saveJobs();

  broadcast('job_updated', current);
  res.json({ success: true, job: current });
});

// DELETE /api/jobs/:id - Delete a job
app.delete('/api/jobs/:id', (req, res) => {
  const { id } = req.params;
  const index = jobs.findIndex(j => j.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const deletedJob = jobs.splice(index, 1)[0];
  saveJobs();
  broadcast('job_deleted', { id, deletedJob });

  res.json({ success: true, id, deletedJob });
});

// POST /api/jobs/bulk-delete - Delete multiple jobs
app.post('/api/jobs/bulk-delete', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No IDs provided' });
  }

  const idSet = new Set(ids);
  const removed = jobs.filter(j => idSet.has(j.id));
  jobs = jobs.filter(j => !idSet.has(j.id));
  saveJobs();

  broadcast('bulk_deleted', { ids });
  res.json({ success: true, count: removed.length, ids });
});

// POST /api/jobs/reset - Reset to default seed jobs
app.post('/api/jobs/reset', (req, res) => {
  jobs = JSON.parse(JSON.stringify(defaultSeedJobs));
  saveJobs();
  broadcast('jobs_reset', { jobs });
  res.json({ success: true, jobs });
});

// Fallback route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Job Tracker collaborative server running on http://localhost:${PORT}`);
});
