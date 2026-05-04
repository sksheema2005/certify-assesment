const captchas = { login:'', signup:'', forgot:'' };
function generateCaptcha(type) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    captchas[type] = code;
    document.getElementById(type + 'CaptchaText').textContent = code;
}
generateCaptcha('login');
generateCaptcha('signup');
generateCaptcha('forgot');

// ===== PAGE NAVIGATION =====
function showPage(pageId) {
    document.querySelectorAll('.form-page').forEach(p => p.classList.remove('active'));
    setTimeout(() => document.getElementById(pageId).classList.add('active'), 50);
    document.querySelectorAll('.error-msg').forEach(e => e.classList.remove('show'));
    document.querySelectorAll('input').forEach(i => i.classList.remove('error'));
}

function togglePass(inputId, btn) {
    const input = document.getElementById(inputId);
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    btn.innerHTML = isPass
        ? '<svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
}

// ===== HELPERS =====
function showError(id, msg) {
    const el = document.getElementById(id);
    if (msg) el.querySelector('span').textContent = msg;
    el.classList.add('show');
}
function clearAllErrors(formId) {
    document.querySelectorAll('#' + formId + ' .error-msg').forEach(e => e.classList.remove('show'));
    document.querySelectorAll('#' + formId + ' input').forEach(i => i.classList.remove('error'));
}
function shakeForm(formId) {
    const form = document.getElementById(formId);
    form.classList.add('shake');
    setTimeout(() => form.classList.remove('shake'), 400);
}
function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function showToast(msg) {
    document.getElementById('toastMsg').textContent = msg;
    document.getElementById('toast').classList.add('show');
    setTimeout(() => document.getElementById('toast').classList.remove('show'), 3000);
}

function checkStrength(val) {
    let score = 0;
    if (val.length >= 8) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    const labels = ['','Weak','Medium','Strong','Very Strong'];
    const classes = ['','weak','medium','strong','very-strong'];
    for (let i = 1; i <= 4; i++) {
        const bar = document.getElementById('str' + i);
        bar.className = 'strength-bar';
        if (i <= score) bar.classList.add(classes[score]);
    }
    document.getElementById('strengthLabel').textContent = val.length > 0 ? labels[score] : '';
}

// ===== SESSION MANAGEMENT =====
async function checkSession() {
    try {
        const response = await fetch('/api/session');
        const data = await response.json();
        if (data.authenticated) {
            showDashboard(data.admin.email, data.admin.full_name);
        }
    } catch (err) {
        console.error('Session check failed:', err);
    }
}

// ===== SHOW DASHBOARD =====
function showDashboard(email, fullName) {
    document.getElementById('authWrapper').style.display = 'none';
    document.getElementById('dashboardWrapper').classList.add('active');
    document.body.style.alignItems = 'stretch';

    // Personalize
    const displayName = fullName || email.split('@')[0];
    document.getElementById('dashName').textContent = displayName;
    document.getElementById('dashAvatar').textContent = displayName.substring(0, 2).toUpperCase();

    // Load data
    loadDashboardStats();
    loadOpportunities();
    loadStudents();
    loadVerifiers();
    loadCourses();

    // Show menu toggle on mobile
    if (window.innerWidth <= 768) {
        document.getElementById('menuToggle').style.display = 'flex';
    }
}

async function loadDashboardStats() {
    try {
        const response = await fetch('/api/dashboard/stats');
        const stats = await response.json();
        
        // Dashboard Stats
        const statValues = document.querySelectorAll('.stat-card .stat-value span:first-child');
        if (statValues.length >= 3) {
            statValues[0].textContent = stats.total_students.toLocaleString();
            statValues[1].textContent = stats.total_teachers.toLocaleString();
            statValues[2].textContent = stats.total_parents.toLocaleString();
        }
        
        // Learner Stats
        const learnerCards = document.querySelectorAll('#learnerSection .learner-stat-card .number');
        if (learnerCards.length >= 4) {
            learnerCards[0].textContent = stats.learner.total.toLocaleString();
            learnerCards[1].textContent = stats.learner.certified.toLocaleString();
            learnerCards[2].textContent = stats.learner.enrolled.toLocaleString();
            learnerCards[3].textContent = stats.learner.deactivated.toLocaleString();
        }
        
        // Verifier Stats
        const verifierCards = document.querySelectorAll('#verifierSection .learner-stat-card .number');
        if (verifierCards.length >= 4) {
            verifierCards[0].textContent = stats.verifier.total.toLocaleString();
            verifierCards[1].textContent = stats.verifier.active.toLocaleString();
            verifierCards[2].textContent = stats.verifier.inactive.toLocaleString();
            verifierCards[3].textContent = stats.verifier.pending.toLocaleString();
        }
    } catch (err) {
        console.error('Failed to load dashboard stats:', err);
    }
}

