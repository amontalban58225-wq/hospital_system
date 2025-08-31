class BillingManager {
  constructor() {
    this.baseApiUrl = 'http://localhost/hospital_billing2/api/transactions/billing.php';
    this.admissionApiUrl = 'http://localhost/hospital_billing2/api/transactions/admission.php';
    this.billingCategoryApiUrl = 'http://localhost/hospital_billing2/api/billing_category.php';
    this.roomApiUrl = 'http://localhost/hospital_billing2/api/room.php';
    this.labTestApiUrl = 'http://localhost/hospital_billing2/api/lab_test.php';
    this.medicineApiUrl = 'http://localhost/hospital_billing2/api/medicine.php';
    this.admissions = [];
    this.billingCategories = [];
    this.billings = [];
    this.rooms = [];
    this.labTests = [];
    this.medicines = [];
    this.selectedAdmissionId = null;
    this.selectedItem = null;
    
    // Bind methods
    this.init = this.init.bind(this);
    this.setupEventListeners = this.setupEventListeners.bind(this);
    this.loadAdmissions = this.loadAdmissions.bind(this);
    this.loadBillingCategories = this.loadBillingCategories.bind(this);
    this.loadRooms = this.loadRooms.bind(this);
    this.loadLabTests = this.loadLabTests.bind(this);
    this.loadMedicines = this.loadMedicines.bind(this);
    this.loadBillings = this.loadBillings.bind(this);
    this.loadBillingSummary = this.loadBillingSummary.bind(this);
    this.renderBillingsTable = this.renderBillingsTable.bind(this);
    this.renderBillingSummary = this.renderBillingSummary.bind(this);
    this.openModal = this.openModal.bind(this);
    this.saveBilling = this.saveBilling.bind(this);
    this.deleteBilling = this.deleteBilling.bind(this);
    this.updateTotalAmount = this.updateTotalAmount.bind(this);
    this.onCategoryChange = this.onCategoryChange.bind(this);
    this.onItemChange = this.onItemChange.bind(this);
    this.calculateRoomTotal = this.calculateRoomTotal.bind(this);
    this.calculateLabTestTotal = this.calculateLabTestTotal.bind(this);
    this.calculateMedicineTotal = this.calculateMedicineTotal.bind(this);
    this.formatCurrency = this.formatCurrency.bind(this);
    
    this.init();
  }

  init() {
    this.loadAdmissions();
    this.loadBillingCategories();
    this.loadRooms();
    this.loadLabTests();
    this.loadMedicines();
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Admission selection change
    document.getElementById('admissionSelect').addEventListener('change', (e) => {
      this.selectedAdmissionId = e.target.value;
      if (this.selectedAdmissionId) {
        this.loadBillings();
        this.loadBillingSummary();
        this.displayPatientInfo();
      } else {
        this.billings = [];
        this.renderBillingsTable();
        this.renderBillingSummary([]);
        document.getElementById('patientInfo').innerHTML = '';
      }
    });

    // Add billing button
    document.getElementById('addBillingBtn').addEventListener('click', () => {
      if (!this.selectedAdmissionId) {
        this.showAlert('Please select an admission first', 'warning');
        return;
      }
      this.openModal('add');
    });

    // Save billing button
    document.getElementById('saveBillingBtn').addEventListener('click', this.saveBilling);

    // Confirm delete button
    document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
      const billingId = document.getElementById('deleteItemId').value;
      if (billingId) {
        this.deleteBilling(billingId);
      }
    });

    // Billing category change
    document.getElementById('billingCategory').addEventListener('change', this.onCategoryChange);

    // Item selection change
    document.getElementById('itemSelect').addEventListener('change', this.onItemChange);

    // Room days change
    document.getElementById('roomDays')?.addEventListener('input', this.calculateRoomTotal);

    // Medicine quantity change
    document.getElementById('medicineQuantity')?.addEventListener('input', this.calculateMedicineTotal);

    // Generic quantity and unit price changes
    document.getElementById('quantity')?.addEventListener('input', this.updateTotalAmount);
    document.getElementById('unitPrice')?.addEventListener('input', this.updateTotalAmount);

    // Table actions (edit/delete)
    document.getElementById('billingTableBody').addEventListener('click', (e) => {
      const target = e.target.closest('button');
      if (!target) return;

      const action = target.getAttribute('data-action');
      const id = target.getAttribute('data-id');

      if (!action || !id) return;

      if (action === 'edit') {
        this.openModal('edit', id);
      } else if (action === 'delete') {
        document.getElementById('deleteItemId').value = id;
        const deleteModal = new bootstrap.Modal(document.getElementById('deleteModal'));
        deleteModal.show();
      }
    });
  }

  async loadAdmissions() {
    try {
      const res = await axios.get(this.admissionApiUrl, {
        params: { operation: 'getAllAdmissions' }
      });
      
      if (res.data.error) throw new Error(res.data.error);
      
      this.admissions = Array.isArray(res.data) ? res.data : [];
      const selectEl = document.getElementById('admissionSelect');
      
      if (this.admissions.length === 0) {
        selectEl.innerHTML = '<option value="">No admissions found</option>';
        return;
      }
      
      selectEl.innerHTML = '<option value="">-- Select Admission --</option>' + 
        this.admissions.map(a => `
          <option value="${a.admissionid}">
            #${a.admissionid} - ${a.patient_name} (${new Date(a.admission_date).toLocaleDateString()})
          </option>
        `).join('');
    } catch (err) {
      console.error('Error loading admissions:', err);
      this.showAlert('Failed to load admissions. Please try again.', 'danger');
    }
  }

  async loadBillingCategories() {
    try {
      const res = await axios.get(this.billingCategoryApiUrl, {
        params: { operation: 'getAllBillingCategories' }
      });
      
      if (res.data.error) throw new Error(res.data.error);
      
      this.billingCategories = Array.isArray(res.data) ? res.data : [];
    } catch (err) {
      console.error('Error loading billing categories:', err);
      this.showAlert('Failed to load billing categories. Please try again.', 'danger');
    }
  }

  async loadRooms() {
    try {
      const res = await axios.get(this.roomApiUrl, {
        params: { operation: 'getAllRooms' }
      });
      
      if (res.data.error) throw new Error(res.data.error);
      
      this.rooms = Array.isArray(res.data) ? res.data : [];
    } catch (err) {
      console.error('Error loading rooms:', err);
      this.rooms = [];
    }
  }

  async loadLabTests() {
    try {
      const res = await axios.get(this.labTestApiUrl, {
        params: { operation: 'getAllLabTests' }
      });
      
      if (res.data.error) throw new Error(res.data.error);
      
      this.labTests = Array.isArray(res.data) ? res.data : [];
    } catch (err) {
      console.error('Error loading lab tests:', err);
      this.labTests = [];
    }
  }

  async loadMedicines() {
    try {
      const res = await axios.get(this.medicineApiUrl, {
        params: { operation: 'getAllMedicines' }
      });
      
      if (res.data.error) throw new Error(res.data.error);
      
      this.medicines = Array.isArray(res.data) ? res.data : [];
    } catch (err) {
      console.error('Error loading medicines:', err);
      this.medicines = [];
    }
  }

  async loadBillings() {
    if (!this.selectedAdmissionId) return;
    
    try {
      const res = await axios.get(this.baseApiUrl, {
        params: { 
          operation: 'getAllBillings',
          admissionid: this.selectedAdmissionId 
        }
      });
      
      if (res.data.error) throw new Error(res.data.error);
      
      this.billings = Array.isArray(res.data) ? res.data : [];
      this.renderBillingsTable();
    } catch (err) {
      console.error('Error loading billings:', err);
      this.showAlert('Failed to load billing records. Please try again.', 'danger');
      this.billings = [];
      this.renderBillingsTable();
    }
  }

  async loadBillingSummary() {
    if (!this.selectedAdmissionId) return;
    
    try {
      // Get billing summary by category
      const summaryRes = await axios.get(this.baseApiUrl, {
        params: { 
          operation: 'getBillingsByCategory',
          admissionid: this.selectedAdmissionId 
        }
      });
      
      if (summaryRes.data.error) throw new Error(summaryRes.data.error);
      
      const summaryData = summaryRes.data.data || [];
      this.renderBillingSummary(summaryData);
      
      // Get total billing amount
      const totalRes = await axios.get(this.baseApiUrl, {
        params: { 
          operation: 'getTotalBilling',
          admissionid: this.selectedAdmissionId 
        }
      });
      
      if (totalRes.data.error) throw new Error(totalRes.data.error);
      
      const totalAmount = totalRes.data.total_amount || 0;
      document.getElementById('grandTotal').textContent = `Total: ₱${this.formatCurrency(totalAmount)}`;
    } catch (err) {
      console.error('Error loading billing summary:', err);
      this.renderBillingSummary([]);
      document.getElementById('grandTotal').textContent = 'Total: ₱0.00';
    }
  }

  onCategoryChange() {
    const categoryId = document.getElementById('billingCategory').value;
    const itemContainer = document.getElementById('itemSelectionContainer');
    const itemSelect = document.getElementById('itemSelect');
    
    // Hide all field groups
    this.hideAllFieldGroups();
    
    if (!categoryId) {
      itemContainer.style.display = 'none';
      return;
    }
    
    // Show item selection
    itemContainer.style.display = 'block';
    itemSelect.innerHTML = '<option value="">-- Select Item --</option>';
    
    // Populate items based on category
    const category = this.billingCategories.find(c => c.billing_categoryid == categoryId);
    if (!category) return;
    
    switch (category.name.toLowerCase()) {
      case 'room':
        this.populateRoomOptions();
        break;
      case 'laboratory':
        this.populateLabTestOptions();
        break;
      case 'medicine':
        this.populateMedicineOptions();
        break;
      default:
        // For other categories, hide item selection and show generic fields
        itemContainer.style.display = 'none';
        document.getElementById('genericFields').style.display = 'block';
        break;
    }
  }

  onItemChange() {
    const itemId = document.getElementById('itemSelect').value;
    const categoryId = document.getElementById('billingCategory').value;
    
    if (!itemId || !categoryId) return;
    
    const category = this.billingCategories.find(c => c.billing_categoryid == categoryId);
    if (!category) return;
    
    switch (category.name.toLowerCase()) {
      case 'room':
        this.selectRoom(itemId);
        break;
      case 'laboratory':
        this.selectLabTest(itemId);
        break;
      case 'medicine':
        this.selectMedicine(itemId);
        break;
    }
  }

  populateRoomOptions() {
    const itemSelect = document.getElementById('itemSelect');
    const availableRooms = this.rooms.filter(r => r.status === 'Available');
    
    if (availableRooms.length === 0) {
      itemSelect.innerHTML = '<option value="">No available rooms</option>';
      return;
    }
    
    itemSelect.innerHTML = '<option value="">-- Select Room --</option>' + 
      availableRooms.map(r => {
        const category = this.getRoomCategory(r.categoryid);
        return `<option value="${r.room_no}" data-category="${r.categoryid}">
          ${r.room_no} - ${category?.name || 'Unknown'} (₱${this.formatCurrency(category?.rate_per_day || 0)}/day)
        </option>`;
      }).join('');
  }

  populateLabTestOptions() {
    const itemSelect = document.getElementById('itemSelect');
    
    if (this.labTests.length === 0) {
      itemSelect.innerHTML = '<option value="">No lab tests available</option>';
      return;
    }
    
    itemSelect.innerHTML = '<option value="">-- Select Lab Test --</option>' + 
      this.labTests.map(lt => {
        const category = this.getLabTestCategory(lt.categoryid);
        return `<option value="${lt.testid}" data-category="${lt.categoryid}">
          ${lt.name} - ₱${this.formatCurrency(lt.price)} + ₱${this.formatCurrency(category?.handling_fee || 0)} handling
        </option>`;
      }).join('');
  }

  populateMedicineOptions() {
    const itemSelect = document.getElementById('itemSelect');
    const activeMedicines = this.medicines.filter(m => !m.is_deleted);
    
    if (activeMedicines.length === 0) {
      itemSelect.innerHTML = '<option value="">No medicines available</option>';
      return;
    }
    
    itemSelect.innerHTML = '<option value="">-- Select Medicine --</option>' + 
      activeMedicines.map(m => `
        <option value="${m.medicineid}">
          ${m.brand_name || m.name} - ₱${this.formatCurrency(m.price)} per unit
        </option>`).join('');
  }

  selectRoom(roomNo) {
    const room = this.rooms.find(r => r.room_no === roomNo);
    if (!room) return;
    
    const category = this.getRoomCategory(room.categoryid);
    
    // Populate room fields
    document.getElementById('roomNo').value = room.room_no;
    document.getElementById('roomRate').value = this.formatCurrency(category?.rate_per_day || 0);
    document.getElementById('roomDays').value = 1;
    
    // Show room fields and hide others
    this.hideAllFieldGroups();
    document.getElementById('roomFields').style.display = 'block';
    
    // Calculate initial total
    this.calculateRoomTotal();
  }

  selectLabTest(testId) {
    const labTest = this.labTests.find(lt => lt.testid == testId);
    if (!labTest) return;
    
    const category = this.getLabTestCategory(labTest.categoryid);
    
    // Populate lab test fields
    document.getElementById('labTestName').value = labTest.name;
    document.getElementById('labTestPrice').value = this.formatCurrency(labTest.price);
    document.getElementById('labHandlingFee').value = this.formatCurrency(category?.handling_fee || 0);
    
    // Show lab test fields and hide others
    this.hideAllFieldGroups();
    document.getElementById('labTestFields').style.display = 'block';
    
    // Calculate initial total
    this.calculateLabTestTotal();
  }

  selectMedicine(medicineId) {
    const medicine = this.medicines.find(m => m.medicineid == medicineId);
    if (!medicine) return;
    
    // Populate medicine fields
    document.getElementById('medicineName').value = medicine.brand_name || medicine.name;
    document.getElementById('medicinePrice').value = this.formatCurrency(medicine.price);
    document.getElementById('medicineQuantity').value = 1;
    
    // Show medicine fields and hide others
    this.hideAllFieldGroups();
    document.getElementById('medicineFields').style.display = 'block';
    
    // Calculate initial total
    this.calculateMedicineTotal();
  }

  hideAllFieldGroups() {
    document.getElementById('roomFields').style.display = 'none';
    document.getElementById('labTestFields').style.display = 'none';
    document.getElementById('medicineFields').style.display = 'none';
    document.getElementById('genericFields').style.display = 'none';
  }

  calculateRoomTotal() {
    const days = parseInt(document.getElementById('roomDays').value) || 0;
    const rate = parseFloat(document.getElementById('roomRate').value.replace(/[₱,]/g, '')) || 0;
    const total = days * rate;
    
    document.getElementById('roomTotal').value = this.formatCurrency(total);
    document.getElementById('totalAmount').value = this.formatCurrency(total);
  }

  calculateLabTestTotal() {
    const testPrice = parseFloat(document.getElementById('labTestPrice').value.replace(/[₱,]/g, '')) || 0;
    const handlingFee = parseFloat(document.getElementById('labHandlingFee').value.replace(/[₱,]/g, '')) || 0;
    const total = testPrice + handlingFee;
    
    document.getElementById('labTestTotal').value = this.formatCurrency(total);
    document.getElementById('totalAmount').value = this.formatCurrency(total);
  }

  calculateMedicineTotal() {
    const quantity = parseInt(document.getElementById('medicineQuantity').value) || 0;
    const price = parseFloat(document.getElementById('medicinePrice').value.replace(/[₱,]/g, '')) || 0;
    const total = quantity * price;
    
    document.getElementById('medicineTotal').value = this.formatCurrency(total);
    document.getElementById('totalAmount').value = this.formatCurrency(total);
  }

  getRoomCategory(categoryId) {
    // This would need to be loaded from the API or stored in the class
    // For now, we'll use a simple mapping
    const roomCategories = {
      1: { name: 'Ward', rate_per_day: 500.00 },
      2: { name: 'Semi-Private Room', rate_per_day: 1200.00 },
      3: { name: 'Private Room', rate_per_day: 2500.00 },
      4: { name: 'ICU', rate_per_day: 5000.00 },
      5: { name: 'Deluxe Suite', rate_per_day: 7000.00 }
    };
    return roomCategories[categoryId] || null;
  }

  getLabTestCategory(categoryId) {
    // This would need to be loaded from the API or stored in the class
    // For now, we'll use a simple mapping
    const labCategories = {
      2: { name: 'Hematology', handling_fee: 50.00 },
      3: { name: 'Chemistry', handling_fee: 75.00 },
      4: { name: 'Immunology', handling_fee: 100.00 },
      5: { name: 'Microbiology', handling_fee: 120.00 },
      6: { name: 'Imaging', handling_fee: 200.00 }
    };
    return labCategories[categoryId] || null;
  }

  renderBillingsTable() {
    const tbody = document.getElementById('billingTableBody');
    if (!tbody) return;

    if (!this.billings.length) {
      tbody.innerHTML = `
        <tr><td colspan="8" class="text-center text-muted py-3">
          <i class="bi bi-inbox me-2"></i>No billing records found
        </td></tr>`;
      return;
    }

    tbody.innerHTML = this.billings.map(b => `
      <tr class="fade-row">
        <td>${b.billingid}</td>
        <td>${b.category_name}</td>
        <td>${b.description || '-'}</td>
        <td>${b.quantity}</td>
        <td class="text-end">₱${this.formatCurrency(b.unit_price)}</td>
        <td class="text-end">₱${this.formatCurrency(b.total_amount)}</td>
        <td>${new Date(b.billing_date).toLocaleDateString()}</td>
        <td>
          <div style="display:flex; gap:8px; flex-wrap:nowrap;">
            <button title="Edit" class="btn btn-sm btn-warning" data-id="${b.billingid}" data-action="edit">
              <i class="bi bi-pencil"></i>
            </button>
            <button title="Delete" class="btn btn-sm btn-danger" data-id="${b.billingid}" data-action="delete">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>`).join('');
  }

  renderBillingSummary(summaryData) {
    const tbody = document.getElementById('billingSummaryTableBody');
    if (!tbody) return;

    if (!summaryData || !summaryData.length) {
      tbody.innerHTML = `
        <tr><td colspan="2" class="text-center text-muted py-3">
          <i class="bi bi-inbox me-2"></i>No billing data available
        </td></tr>`;
      return;
    }

    tbody.innerHTML = summaryData.map(item => `
      <tr>
        <td>${item.category_name}</td>
        <td class="text-end">₱${this.formatCurrency(item.total_amount)}</td>
      </tr>`).join('');
  }

  displayPatientInfo() {
    if (!this.selectedAdmissionId) {
      document.getElementById('patientInfo').innerHTML = '';
      return;
    }
    
    const admission = this.admissions.find(a => a.admissionid == this.selectedAdmissionId);
    if (!admission) return;
    
    document.getElementById('patientInfo').innerHTML = `
      <strong>Patient:</strong> ${admission.patient_name}<br>
      <strong>Admission Date:</strong> ${new Date(admission.admission_date).toLocaleDateString()}<br>
      <strong>Status:</strong> <span class="badge ${admission.status === 'Admitted' ? 'bg-success' : 'bg-secondary'}">${admission.status}</span>
    `;
  }

  openModal(mode, billingId = null) {
    const modalTitle = document.getElementById('billingModalLabel');
    const billingForm = document.getElementById('billingForm');
    const billingIdInput = document.getElementById('billingId');
    const modalAdmissionIdInput = document.getElementById('modalAdmissionId');
    const categorySelect = document.getElementById('billingCategory');
    const saveBtn = document.getElementById('saveBillingBtn');
    
    // Reset form and hide all field groups
    billingForm.reset();
    billingForm.classList.remove('was-validated');
    this.hideAllFieldGroups();
    document.getElementById('genericFields').style.display = 'block';
    document.getElementById('itemSelectionContainer').style.display = 'none';
    
    // Set admission ID
    modalAdmissionIdInput.value = this.selectedAdmissionId;
    
    // Populate billing categories
    categorySelect.innerHTML = '<option value="">-- Select Category --</option>' + 
      this.billingCategories.map(c => `
        <option value="${c.billing_categoryid}">${c.name}</option>
      `).join('');
    
    if (mode === 'edit' && billingId) {
      // Edit mode
      modalTitle.textContent = 'Edit Billing';
      saveBtn.textContent = 'Update';
      billingIdInput.value = billingId;
      
      // Update modal header color for edit mode
      const modalHeader = document.querySelector('#billingModal .modal-header');
      modalHeader.className = 'modal-header bg-warning text-white';
      
      // Find the billing record
      const billing = this.billings.find(b => b.billingid == billingId);
      if (billing) {
        categorySelect.value = billing.billing_categoryid;
        this.onCategoryChange(); // Trigger category change to show appropriate fields
        
        // Populate fields based on category
        const category = this.billingCategories.find(c => c.billing_categoryid == billing.billing_categoryid);
        if (category) {
          switch (category.name.toLowerCase()) {
            case 'room':
              // For rooms, we'd need to reconstruct the room data
              document.getElementById('description').value = billing.description || '';
              document.getElementById('quantity').value = billing.quantity;
              document.getElementById('unitPrice').value = billing.unit_price;
              break;
            case 'laboratory':
              // For lab tests, we'd need to reconstruct the lab test data
              document.getElementById('description').value = billing.description || '';
              document.getElementById('quantity').value = billing.quantity;
              document.getElementById('unitPrice').value = billing.unit_price;
              break;
            case 'medicine':
              // For medicines, we'd need to reconstruct the medicine data
              document.getElementById('description').value = billing.description || '';
              document.getElementById('quantity').value = billing.quantity;
              document.getElementById('unitPrice').value = billing.unit_price;
              break;
            default:
              document.getElementById('description').value = billing.description || '';
              document.getElementById('quantity').value = billing.quantity;
              document.getElementById('unitPrice').value = billing.unit_price;
              break;
          }
        }
        
        this.updateTotalAmount();
      }
    } else {
      // Add mode
      modalTitle.textContent = 'Add Billing';
      saveBtn.textContent = 'Save';
      billingIdInput.value = '';
      
      // Update modal header color for add mode
      const modalHeader = document.querySelector('#billingModal .modal-header');
      modalHeader.className = 'modal-header bg-primary text-white';
    }
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('billingModal'));
    modal.show();
  }

  updateTotalAmount() {
    const quantity = parseFloat(document.getElementById('quantity').value) || 0;
    const unitPrice = parseFloat(document.getElementById('unitPrice').value) || 0;
    const totalAmount = quantity * unitPrice;
    document.getElementById('totalAmount').value = this.formatCurrency(totalAmount);
  }

  async saveBilling() {
    const form = document.getElementById('billingForm');
    form.classList.add('was-validated');
    
    if (!form.checkValidity()) {
      return;
    }
    
    const billingId = document.getElementById('billingId').value;
    const admissionId = document.getElementById('modalAdmissionId').value;
    const categoryId = document.getElementById('billingCategory').value;
    const description = document.getElementById('description').value;
    const quantity = document.getElementById('quantity').value;
    const unitPrice = document.getElementById('unitPrice').value;
    
    // Get total amount from the total field
    const totalAmount = parseFloat(document.getElementById('totalAmount').value.replace(/[₱,]/g, '')) || 0;
    
    const payload = {
      billingid: billingId || undefined,
      admissionid: admissionId,
      billing_categoryid: categoryId,
      description: description,
      quantity: quantity,
      unit_price: unitPrice,
      total_amount: totalAmount
    };
    
    const saveBtn = document.getElementById('saveBillingBtn');
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';
    
    try {
      const operation = billingId ? 'updateBilling' : 'insertBilling';
      const res = await axios.post(this.baseApiUrl, {
        operation: operation,
        json: payload
      });
      
      if (res.data.error) throw new Error(res.data.error);
      
      // Close modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('billingModal'));
      modal.hide();
      
      // Reload data
      await this.loadBillings();
      await this.loadBillingSummary();
      
      // Show success message
      this.showAlert(billingId ? 'Billing updated successfully!' : 'Billing added successfully!', 'success');
    } catch (err) {
      console.error('Error saving billing:', err);
      this.showAlert(`Failed to save billing: ${err.message}`, 'danger');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = originalText;
    }
  }

  async deleteBilling(billingId) {
    try {
      const res = await axios.post(this.baseApiUrl, {
        operation: 'deleteBilling',
        billingid: billingId
      });
      
      if (res.data.error) throw new Error(res.data.error);
      
      // Close modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('deleteModal'));
      modal.hide();
      
      // Reload data
      await this.loadBillings();
      await this.loadBillingSummary();
      
      // Show success message
      this.showAlert('Billing deleted successfully!', 'success');
    } catch (err) {
      console.error('Error deleting billing:', err);
      this.showAlert(`Failed to delete billing: ${err.message}`, 'danger');
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

  formatCurrency(value) {
    return parseFloat(value || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
}

// Initialize the billing manager when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new BillingManager();
});