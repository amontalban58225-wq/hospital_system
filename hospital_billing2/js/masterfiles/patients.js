class PatientManager {
  constructor() {
    this.patientsData = [];
    this.baseApiUrl = 'http://localhost/hospital_billing2/api';
    this.init();
  }

  init() {
    this.loadPatients();
    this.loadInsuranceProviders();
    this.setupEventListeners();
  }

  setupEventListeners() {
    const addBtn = document.getElementById('addPatientBtn');
    if (addBtn) addBtn.addEventListener('click', () => this.openModal('add'));

    const tbody = document.getElementById('patientTableBody');
    if (tbody) {
      tbody.addEventListener('click', e => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (!action || !id) return;
        const patient = this.patientsData.find(p => String(p.patientid) === String(id));
        if (!patient) return;

        switch (action) {
          case 'view':
            this.openModal('view', patient);
            break;
          case 'edit':
            this.openModal('edit', patient);
            break;
          case 'delete':
            this.openModal('delete', patient);
            break;
        }
      });
    }
  }

  async loadPatients() {
    const tbody = document.getElementById('patientTableBody');
    if (!tbody) return;

    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-5">
          <div class="smooth-loader">
            <span></span><span></span><span></span>
          </div>
          <p class="mt-3 text-muted fw-semibold">Loading patients...</p>
        </td>
      </tr>`;

    try {
      const res = await axios.get(`${this.baseApiUrl}/patients.php`, { params: { operation: 'getAll' } });
      if (res.data.error) throw new Error(res.data.error);
      this.patientsData = Array.isArray(res.data) ? res.data : [];
      this.renderPatientsTable();
    } catch (err) {
      console.error('Error loading patients:', err);
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center text-danger py-4">
            <i class="bi bi-exclamation-triangle me-2"></i>Failed to load patients
          </td>
        </tr>`;
    }
  }

  renderPatientsTable() {
    const tbody = document.getElementById('patientTableBody');
    if (!tbody) return;

    if (!this.patientsData.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-4 text-muted">
            <i class="bi bi-inbox me-2"></i>No patients found
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = this.patientsData.map(p => `
      <tr>
        <td><strong>${p.fullname}</strong></td>
        <td>${p.gender}</td>
        <td><i class="bi bi-telephone me-1"></i>${p.contact_no || ''}</td>

        <td>
  <div style="display: flex; flex-direction: row; gap: 8px; flex-wrap: nowrap;">
    <button class="btn btn-sm btn-info" style="flex-shrink: 0;" data-id="${p.patientid}" data-action="view" title="View Patient">
      <i class="bi bi-eye"></i>
    </button>
    <button class="btn btn-sm btn-warning" style="flex-shrink: 0;" data-id="${p.patientid}" data-action="edit" title="Edit Patient">
      <i class="bi bi-pencil"></i>
    </button>
    <button class="btn btn-sm btn-danger" style="flex-shrink: 0;" data-id="${p.patientid}" data-action="delete" title="Delete Patient">
      <i class="bi bi-trash"></i>
    </button>
  </div>
</td>



      </tr>`).join('');
  }

  async loadInsuranceProviders() {
    try {
      const res = await axios.get(`${this.baseApiUrl}/insurance_provider.php`, { params: { operation: 'getAll' } });
      const providers = Array.isArray(res.data) ? res.data : [];
      const select = document.getElementById('insuranceid');
      if (!select) return;
      select.innerHTML = '<option value="">-- Select Provider --</option>' +
        providers.map(p => `<option value="${p.insuranceid}">${p.name}</option>`).join('');
    } catch (e) {
      console.error('Error loading insurance providers:', e);
    }
  }

  openModal(mode, patient = null) {
    const existingModal = document.getElementById('patientModal');
    if (existingModal) existingModal.remove();

    let modalHtml = '';
    if (mode === 'delete') {
      modalHtml = this.getDeleteModalHtml(patient);
    } else {
      modalHtml = this.getFormModalHtml(mode, patient);
    }

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modalEl = document.getElementById('patientModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove());

    if (mode === 'delete') {
      modalEl.querySelector('#confirmDeleteBtn').onclick = async () => {
        await this.deletePatient(patient.patientid);
        modal.hide();
      };
    } else {
      const form = modalEl.querySelector('#patientForm');
      const saveBtn = modalEl.querySelector('#savePatientBtn');

      if (mode !== 'view') {
        this.fillForm(patient, false, modalEl);

        // Load insurance providers NOW for modal select
        this.loadInsuranceProvidersForSelect(form.querySelector('#insuranceid'), patient ? patient.insuranceid : '');

        saveBtn.onclick = async () => {
          if (this.validateForm(form)) await this.savePatient(modal);
        };

        form.onsubmit = async e => {
          e.preventDefault();
          if (this.validateForm(form)) await this.savePatient(modal);
        };
      } else {
        this.fillForm(patient, true, modalEl);
      }
    }
  }

  getFormModalHtml(mode, patient) {
    const isEdit = mode === 'edit';
    const isView = mode === 'view';
    const titleIcon = mode === 'add' ? 'person-plus' : mode === 'edit' ? 'pencil-square' : 'eye';
    const titleText = mode === 'add' ? 'Add Patient' : mode === 'edit' ? 'Edit Patient' : 'View Patient';

    return `
    <div class="modal fade" id="patientModal" tabindex="-1" aria-labelledby="patientModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header bg-light border-bottom">
            <h5 class="modal-title text-primary fw-bold" id="patientModalLabel">
              <i class="bi bi-${titleIcon} me-2"></i>${titleText}
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body p-4">
            <form id="patientForm" novalidate style="display: ${isView ? 'none' : 'block'};">
              <input type="hidden" id="patientId" value="${patient ? patient.patientid : ''}">
              <div class="mb-3">
                <label for="fullname" class="form-label">Full Name</label>
                <input type="text" id="fullname" class="form-control" value="${patient ? patient.fullname : ''}" ${isView ? 'readonly' : 'required'}>
                <div class="invalid-feedback">Full name is required.</div>
              </div>
              <div class="mb-3">
                <label for="gender" class="form-label">Gender</label>
                <select id="gender" class="form-select" ${isView ? 'disabled' : 'required'}>
                  <option value="">-- Select Gender --</option>
                  <option value="Male" ${patient?.gender === 'Male' ? 'selected' : ''}>Male</option>
                  <option value="Female" ${patient?.gender === 'Female' ? 'selected' : ''}>Female</option>
                  <option value="Other" ${patient?.gender === 'Other' ? 'selected' : ''}>Other</option>
                </select>
                <div class="invalid-feedback">Gender is required.</div>
              </div>
              <div class="mb-3">
                <label for="birthdate" class="form-label">Birthdate</label>
                <input type="date" id="birthdate" class="form-control" value="${patient ? patient.birthdate : ''}" ${isView ? 'readonly' : ''}>
              </div>
              <div class="mb-3">
                <label for="contact_no" class="form-label">Contact No</label>
                <input type="tel" id="contact_no" class="form-control" value="${patient ? patient.contact_no : ''}" ${isView ? 'readonly' : ''}>
              </div>
              <div class="mb-3">
                <label for="insuranceid" class="form-label">Insurance Provider</label>
                <select id="insuranceid" class="form-select" ${isView ? 'disabled' : ''}>
                  <option value="">-- Loading providers... --</option>
                </select>
              </div>
              <div class="mb-3">
                <label for="address" class="form-label">Address</label>
                <textarea id="address" rows="3" class="form-control" ${isView ? 'readonly' : 'required'}>${patient ? patient.address : ''}</textarea>
                <div class="invalid-feedback">Address is required.</div>
              </div>
            </form>
            <div id="patientDetails" style="display: ${isView ? 'block' : 'none'};">

              <p><strong>Full Name:</strong> ${patient ? patient.fullname : ''}</p>
              <p><strong>Gender:</strong> ${patient ? patient.gender : ''}</p>
              <p><strong>Birthdate:</strong> ${patient ? patient.birthdate || '' : ''}</p>
              <p><strong>Contact No:</strong> ${patient ? patient.contact_no || '' : ''}</p>
              <p><strong>Insurance:</strong> ${patient ? patient.insurance_name || '' : ''}</p>
              <p><strong>Address:</strong><br>${patient ? patient.address || '' : ''}</p>
            </div>
          </div>
          <div class="modal-footer bg-light border-top">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button>
            ${!isView ? `<button type="button" class="btn btn-primary" id="savePatientBtn">
              <i class="bi bi-check-circle me-2"></i>${isEdit ? 'Update' : 'Save'}
            </button>` : ''}
          </div>
        </div>
      </div>
    </div>`;
  }

  getDeleteModalHtml(patient) {
    return `
    <div class="modal fade" id="patientModal" tabindex="-1" aria-labelledby="patientModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header bg-light border-bottom text-danger">
            <h5 class="modal-title" id="patientModalLabel">
              <i class="bi bi-exclamation-triangle me-2"></i>Delete Patient
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body text-center pt-4">
            <p>Are you sure you want to delete <strong>${patient.fullname}</strong>?</p>
            <div class="alert alert-warning mt-3 d-flex align-items-center justify-content-center">
              <i class="bi bi-info-circle me-2"></i>
              <strong>Warning:</strong> This action is permanent and cannot be undone.
            </div>
          </div>
          <div class="modal-footer bg-light border-top">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-danger" id="confirmDeleteBtn" data-id="${patient.patientid}">
              <i class="bi bi-trash me-2"></i>Delete
            </button>
          </div>
        </div>
      </div>
    </div>`;
  }

  fillForm(patient, viewOnly = false, modalEl = null) {
    if (!modalEl) modalEl = document.getElementById('patientModal');
    if (!modalEl) return;

    const form = modalEl.querySelector('#patientForm');
    if (!form) return;

    form.querySelector('#patientId').value = patient ? patient.patientid : '';
    form.querySelector('#fullname').value = patient ? patient.fullname : '';
    form.querySelector('#gender').value = patient ? patient.gender : '';
    form.querySelector('#birthdate').value = patient ? patient.birthdate || '' : '';
    form.querySelector('#contact_no').value = patient ? patient.contact_no || '' : '';
    form.querySelector('#insuranceid').value = patient ? patient.insuranceid || '' : '';
    form.querySelector('#address').value = patient ? patient.address || '' : '';

    // Set fields readonly or disabled
    Array.from(form.elements).forEach(el => {
      if (el.id !== 'patientId') {
        el.readOnly = viewOnly && el.tagName !== 'SELECT' && el.tagName !== 'TEXTAREA' && el.type !== 'select-one';
        el.disabled = viewOnly && (el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.type === 'select-one');
        if(el.tagName === 'TEXTAREA') el.disabled = viewOnly;
      }
    });

    // Load insurance providers Select options (only if enabled)
    if (form.querySelector('#insuranceid') && !viewOnly) {
      this.loadInsuranceProvidersForSelect(form.querySelector('#insuranceid'), patient ? patient.insuranceid : '');
    }
  }

  async loadInsuranceProvidersForSelect(selectEl, selectedId = '') {
    try {
      selectEl.innerHTML = '<option value="">-- Loading providers... --</option>';
      const res = await axios.get(`${this.baseApiUrl}/insurance_provider.php`, { params: { operation: 'getAll' } });
      const providers = Array.isArray(res.data) ? res.data : [];
      selectEl.innerHTML = '<option value="">-- Select Provider --</option>' +
        providers.map(p => `<option value="${p.insuranceid}"${String(p.insuranceid) === String(selectedId) ? ' selected' : ''}>${p.name}</option>`).join('');
    } catch (e) {
      console.error('Error loading insurance providers:', e);
      selectEl.innerHTML = '<option value="">-- Failed to load providers --</option>';
    }
  }

  validateForm(form) {
    let valid = true;

    const fullname = form.querySelector('#fullname');
    if (!fullname.value.trim()) {
      fullname.classList.add('is-invalid');
      valid = false;
    } else {
      fullname.classList.remove('is-invalid');
    }

    const gender = form.querySelector('#gender');
    if (!gender.value) {
      gender.classList.add('is-invalid');
      valid = false;
    } else {
      gender.classList.remove('is-invalid');
    }

    const address = form.querySelector('#address');
    if (!address.value.trim()) {
      address.classList.add('is-invalid');
      valid = false;
    } else {
      address.classList.remove('is-invalid');
    }

    return valid;
  }

  async savePatient(modal) {
    const modalEl = modal._element;
    const form = modalEl.querySelector('#patientForm');
    if (!form) return;

    const id = form.querySelector('#patientId').value;
    const data = {
      fullname: form.querySelector('#fullname').value.trim(),
      gender: form.querySelector('#gender').value,
      birthdate: form.querySelector('#birthdate').value,
      contact_no: form.querySelector('#contact_no').value.trim(),
      insuranceid: form.querySelector('#insuranceid').value || null,
      address: form.querySelector('#address').value.trim()
    };
    if (id) data.patientid = id;

    const formData = new FormData();
    formData.append('operation', id ? 'update' : 'insert');
    formData.append('json', JSON.stringify(data));

    try {
      const res = await axios.post(`${this.baseApiUrl}/patients.php`, formData);
      if (res.data.error) throw new Error(res.data.error);
      this.showAlert(`Patient ${id ? 'updated' : 'added'} successfully!`, 'success');
      modal.hide();
      this.loadPatients();
    } catch (e) {
      console.error('Error saving patient:', e);
      this.showAlert(e.response?.data?.error || 'Error saving patient. Please try again.', 'danger');
    }
  }

  async deletePatient(id) {
    try {
      const formData = new FormData();
      formData.append('operation', 'delete');
      formData.append('patientid', id);
      const res = await axios.post(`${this.baseApiUrl}/patients.php`, formData);
      if (res.data.error) throw new Error(res.data.error);
      this.showAlert('Patient deleted successfully!', 'success');
      this.loadPatients();
    } catch (e) {
      console.error('Error deleting patient:', e);
      this.showAlert(e.response?.data?.error || 'Error deleting patient. Please try again.', 'danger');
    }
  }

  showAlert(message, type = 'info') {
    document.querySelectorAll('.alert.position-fixed').forEach(a => a.remove());

    const icon = type === 'success' ? 'check-circle'
      : type === 'danger' ? 'exclamation-triangle'
      : 'info-circle';

    const alertHtml = `
      <div class="alert alert-${type} alert-dismissible fade show position-fixed"
           style="top: 20px; right: 20px; z-index: 1055; min-width: 350px;">
        <i class="bi bi-${icon} me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', alertHtml);

    const alertEl = document.querySelector('.alert.position-fixed');
    if (alertEl && window.bootstrap?.Alert) {
      const bsAlert = new bootstrap.Alert(alertEl);
      setTimeout(() => bsAlert.close(), 4000);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => new PatientManager()); 