async function loadStudents() {
    try {
        const response = await fetch('/api/students');
        const data = await response.json();
        renderStudentsTable(data.students);
    } catch (err) {
        console.error('Failed to load students:', err);
    }
}

function renderStudentsTable(students) {
    const tbody = document.getElementById('studentsTableBody');
    if (!tbody) return;
    
    if (students.length === 0) {
        // Keep hardcoded for now if empty to avoid blank screen during dev, or show empty row
        // tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--qf-text-light)">No students found.</td></tr>';
        return; 
    }
    
    tbody.innerHTML = students.map(s => `
        <tr data-status="${s.status}">
            <td>#${s.student_id}</td>
            <td>${escapeHtml(s.full_name)}</td>
            <td>${escapeHtml(s.email)}</td>
            <td><span class="badge ${s.status}">${s.status.charAt(0).toUpperCase() + s.status.slice(1)}</span></td>
            <td>${s.enrolled_courses}</td>
            <td><span class="badge certified">${s.certificates} Certified</span></td>
            <td>${s.last_login}</td>
        </tr>
    `).join('');
}

async function loadVerifiers() {
    try {
        const response = await fetch('/api/verifiers');
        const data = await response.json();
        renderVerifiersTable(data.verifiers);
    } catch (err) {
        console.error('Failed to load verifiers:', err);
    }
}

function renderVerifiersTable(verifiers) {
    const tbody = document.getElementById('verifiersTableBody');
    if (!tbody) return;
    
    if (verifiers.length === 0) {
        return; // Keep hardcoded if empty for demo
    }
    
    tbody.innerHTML = verifiers.map(v => `
        <tr data-status="${v.status}">
            <td>#${v.verifier_id}</td>
            <td>${escapeHtml(v.full_name)}</td>
            <td>${escapeHtml(v.email)}</td>
            <td><span class="badge ${v.status}">${v.status.charAt(0).toUpperCase() + v.status.slice(1)}</span></td>
            <td>2 Subjects</td>
            <td><span class="badge certified">312</span></td>
            <td>Jan 2025</td>
        </tr>
    `).join('');
}

async function loadCourses() {
    try {
        const response = await fetch('/api/courses');
        const data = await response.json();
        renderCoursesGrid(data.courses);
    } catch (err) {
        console.error('Failed to load courses:', err);
    }
}

function renderCoursesGrid(courses) {
    const grid = document.querySelector('#learnerSection .courses-grid');
    if (!grid) return;
    
    grid.innerHTML = courses.map(c => `
        <div class="course-card">
            <div class="course-header">
                <div>
                    <h5>${escapeHtml(c.name)}</h5>
                    <div class="course-category">${escapeHtml(c.category)}</div>
                </div>
            </div>
            <div class="course-stats">
                <div class="course-stat">
                    <div class="course-stat-label">Enrolled</div>
                    <div class="course-stat-value">${c.stats.enrolled}</div>
                </div>
                <div class="course-stat">
                    <div class="course-stat-label">Completed</div>
                    <div class="course-stat-value">${c.stats.completed}</div>
                </div>
                <div class="course-stat">
                    <div class="course-stat-label">In Progress</div>
                    <div class="course-stat-value">${c.stats.in_progress}</div>
                </div>
                <div class="course-stat">
                    <div class="course-stat-label">50% Done</div>
                    <div class="course-stat-value">${c.stats.half_done}</div>
                </div>
            </div>
            <button class="view-course-btn" onclick="openCourseDetails('${escapeHtml(c.name).replace(/'/g, "\\'")}', ${JSON.stringify(c.stats).replace(/"/g, '&quot;')})">View Course Details</button>
        </div>
    `).join('');
}

async function handleLogout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        document.getElementById('dashboardWrapper').classList.remove('active');
        document.getElementById('authWrapper').style.display = 'flex';
        document.body.style.alignItems = '';
        showToast('Signed out successfully');
        showPage('loginPage');
    } catch (err) {
        showToast('Logout failed');
    }
}

// Initialize session check
window.addEventListener('DOMContentLoaded', checkSession);

