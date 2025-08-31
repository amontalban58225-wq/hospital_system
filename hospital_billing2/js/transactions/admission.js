const BASE_API_URL = 'http://localhost/hospital_billing2/api/';
const TRANSACTIONS_API_URL = BASE_API_URL + 'transactions/';

class AdmissionManager {
  constructor() {
    this.apiUrl = TRANSACTIONS_API_URL + 'admission.php';
    this.admissions = [];
    this.patients = [];
    this.doctors = [];
    this.users = [];
    this.init();
  }

  async init() {
    await this.loadAdmissions();
    await this.loadPatients();
    await this.loadDoctors();
    await this.loadUsers();
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.getElementById('addAdmissionBtn')?.addEventListener('click', () => this.openModal('add'));

    document.getElementById('admissionTableBody')?.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const id = this.escape(btn.dataset.id);
      const action = this.escape(btn.dataset.action);
      const admission = this.admissions.find(a => String(a.admissionid) === String(id));
      if (!admission) return;
      this.openModal(action, admission);
    });
  }

  async loadAdmissions() {
    const tbody = document.getElementById('admissionTableBody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="mt-2">Loading admissions...</p>
    </td></tr>`;

    try {
      const res = await axios.get(this.apiUrl, { params: { operation: 'getAllAdmissions' } });
      this.admissions = Array.isArray(res.data) ? res.data : [];
      this.renderTable();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">${this.escape(err.message)}</td></tr>`;
    }
  }

  async loadPatients() {
    try {
      const res = await axios.get(BASE_API_URL + 'patients.php', { params: { operation: 'getAll' } });
      let allPatients = Array.isArray(res.data) ? res.data : [];
      const admittedPatientIds = new Set(this.admissions
        .filter(a => a.status !== 'Discharged' && a.status !== 'Closed')
        .map(a => a.patientid));
      this.patients = allPatients.filter(p => !admittedPatientIds.has(p.patientid));
    } catch {
      this.patients = [];
    }
  }

  async loadDoctors() {
    try {
      const res = await axios.get(BASE_API_URL + 'doctors.php', { params: { operation: 'getAllDoctors' } });
      this.doctors = Array.isArray(res.data) ? res.data : (res.data.data || []);
    } catch {
      this.doctors = [];
    }
  }

  async loadUsers() {
    try {
      const res = await axios.get(BASE_API_URL + 'users.php', { params: { operation: 'getAllUsers' } });
      this.users = Array.isArray(res.data) ? res.data : (res.data.data || []);
    } catch {
      this.users = [];
    }
  }

  renderTable() {
    const tbody = document.getElementById('admissionTableBody');
    if (!tbody) return;

    if (this.admissions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No admissions found.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.admissions.map(a => `
      <tr>
        <td><strong>${this.escape(a.patient_name)}</strong></td>
        <td>${this.escape(a.admission_date)}</td>
        <td>${this.escape(a.status)}</td>
        <td>
          <div style="display: flex; flex-direction: row; gap: 8px; flex-wrap: nowrap;">
            <button title="View Admission" class="btn btn-sm btn-info me-1" data-id="${this.escape(a.admissionid)}" data-action="view">
              <i class="bi bi-eye"></i>
            </button>
            <button title="Edit Admission" class="btn btn-sm btn-warning me-1" data-id="${this.escape(a.admissionid)}" data-action="edit">
              <i class="bi bi-pencil"></i>
            </button>
            <button title="Delete Admission" class="btn btn-sm btn-danger" data-id="${this.escape(a.admissionid)}" data-action="delete">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  openModal(mode, admission = null) {
    document.querySelectorAll('#admissionModal').forEach(m => m.remove());

    let title, body;

    if (mode === 'view') {
      title = 'View Admission';
      body = `
        <p><strong>Patient:</strong> ${this.escape(admission.patient_name)}</p>
        <p><strong>Doctor:</strong> ${this.escape(admission.doctor_name)}</p>
        <p><strong>User:</strong> ${this.escape(admission.user_name)}</p>
        <p><strong>Date:</strong> ${this.escape(admission.admission_date)}</p>
        <p><strong>Status:</strong> ${this.escape(admission.status)}</p>
      `;
    } else if (mode === 'delete') {
      title = 'Confirm Delete Admission';
      body = `<p>Are you sure to delete admission record for <strong>${this.escape(admission.patient_name)}</strong>?</p>`;
    } else {
      title = mode === 'add' ? 'Add Admission' : 'Edit Admission';

      body = `
        <form id="admissionForm" class="needs-validation" novalidate>
          <input type="hidden" id="admissionId" value="${admission ? this.escape(admission.admissionid) : ''}" />

          <div class="mb-3">
            <label for="patientId" class="form-label">Patient</label>
            ${mode === 'add' ? `
              <select id="patientId" class="form-select" required>
                <option value="">Select Patient</option>
                ${this.patients.map(p => `<option value="${this.escape(p.patientid)}">${this.escape(p.fullname)}</option>`).join('')}
              </select>
              <div class="invalid-feedback">Please select a patient.</div>
            ` : `
              <input type="text" class="form-control" id="patientName" value="${admission ? this.escape(admission.patient_name) : ''}" readonly />
            `}
          </div>

          <div class="mb-3">
            <label for="doctorId" class="form-label">Doctor</label>
            <select id="doctorId" class="form-select" required>
              <option value="">Select Doctor</option>
              ${this.doctors.map(d => `<option value="${this.escape(d.doctorid)}" ${admission && admission.doctorid == d.doctorid ? 'selected' : ''}>${this.escape(d.fullname)}</option>`).join('')}
            </select>
            <div class="invalid-feedback">Please select a doctor.</div>
          </div>

          <div class="mb-3">
            <label for="userId" class="form-label">User</label>
            <select id="userId" class="form-select" required>
              <option value="">Select User</option>
              ${this.users.map(u => `<option value="${this.escape(u.userid)}" ${admission && admission.userid == u.userid ? 'selected' : ''}>${this.escape(u.username)}</option>`).join('')}
            </select>
            <div class="invalid-feedback">Please select a user.</div>
          </div>

          <div class="mb-3">
            <label for="admissionDate" class="form-label">Admission Date</label>
            <input type="date" id="admissionDate" class="form-control" value="${admission ? this.escape(admission.admission_date) : new Date().toISOString().split('T')[0]}" required />
            <div class="invalid-feedback">Please enter an admission date.</div>
          </div>

          ${mode === 'edit' ? `
          <div class="mb-3">
            <label for="admissionStatus" class="form-label">Status</label>
            <select id="admissionStatus" class="form-select" required>
              <option value="Admitted" ${admission.status === 'Admitted' ? 'selected' : ''}>Admitted</option>
              <option value="Discharged" ${admission.status === 'Discharged' ? 'selected' : ''}>Discharged</option>
              <option value="Transferred" ${admission.status === 'Transferred' ? 'selected' : ''}>Transferred</option>
              <option value="Pending" ${admission.status === 'Pending' ? 'selected' : ''}>Pending</option>
            </select>
            <div class="invalid-feedback">Please select a status.</div>
          </div>` : ``}
        </form>
      `;
    }

    const headerColor = mode === 'add' ? 'bg-success' : mode === 'edit' ? 'bg-warning' : mode === 'delete' ? 'bg-danger' : 'bg-primary';

    const modalHtml = `
      <div class="modal fade" id="admissionModal" tabindex="-1" aria-labelledby="admissionModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header ${headerColor} text-white">
              <h5 class="modal-title" id="admissionModalLabel">${title}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">${body}</div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              ${(mode === 'add' || mode === 'edit') ? `<button type="button" class="btn btn-primary" id="saveAdmissionBtn">${mode === 'add' ? 'Add' : 'Update'}</button>` : ''}
              ${mode === 'delete' ? `<button type="button" class="btn btn-danger" id="confirmDeleteAdmissionBtn">Delete</button>` : ''}
            </div>
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modalEl = document.getElementById('admissionModal');
    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();

    if (mode === 'add' || mode === 'edit') {
      document.getElementById('saveAdmissionBtn').addEventListener('click', () => this.saveAdmission(mode, bsModal));
      document.getElementById('admissionForm').addEventListener('submit', e => e.preventDefault());
    } else if (mode === 'delete') {
      document.getElementById('confirmDeleteAdmissionBtn').addEventListener('click', () => this.deleteAdmission(admission.admissionid, bsModal));
    }

    modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove());
  }

  async saveAdmission(mode, modal) {
  const form = document.getElementById('admissionForm');
  if (!form.checkValidity()) {
    form.classList.add('was-validated');
    return;
  }

  const data = {
    admissionid: this.escape(form.querySelector('#admissionId').value) || null,
    patientid: mode === 'add'
      ? this.escape(form.querySelector('#patientId').value)
      : this.admissions.find(a => String(a.admissionid) === String(form.querySelector('#admissionId').value))?.patientid,
    doctorid: this.escape(form.querySelector('#doctorId').value),
    userid: this.escape(form.querySelector('#userId').value),
    admission_date: this.escape(form.querySelector('#admissionDate').value),
    status: mode === 'add'
      ? 'Admitted'   // DB default fallback
      : this.escape(form.querySelector('#admissionStatus').value)
  };

  try {
    const res = await axios.post(this.apiUrl, {
      operation: mode === 'add' ? 'insertAdmission' : 'updateAdmission',
      ...data
    });
    if (res.data.success === false) throw new Error(res.data.error);
    this.showAlert(`Admission ${mode === 'edit' ? 'updated' : 'added'} successfully!`, 'success');
    modal.hide();
    this.loadAdmissions();
  } catch (err) {
    this.showAlert(`Failed to save admission: ${err.message}`, 'danger');
  }
}


  async deleteAdmission(id, modal) {
    try {
      const res = await axios.post(this.apiUrl, { operation: 'deleteAdmission', admissionid: this.escape(id) });
      if (res.data.success === false) throw new Error(res.data.error);
      this.showAlert('Admission deleted successfully!', 'success');
      modal.hide();
      this.loadAdmissions();
    } catch (err) {
      this.showAlert(`Failed to delete admission: ${err.message}`, 'danger');
    }
  }

  showAlert(message, type = 'info') {
    document.querySelectorAll('.alert.position-fixed').forEach(e => e.remove());
    const icons = { success: 'check-circle', danger: 'exclamation-triangle', warning: 'exclamation-circle', info: 'info-circle' };
    const icon = icons[type] || icons.info;

    const alertHtml = `
      <div class="alert alert-${type} alert-dismissible fade show position-fixed"
           style="top: 20px; right: 20px; z-index: 1055; min-width: 350px;">
        <i class="bi bi-${icon} me-2"></i>${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', alertHtml);

    const alertEl = document.querySelector('.alert.position-fixed');
    if (alertEl && window.bootstrap?.Alert) {
      const bsAlert = new bootstrap.Alert(alertEl);
      setTimeout(() => bsAlert.close(), 4000);
    }
  }

  escape(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

document.addEventListener('DOMContentLoaded', () => new AdmissionManager());
