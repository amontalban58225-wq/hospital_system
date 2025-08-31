class BillingCategoryManager {
  constructor() {
    this.apiUrl = 'http://localhost/hospital_billing2/api/billing_category.php';
    this.categories = [];
    this.init();
  }

  init() {
    this.loadCategories();
    this.setupEventListeners();
    this.setupSearchFilter();
  }

  setupEventListeners() {
    document.getElementById('addCategoryBtn').addEventListener('click', () => this.openModal('add'));
    document.getElementById('categoryTableBody').addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;

      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      if (!id || !action) return;

      const category = this.categories.find(c => String(c.billing_categoryid) === String(id));
      if (!category) return;

      this.openModal(action, category);
    });
  }

  setupSearchFilter() {
    const input = document.getElementById('categorySearch');
    if (!input) return;

    input.addEventListener('input', () => {
      const filter = input.value.toLowerCase();
      const tbody = document.getElementById('categoryTableBody');
      Array.from(tbody.rows).forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(filter) ? '' : 'none';
      });
    });
  }

  async loadCategories() {
    const tbody = document.getElementById('categoryTableBody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="3" class="text-center py-4">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="mt-2">Loading categories...</p>
    </td></tr>`;

    try {
      const res = await axios.get(this.apiUrl, { params: { operation: 'getAllCategories' }});
      if (res.data.error) throw new Error(res.data.error);
      this.categories = Array.isArray(res.data) ? res.data : [];
      this.renderTable();
    } catch(err) {
      tbody.innerHTML = `<tr><td colspan="3" class="text-center text-danger py-4">${err.message}</td></tr>`;
    }
  }

  renderTable() {
    const tbody = document.getElementById('categoryTableBody');
    if (!tbody) return;

    if (this.categories.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted">No categories found.</td></tr>`;
      return;
    }
    tbody.innerHTML = this.categories.map(category => `
      <tr>
        <td><strong>${this.escape(category.name)}</strong></td>
        <td>
          <div style="display: flex; flex-direction: row; gap: 8px; flex-wrap: nowrap;">
            <button class="btn btn-sm btn-info me-1" style="flex-shrink: 0;" data-id="${category.billing_categoryid}" data-action="view" title="View Category"><i class="bi bi-eye"></i></button>
            <button class="btn btn-sm btn-warning me-1" style="flex-shrink: 0;" data-id="${category.billing_categoryid}" data-action="edit" title="Edit Category"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-danger" style="flex-shrink: 0;" data-id="${category.billing_categoryid}" data-action="delete" title="Delete Category"><i class="bi bi-trash"></i></button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  openModal(mode, category = null) {
    // Remove existing modal
    const existingModal = document.getElementById('categoryModal');
    if (existingModal) existingModal.remove();

    let title = '';
    let body = '';

    if (mode === 'view') {
      title = 'View Billing Category';
      body = `<p><strong>Name:</strong> ${this.escape(category.name)}</p>`;
    } else if (mode === 'delete') {
      title = 'Confirm Delete Category';
      body = `<p>Are you sure you want to delete category <strong>${this.escape(category.name)}</strong>?</p>`;
    } else {
      title = mode === 'add' ? 'Add New Category' : 'Edit Category';
      body = `
        <form id="categoryForm" class="needs-validation" novalidate>
          <input type="hidden" id="categoryId" value="${category ? category.billing_categoryid : ''}" />
          <div class="mb-3">
            <label for="categoryName" class="form-label">Category Name</label>
            <input type="text" id="categoryName" class="form-control" value="${category ? this.escape(category.name) : ''}" required />
            <div class="invalid-feedback">Category name is required.</div>
          </div>
        </form>
      `;
    }

    const modalHtml = `
      <div class="modal fade" id="categoryModal" tabindex="-1" aria-labelledby="categoryModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header ${mode === 'delete' ? 'bg-danger text-white' : 'bg-primary text-white'}">
              <h5 class="modal-title" id="categoryModalLabel">${title}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">${body}</div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              ${(mode === 'add' || mode === 'edit') ? `<button type="button" class="btn btn-primary" id="saveCategoryBtn">${mode === 'add' ? 'Add' : 'Update'}</button>` : ''}
              ${mode === 'delete' ? `<button type="button" class="btn btn-danger" id="confirmDeleteCategoryBtn">Delete</button>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modalEl = document.getElementById('categoryModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove());

    if (mode === 'add' || mode === 'edit') {
      document.getElementById('saveCategoryBtn').addEventListener('click', () => this.saveCategory(mode, modal));
      const form = document.getElementById('categoryForm');
      form.classList.remove('was-validated');
      form.addEventListener('submit', e => e.preventDefault());
    } else if (mode === 'delete') {
      document.getElementById('confirmDeleteCategoryBtn').addEventListener('click', () => this.deleteCategory(category.billing_categoryid, modal));
    }
  }

  async saveCategory(mode, modal) {
    const form = document.getElementById('categoryForm');
    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      return;
    }

    const data = {
      billing_categoryid: form.querySelector('#categoryId').value || null,
      name: form.querySelector('#categoryName').value.trim() // name aligned with API field
    };

    try {
      const res = await axios.post(this.apiUrl, {
        operation: mode === 'edit' ? 'updateCategory' : 'insertCategory',
        json: data
      });
      if (res.data.success === false) {
        this.showAlert(res.data.error, 'danger');
        return;
      }
      this.showAlert(`Category ${mode === 'edit' ? 'updated' : 'added'} successfully!`, 'success');
      modal.hide();
      this.loadCategories();
    } catch (err) {
      this.showAlert(`Failed to ${mode === 'edit' ? 'update' : 'add'} category: ${err.message}`, 'danger');
    }
  }

  async deleteCategory(id, modal) {
    try {
      const res = await axios.post(this.apiUrl, null, {
        params: { operation: 'deleteCategory', billing_categoryid: id }
      });
      if (res.data.success === false) throw new Error(res.data.error);
      this.showAlert('Category deleted successfully!', 'success');
      modal.hide();
      this.loadCategories();
    } catch (err) {
      this.showAlert('Failed to delete category: ' + err.message, 'danger');
    }
  }

  showAlert(message, type = 'info') {
    document.querySelectorAll('.alert.position-fixed').forEach(el => el.remove());

    const icon = type === 'success' ? 'check-circle' : (type === 'danger' ? 'exclamation-triangle' : 'info-circle');
    const alertHtml = `
      <div class="alert alert-${type} alert-dismissible fade show position-fixed"
           style="top: 20px; right: 20px; min-width: 350px; z-index: 1055;">
        <i class="bi bi-${icon} me-2"></i>${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', alertHtml);

    const alertEl = document.querySelector('.alert.position-fixed');
    if (alertEl && window.bootstrap?.Alert) {
      const bsAlert = new bootstrap.Alert(alertEl);
      setTimeout(() => bsAlert.close(), 3000);
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

document.addEventListener('DOMContentLoaded', () => new BillingCategoryManager());