// ===== NAV ITEMS =====
document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', function() {
        const page = this.getAttribute('data-page');
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        this.classList.add('active');
        
        // Hide all sections
        document.querySelectorAll('.dash-section').forEach(s => s.classList.remove('active'));
        
        // Show selected section
        if (page === 'dashboard') {
            document.getElementById('dashboardSection').classList.add('active');
            document.getElementById('pageTitle').textContent = 'Dashboard';
        } else if (page === 'learner') {
            document.getElementById('learnerSection').classList.add('active');
            document.getElementById('pageTitle').textContent = 'Learner Management';
        } else if (page === 'verifier') {
            document.getElementById('verifierSection').classList.add('active');
            document.getElementById('pageTitle').textContent = 'Verifier Management';
        } else if (page === 'collaborator') {
            document.getElementById('collaboratorSection').classList.add('active');
            document.getElementById('pageTitle').textContent = 'Collaborator Management';
        } else if (page === 'opportunity') {
            document.getElementById('opportunitySection').classList.add('active');
            document.getElementById('pageTitle').textContent = 'Opportunity Management';
        } else if (page === 'reports') {
            document.getElementById('reportsSection').classList.add('active');
            document.getElementById('pageTitle').textContent = 'Reports and Analytics';
        }
    });
});

// ===== TABS =====
function changeChartPeriod(period) {
    // Update active tab
    document.querySelectorAll('.tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.toLowerCase() === period) {
            btn.classList.add('active');
        }
    });

    // Chart data for different periods
    const chartData = {
        daily: 'M0,120 Q50,110 100,90 T200,70 T300,50 T400,40',
        weekly: 'M0,110 Q50,95 100,85 T200,65 T300,45 T400,35',
        monthly: 'M0,100 Q50,85 100,75 T200,55 T300,40 T400,30',
        quarterly: 'M0,90 Q50,75 100,65 T200,50 T300,35 T400,25',
        yearly: 'M0,80 Q50,65 100,55 T200,40 T300,30 T400,20'
    };

    const linePath = document.getElementById('linePath');
    const lineArea = document.getElementById('lineArea');
    
    const path = chartData[period];
    linePath.setAttribute('d', path);
    lineArea.setAttribute('d', path + ' L400,150 L0,150 Z');
}

// ===== NOTIFICATIONS =====
function toggleNotifications() {
    const dropdown = document.getElementById('notificationDropdown');
    dropdown.classList.toggle('active');
}

function markAllRead() {
    document.querySelectorAll('.notif-item.unread').forEach(item => {
        item.classList.remove('unread');
    });
    showToast('All notifications marked as read');
}

// Close notification dropdown when clicking outside
document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('notificationDropdown');
    const btn = document.getElementById('notifBtn');
    if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
        dropdown.classList.remove('active');
    }
});

// ===== THEME TOGGLE =====
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    
    // Update icon
    const icon = document.getElementById('themeIcon');
    if (newTheme === 'dark') {
        icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
    } else {
        icon.innerHTML = '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>';
    }
}

// ===== SEARCH =====
function openSearch() {
    document.getElementById('searchContainer').classList.add('active');
    document.getElementById('searchInput').focus();
}

function closeSearch() {
    document.getElementById('searchContainer').classList.remove('active');
}

// ===== QUICK ADD STUDENT =====
function openQuickAddModal() {
    document.getElementById('quickAddModal').classList.add('active');
}

function closeQuickAddModal() {
    document.getElementById('quickAddModal').classList.remove('active');
    document.getElementById('quickAddForm').reset();
}

document.getElementById('quickAddForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const inputs = this.querySelectorAll('input');
    const firstName = inputs[0].value.trim();
    const lastName = inputs[1].value.trim();
    const email = inputs[2].value.trim();
    
    try {
        const response = await fetch('/api/students', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name: `${firstName} ${lastName}`, email: email })
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to add student');
        
        showToast('Student added successfully');
        closeQuickAddModal();
        loadStudents();
        loadDashboardStats();
    } catch (err) {
        showToast(err.message);
    }
});

// ===== BULK UPLOAD STUDENT =====
function openBulkUploadModal() {
    document.getElementById('bulkUploadModal').classList.add('active');
}

function closeBulkUploadModal() {
    document.getElementById('bulkUploadModal').classList.remove('active');
    document.getElementById('bulkUploadForm').reset();
    document.getElementById('fileName').textContent = '';
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        document.getElementById('fileName').textContent = 'Selected: ' + file.name;
    }
}

document.getElementById('bulkUploadForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const fileInput = document.getElementById('csvFileInput');
    if (!fileInput.files[0]) {
        showToast('Please select a file');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    
    try {
        const response = await fetch('/api/students/bulk-upload', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Upload failed');
        
        showToast(data.message);
        closeBulkUploadModal();
        loadStudents();
        loadDashboardStats();
    } catch (err) {
        showToast(err.message);
    }
});

// ===== QUICK ADD VERIFIER =====
function openQuickAddVerifierModal() {
    document.getElementById('quickAddVerifierModal').classList.add('active');
}

function closeQuickAddVerifierModal() {
    document.getElementById('quickAddVerifierModal').classList.remove('active');
    document.getElementById('quickAddVerifierForm').reset();
}

document.getElementById('quickAddVerifierForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const inputs = this.querySelectorAll('input');
    const firstName = inputs[0].value.trim();
    const lastName = inputs[1].value.trim();
    const email = inputs[2].value.trim();
    
    try {
        const response = await fetch('/api/verifiers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name: `${firstName} ${lastName}`, email: email })
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to add verifier');
        
        showToast('Verifier added successfully');
        closeQuickAddVerifierModal();
        loadVerifiers();
        loadDashboardStats();
    } catch (err) {
        showToast(err.message);
    }
});

// ===== BULK UPLOAD VERIFIER =====
function openBulkUploadVerifierModal() {
    document.getElementById('bulkUploadVerifierModal').classList.add('active');
}

function closeBulkUploadVerifierModal() {
    document.getElementById('bulkUploadVerifierModal').classList.remove('active');
    document.getElementById('bulkUploadVerifierForm').reset();
    document.getElementById('verifierFileName').textContent = '';
}

function handleVerifierFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        document.getElementById('verifierFileName').textContent = 'Selected: ' + file.name;
    }
}

// ===== SAMPLE DOWNLOADS =====
function downloadSampleCSV() {
    const content = "First Name,Last Name,Email\nAhmed,Al-Mansoori,ahmed@qf.edu.qa\nFatima,Al-Thani,fatima@qf.edu.qa";
    const blob = new Blob([content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students_sample.csv';
    a.click();
}

function downloadSampleVerifierCSV() {
    const content = "First Name,Last Name,Email,Subject\nHassan,Al-Kuwari,hassan@qf.edu.qa,Data Science";
    const blob = new Blob([content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'verifiers_sample.csv';
    a.click();
}

// ===== HELPERS =====
function filterStudents() {
    const status = document.getElementById('statusFilter').value;
    const rows = document.querySelectorAll('#studentsTableBody tr');
    rows.forEach(row => {
        if (status === 'all' || row.getAttribute('data-status') === status) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function filterVerifiers() {
    const status = document.getElementById('verifierStatusFilter').value;
    const rows = document.querySelectorAll('#verifiersTableBody tr');
    rows.forEach(row => {
        if (status === 'all' || row.getAttribute('data-status') === status) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// Close search on Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeSearch();
        closeCourseModal();
        closeOpportunityModal();
        closeOpportunityDetailsModal();
        closeCollaboratorCoursesModal();
        closeQuickAddModal();
        closeBulkUploadModal();
        closeQuickAddVerifierModal();
        closeBulkUploadVerifierModal();
        closeVerifierDetailsModal();
    }
});

// Close search when clicking outside
document.getElementById('searchContainer').addEventListener('click', function(e) {
    if (e.target === this) {
        closeSearch();
    }
});

// ===== COURSE MODAL =====
function openCourseDetails(courseName, stats) {
    document.getElementById('modalCourseTitle').textContent = courseName;
    document.getElementById('modalEnrolled').textContent = stats.enrolled;
    document.getElementById('modalCompleted').textContent = stats.completed;
    document.getElementById('modalInProgress').textContent = stats.inProgress;
    document.getElementById('modalHalfDone').textContent = stats.halfDone;
    document.getElementById('courseModal').classList.add('active');
}

function closeCourseModal() {
    document.getElementById('courseModal').classList.remove('active');
}

// Close modal when clicking outside
document.getElementById('courseModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeCourseModal();
    }
});

// ===== OPPORTUNITY DETAILS MODAL =====
function openOpportunityDetails(title, details) {
    document.getElementById('opportunityDetailTitle').textContent = title;
    document.getElementById('opportunityDetailDuration').textContent = details.duration;
    document.getElementById('opportunityDetailStartDate').textContent = details.startDate;
    document.getElementById('opportunityDetailApplicants').textContent = details.applicants;
    document.getElementById('opportunityDetailDescription').textContent = details.description;
    document.getElementById('opportunityDetailFuture').textContent = details.futureOpportunities;
    document.getElementById('opportunityDetailPrereqs').textContent = details.prerequisites;
    
    const skillsContainer = document.getElementById('opportunityDetailSkills');
    skillsContainer.innerHTML = '';
    details.skills.forEach(skill => {
        const tag = document.createElement('span');
        tag.className = 'skill-tag';
        tag.textContent = skill;
        skillsContainer.appendChild(tag);
    });
    
    document.getElementById('opportunityDetailsModal').classList.add('active');
}

function closeOpportunityDetailsModal() {
    document.getElementById('opportunityDetailsModal').classList.remove('active');
}

// Global state for current opportunities
let currentOpportunities = [];
let editingOpportunityId = null;

async function loadOpportunities() {
    try {
        const response = await fetch('/api/opportunities');
        if (!response.ok) throw new Error('Failed to fetch opportunities');
        const data = await response.json();
        currentOpportunities = data.opportunities;
        renderOpportunityCards();
    } catch (err) {
        showToast('Error loading opportunities');
        console.error(err);
    }
}

function renderOpportunityCards() {
    const grid = document.getElementById('opportunitiesGrid');
    const emptyState = document.getElementById('opportunitiesEmptyState');
    
    // Clear existing cards (except empty state)
    const existingCards = grid.querySelectorAll('.opportunity-card');
    existingCards.forEach(c => c.remove());

    if (currentOpportunities.length === 0) {
        emptyState.style.display = 'flex';
        return;
    }

    emptyState.style.display = 'none';

    currentOpportunities.forEach(opp => {
        const card = document.createElement('div');
        card.className = 'opportunity-card';
        card.dataset.id = opp.id;

        card.innerHTML = `
            <div class="opportunity-card-header">
                <h5>${escapeHtml(opp.name)}</h5>
                <div class="opportunity-meta">
                    <span><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${escapeHtml(opp.duration)}</span>
                    <span><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${escapeHtml(opp.start_date)}</span>
                </div>
            </div>
            <p class="opportunity-description">${escapeHtml(opp.description)}</p>
            <div class="opportunity-skills">
                <div class="opportunity-skills-label">Skills You'll Gain</div>
                <div class="skills-tags">
                    ${opp.skills.map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`).join('')}
                </div>
            </div>
            <div class="opportunity-footer">
                <span class="applicants-count">${opp.max_applicants ? opp.max_applicants + ' max applicants' : 'Unlimited applicants'}</span>
                <div class="opportunity-actions">
                    <button class="view-course-btn btn-sm" onclick="openOpportunityDetailsById(${opp.id})">Details</button>
                    <button class="edit-btn btn-sm" onclick="editOpportunity(${opp.id})">
                        <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="delete-btn btn-sm" onclick="deleteOpportunity(${opp.id})">
                        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function openOpportunityDetailsById(id) {
    const opp = currentOpportunities.find(o => o.id === id);
    if (!opp) return;
    
    openOpportunityDetails(opp.name, {
        duration: opp.duration,
        startDate: opp.start_date,
        applicants: opp.max_applicants || 'Unlimited',
        description: opp.description,
        futureOpportunities: opp.future_opportunities,
        skills: opp.skills,
        prerequisites: 'As per program guidelines'
    });
}

function editOpportunity(id) {
    const opp = currentOpportunities.find(o => o.id === id);
    if (!opp) return;

    editingOpportunityId = id;
    document.getElementById('oppName').value = opp.name;
    document.getElementById('oppDuration').value = opp.duration;
    document.getElementById('oppStartDate').value = opp.start_date;
    document.getElementById('oppDescription').value = opp.description;
    document.getElementById('oppSkills').value = opp.skills.join(', ');
    document.getElementById('oppCategory').value = opp.category.toLowerCase();
    document.getElementById('oppFuture').value = opp.future_opportunities;
    document.getElementById('oppMaxApplicants').value = opp.max_applicants || '';
    
    document.querySelector('#opportunityModal h3').textContent = 'Edit Opportunity';
    openOpportunityModal();
}

async function deleteOpportunity(id) {
    if (!confirm('Are you sure you want to delete this opportunity? This action cannot be undone.')) return;

    try {
        const response = await fetch(`/api/opportunities/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Delete failed');
        
        currentOpportunities = currentOpportunities.filter(o => o.id !== id);
        renderOpportunityCards();
        showToast('Opportunity deleted successfully');
    } catch (err) {
        showToast('Error deleting opportunity');
        console.error(err);
    }
}

function applyToOpportunity() {
    showToast('Application submitted successfully!');
    closeOpportunityDetailsModal();
}

document.getElementById('opportunityDetailsModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeOpportunityDetailsModal();
    }
});

// ===== COLLABORATOR COURSES MODAL =====
function openCollaboratorCourses(name, role) {
    document.getElementById('collaboratorName').textContent = name + "'s Submitted Courses";
    document.getElementById('collaboratorRole').textContent = 'Role: ' + role;
    document.getElementById('collaboratorCoursesModal').classList.add('active');
}

function closeCollaboratorCoursesModal() {
    document.getElementById('collaboratorCoursesModal').classList.remove('active');
}

function approveCourse(courseName) {
    showToast(courseName + ' has been approved!');
    // In a real app, you would update the course status here
}

function rejectCourse(courseName) {
    showToast(courseName + ' has been rejected.');
    // In a real app, you would update the course status here
}

function viewCourseDetails(courseName) {
    showToast('Viewing details for ' + courseName);
    // In a real app, you would open a detailed course modal
}

document.getElementById('collaboratorCoursesModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeCollaboratorCoursesModal();
    }
});

// ===== OPPORTUNITY MODAL =====
function openOpportunityModal() {
    document.getElementById('opportunityModal').classList.add('active');
}

function closeOpportunityModal() {
    document.getElementById('opportunityModal').classList.remove('active');
}

// Close modal when clicking outside
document.getElementById('opportunityModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeOpportunityModal();
    }
});

// Handle opportunity form submission
document.getElementById('opportunityForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    // collect values
    const payload = {
        name: document.getElementById('oppName').value.trim(),
        duration: document.getElementById('oppDuration').value.trim(),
        start_date: document.getElementById('oppStartDate').value,
        description: document.getElementById('oppDescription').value.trim(),
        skills: document.getElementById('oppSkills').value.trim(),
        category: document.getElementById('oppCategory').value,
        future_opportunities: document.getElementById('oppFuture').value.trim(),
        max_applicants: document.getElementById('oppMaxApplicants').value.trim()
    };

    // basic validation
    if (!payload.name || !payload.duration || !payload.start_date || !payload.description || !payload.skills || !payload.category || !payload.future_opportunities) {
        showToast('Please fill all required fields');
        return;
    }

    try {
        const url = editingOpportunityId ? `/api/opportunities/${editingOpportunityId}` : '/api/opportunities';
        const method = editingOpportunityId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to save opportunity');

        if (editingOpportunityId) {
            const index = currentOpportunities.findIndex(o => o.id === editingOpportunityId);
            currentOpportunities[index] = data.opportunity;
            showToast('Opportunity updated successfully');
        } else {
            currentOpportunities.unshift(data.opportunity);
            showToast('Opportunity created successfully');
        }

        renderOpportunityCards();
        closeOpportunityModal();
        this.reset();
        editingOpportunityId = null;
        document.querySelector('#opportunityModal h3').textContent = 'Add New Opportunity';
    } catch (err) {
        showToast(err.message);
        console.error(err);
    }
});

// small helper to avoid HTML injection when inserting text
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ===== QUICK ADD STUDENT MODAL =====
function openQuickAddModal() {
    document.getElementById('quickAddModal').classList.add('active');
}

function closeQuickAddModal() {
    document.getElementById('quickAddModal').classList.remove('active');
    document.getElementById('quickAddForm').reset();
}

document.getElementById('quickAddModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeQuickAddModal();
    }
});

document.getElementById('quickAddForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const inputs = this.querySelectorAll('input');
    const firstName = inputs[0].value.trim();
    const lastName = inputs[1].value.trim();
    const email = inputs[2].value.trim();
    
    try {
        const response = await fetch('/api/students', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name: `${firstName} ${lastName}`, email: email })
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to add student');
        
        showToast('Student added successfully');
        closeQuickAddModal();
        loadStudents();
        loadDashboardStats();
    } catch (err) {
        showToast(err.message);
    }
});

// ===== BULK UPLOAD MODAL =====
function openBulkUploadModal() {
    document.getElementById('bulkUploadModal').classList.add('active');
}

function closeBulkUploadModal() {
    document.getElementById('bulkUploadModal').classList.remove('active');
    document.getElementById('bulkUploadForm').reset();
    document.getElementById('fileName').textContent = '';
}

document.getElementById('bulkUploadModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeBulkUploadModal();
    }
});

document.getElementById('bulkUploadForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const fileInput = document.getElementById('csvFileInput');
    if (!fileInput.files[0]) {
        showToast('Please select a file');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    
    try {
        const response = await fetch('/api/students/bulk-upload', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Upload failed');
        
        showToast(data.message);
        closeBulkUploadModal();
        loadStudents();
        loadDashboardStats();
    } catch (err) {
        showToast(err.message);
    }
});

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        document.getElementById('fileName').textContent = '✓ Selected: ' + file.name;
    }
}

function downloadSampleCSV() {
    const content = "First Name,Last Name,Email\nAhmed,Al-Mansoori,ahmed@qf.edu.qa\nFatima,Al-Thani,fatima@qf.edu.qa";
    const blob = new Blob([content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students_sample.csv';
    a.click();
}

// ===== QUICK ADD VERIFIER MODAL =====
function openQuickAddVerifierModal() {
    document.getElementById('quickAddVerifierModal').classList.add('active');
}

function closeQuickAddVerifierModal() {
    document.getElementById('quickAddVerifierModal').classList.remove('active');
    document.getElementById('quickAddVerifierForm').reset();
}

document.getElementById('quickAddVerifierModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeQuickAddVerifierModal();
    }
});

document.getElementById('quickAddVerifierForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const inputs = this.querySelectorAll('input');
    const firstName = inputs[0].value.trim();
    const lastName = inputs[1].value.trim();
    const email = inputs[2].value.trim();
    
    try {
        const response = await fetch('/api/verifiers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name: `${firstName} ${lastName}`, email: email })
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to add verifier');
        
        showToast('Verifier added successfully');
        closeQuickAddVerifierModal();
        loadVerifiers();
        loadDashboardStats();
    } catch (err) {
        showToast(err.message);
    }
});

// ===== BULK UPLOAD VERIFIER MODAL =====
function openBulkUploadVerifierModal() {
    document.getElementById('bulkUploadVerifierModal').classList.add('active');
}

function closeBulkUploadVerifierModal() {
    document.getElementById('bulkUploadVerifierModal').classList.remove('active');
    document.getElementById('bulkUploadVerifierForm').reset();
    document.getElementById('verifierFileName').textContent = '';
}

document.getElementById('bulkUploadVerifierModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeBulkUploadVerifierModal();
    }
});

document.getElementById('bulkUploadVerifierForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const fileInput = document.getElementById('csvVerifierFileInput');
    if (!fileInput.files[0]) {
        showToast('Please select a file');
        return;
    }
    
    // In a real app, you'd implement a separate bulk upload for verifiers too
    showToast('Bulk upload for verifiers is currently processing in the background.');
    closeBulkUploadVerifierModal();
});

function handleVerifierFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        document.getElementById('verifierFileName').textContent = '✓ Selected: ' + file.name;
    }
}

function downloadSampleVerifierCSV() {
    const content = "First Name,Last Name,Email,Subject\nHassan,Al-Kuwari,hassan@qf.edu.qa,Data Science";
    const blob = new Blob([content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'verifiers_sample.csv';
    a.click();
}

// ===== VERIFIER DETAILS MODAL =====
function openVerifierDetails(name, stats) {
    document.getElementById('verifierName').textContent = name;
    document.getElementById('verifierTotalStudents').textContent = stats.totalStudents;
    document.getElementById('verifierCertified').textContent = stats.certified;
    document.getElementById('verifierInProgress').textContent = stats.inProgress;
    
    // Populate subjects
    const container = document.getElementById('subjectsContainer');
    if (container) {
        container.innerHTML = '';
        stats.subjects.forEach(subject => {
            const div = document.createElement('div');
            div.className = 'subject-item';
            div.innerHTML = `
                <span class="subject-name">${subject.name}</span>
                <span class="subject-students">${subject.students} students</span>
            `;
            container.appendChild(div);
        });
    }
    
    document.getElementById('verifierDetailsModal').classList.add('active');
}

function closeVerifierDetailsModal() {
    document.getElementById('verifierDetailsModal').classList.remove('active');
}

document.getElementById('verifierDetailsModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeVerifierDetailsModal();
    }
});

// ===== STUDENT FILTERS =====
function filterStudents() {
    const statusFilter = document.getElementById('statusFilter').value;
    const rows = document.querySelectorAll('#studentsTableBody tr');
    
    rows.forEach(row => {
        const rowStatus = row.getAttribute('data-status');
        let showRow = true;
        if (statusFilter !== 'all' && rowStatus !== statusFilter) {
            showRow = false;
        }
        row.style.display = showRow ? '' : 'none';
    });
}

// ===== VERIFIER FILTERS =====
function filterVerifiers() {
    const statusFilter = document.getElementById('verifierStatusFilter').value;
    const rows = document.querySelectorAll('#verifiersTableBody tr');
    
    rows.forEach(row => {
        const rowStatus = row.getAttribute('data-status');
        let showRow = true;
        if (statusFilter !== 'all' && rowStatus !== statusFilter) {
            showRow = false;
        }
        row.style.display = showRow ? '' : 'none';
    });
}

// ===== AUTH HANDLERS =====
async function handleLogout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.reload();
    } catch (err) {
        showToast('Logout failed');
        console.error(err);
    }
}

document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    clearAllErrors('loginForm');
    let valid = true;
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const captchaInput = document.getElementById('loginCaptchaInput').value.trim();
    const rememberMe = document.querySelector('.remember-me input').checked;

    if (!email || !isValidEmail(email)) { showError('loginEmailErr'); document.getElementById('loginEmail').classList.add('error'); valid = false; }
    if (!password) { showError('loginPasswordErr','Please enter your password'); document.getElementById('loginPassword').classList.add('error'); valid = false; }
    if (!captchaInput) { showError('loginCaptchaErr','Please enter the captcha code'); valid = false; }
    else if (captchaInput !== captchas.login) { showError('loginCaptchaErr','Captcha does not match. Please try again.'); valid = false; generateCaptcha('login'); }

    if (!valid) { shakeForm('loginForm'); return; }

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, remember_me: rememberMe })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Invalid email or password');

        showToast('Login successful! Redirecting...');
        setTimeout(() => showDashboard(data.admin.email, data.admin.full_name), 1200);
        generateCaptcha('login');
    } catch (err) {
        showToast(err.message);
        shakeForm('loginForm');
    }
});

document.getElementById('signupForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    clearAllErrors('signupForm');
    let valid = true;
    const fullName = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value.trim();
    const confirmPassword = document.getElementById('signupConfirmPassword').value.trim();
    const captchaInput = document.getElementById('signupCaptchaInput').value.trim();

    if (!fullName) { showError('signupNameErr'); document.getElementById('signupName').classList.add('error'); valid = false; }
    if (!email || !isValidEmail(email)) { showError('signupEmailErr'); document.getElementById('signupEmail').classList.add('error'); valid = false; }
    if (!password || password.length < 8) { showError('signupPasswordErr'); document.getElementById('signupPassword').classList.add('error'); valid = false; }
    if (!confirmPassword || password !== confirmPassword) { showError('signupConfirmPasswordErr'); document.getElementById('signupConfirmPassword').classList.add('error'); valid = false; }
    if (!captchaInput) { showError('signupCaptchaErr','Please enter the captcha code'); valid = false; }
    else if (captchaInput !== captchas.signup) { showError('signupCaptchaErr','Captcha does not match.'); valid = false; generateCaptcha('signup'); }

    if (!valid) { shakeForm('signupForm'); return; }

    try {
        const response = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name: fullName, email, password, confirm_password: confirmPassword })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Account creation failed');

        showToast('Account created successfully!');
        generateCaptcha('signup');
        this.reset();
        if (typeof checkStrength === 'function') checkStrength('');
        setTimeout(() => showPage('loginPage'), 1500);
    } catch (err) {
        showToast(err.message);
        shakeForm('signupForm');
    }
});

document.getElementById('forgotForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    clearAllErrors('forgotForm');
    let valid = true;
    const email = document.getElementById('forgotEmail').value.trim();
    const captchaInput = document.getElementById('forgotCaptchaInput').value.trim();

    if (!email || !isValidEmail(email)) { showError('forgotEmailErr'); document.getElementById('forgotEmail').classList.add('error'); valid = false; }
    if (!captchaInput) { showError('forgotCaptchaErr','Please enter the captcha code'); valid = false; }
    else if (captchaInput !== captchas.forgot) { showError('forgotCaptchaErr','Captcha does not match.'); valid = false; generateCaptcha('forgot'); }

    if (!valid) { shakeForm('forgotForm'); return; }

    try {
        const response = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        showToast('If the email is registered, a password reset link has been generated.');
        generateCaptcha('forgot');
        this.reset();
    } catch (err) {
        showToast('An error occurred. Please try again.');
    }
});

// Clear errors on input
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', function() {
        this.classList.remove('error');
        const err = this.closest('.form-group')?.querySelector('.error-msg');
        if (err) err.classList.remove('show');
    });
});

// Responsive sidebar
window.addEventListener('resize', () => {
    const toggle = document.getElementById('menuToggle');
    if (toggle) toggle.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
});

// Initialize
checkSession();
