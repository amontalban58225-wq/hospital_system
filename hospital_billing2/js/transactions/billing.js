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
  
  async loadRelatedItems(categoryType) {
    if (!this.selectedAdmissionId) return;
    
    try {
      let data = [];
      
      switch(categoryType) {
        case 'room':
          // Get room assignment for this admission
          const roomRes = await axios.get(this.baseApiUrl, {
            params: { 
              operation: 'getRoomAssignment',
              admission_id: this.selectedAdmissionId 
            }
          });
          
          if (roomRes.data && !roomRes.data.error) {
            data = Array.isArray(roomRes.data) ? roomRes.data : [roomRes.data];
            this.displayRoomAssignmentData(data);
          }
          break;
          
        case 'laboratory':
          // Get lab tests for this admission
          const labRes = await axios.get(this.baseApiUrl, {
            params: { 
              operation: 'getLabTests',
              admission_id: this.selectedAdmissionId 
            }
          });
          
          if (labRes.data && !labRes.data.error) {
            data = Array.isArray(labRes.data) ? labRes.data : [];
            this.displayLabTestData(data);
          }
          break;
          
        case 'medicine':
          // Get medicines for this admission
          const medRes = await axios.get(this.baseApiUrl, {
            params: { 
              operation: 'getMedicines',
              admission_id: this.selectedAdmissionId 
            }
          });
          
          if (medRes.data && !medRes.data.error) {
            data = Array.isArray(medRes.data) ? medRes.data : [];
            this.displayMedicineData(data);
          }
          break;
      }
    } catch (err) {
      console.error(`Error loading ${categoryType} data:`, err);
      this.showAlert(`Failed to load ${categoryType} data. Please try again.`, 'danger');
    }
  }
  
  displayRoomAssignmentData(roomAssignments) {
    if (!roomAssignments || roomAssignments.length === 0) {
      this.showAlert('No room assignments found for this admission', 'info');
      return;
    }
    
    // Get the most recent room assignment
    const roomAssignment = roomAssignments[0];
    const room = this.rooms.find(r => r.room_no === roomAssignment.room_no);
    if (!room) return;
    
    const category = this.getRoomCategory(room.categoryid);
    const ratePerDay = category?.rate_per_day || 0;
    const daysOccupied = roomAssignment.days_occupied || 1;
    
    // Auto-select the room in the dropdown
    const itemSelect = document.getElementById('itemSelect');
    if (itemSelect) {
      itemSelect.value = room.room_no;
      this.selectRoom(room.room_no);
    }
    
    // Update room fields
    document.getElementById('roomDays').value = daysOccupied;
    document.getElementById('roomRate').value = this.formatCurrency(ratePerDay);
    
    // Calculate and display total
    this.calculateRoomTotal();
  }
  
  displayLabTestData(labTests) {
    if (!labTests || labTests.length === 0) {
      this.showAlert('No lab tests found for this admission', 'info');
      return;
    }
    
    // Create a table to display lab tests
    const container = document.createElement('div');
    container.className = 'mt-3';
    container.innerHTML = `
      <h5>Available Lab Tests for Billing</h5>
      <table class="table table-sm table-bordered">
        <thead>
          <tr>
            <th>Test Name</th>
            <th>Date</th>
            <th>Status</th>
            <th>Price</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${labTests.map(test => {
            const labTest = this.labTests.find(lt => lt.testid == test.testid);
            const category = this.getLabTestCategory(labTest?.categoryid);
            const price = (labTest?.price || 0) + (category?.handling_fee || 0);
            return `
              <tr>
                <td>${labTest?.name || 'Unknown'}</td>
                <td>${new Date(test.request_date).toLocaleDateString()}</td>
                <td>${test.status}</td>
                <td>₱${this.formatCurrency(price)}</td>
                <td>
                  <button class="btn btn-sm btn-primary select-lab-test" 
                    data-test-id="${labTest?.testid}" 
                    data-price="${price}">
                    Select
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
    
    // Add to the modal
    const labDataContainer = document.getElementById('labDataContainer');
    if (labDataContainer) {
      labDataContainer.innerHTML = '';
      labDataContainer.appendChild(container);
      
      // Add event listeners to select buttons
      labDataContainer.querySelectorAll('.select-lab-test').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const testId = e.target.getAttribute('data-test-id');
          const price = e.target.getAttribute('data-price');
          
          // Auto-select the lab test in the dropdown
          const itemSelect = document.getElementById('itemSelect');
          if (itemSelect) {
            itemSelect.value = testId;
            this.selectLabTest(testId);
          }
        });
      });
    }
  }
  
  displayMedicineData(medicines) {
    if (!medicines || medicines.length === 0) {
      this.showAlert('No medicines found for this admission', 'info');
      return;
    }
    
    // Create a table to display medicines
    const container = document.createElement('div');
    container.className = 'mt-3';
    container.innerHTML = `
      <h5>Available Medicines for Billing</h5>
      <table class="table table-sm table-bordered">
        <thead>
          <tr>
            <th>Medicine</th>
            <th>Quantity</th>
            <th>Unit Price</th>
            <th>Total</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${medicines.map(med => {
            const medicine = this.medicines.find(m => m.medicineid == med.medicineid);
            const unitPrice = medicine?.price || 0;
            const quantity = med.quantity || 1;
            const total = unitPrice * quantity;
            return `
              <tr>
                <td>${medicine?.brand_name || medicine?.name || 'Unknown'}</td>
                <td>${quantity}</td>
                <td>₱${this.formatCurrency(unitPrice)}</td>
                <td>₱${this.formatCurrency(total)}</td>
                <td>
                  <button class="btn btn-sm btn-primary select-medicine" 
                    data-medicine-id="${medicine?.medicineid}" 
                    data-quantity="${quantity}" 
                    data-price="${unitPrice}">
                    Select
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
    
    // Add to the modal
    const medicineDataContainer = document.getElementById('medicineDataContainer');
    if (medicineDataContainer) {
      medicineDataContainer.innerHTML = '';
      medicineDataContainer.appendChild(container);
      
      // Add event listeners to select buttons
      medicineDataContainer.querySelectorAll('.select-medicine').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const medicineId = e.target.getAttribute('data-medicine-id');
          const quantity = e.target.getAttribute('data-quantity');
          const price = e.target.getAttribute('data-price');
          
          // Auto-select the medicine in the dropdown
          const itemSelect = document.getElementById('itemSelect');
          if (itemSelect) {
            itemSelect.value = medicineId;
            this.selectMedicine(medicineId);
            
            // Set the quantity
            document.getElementById('medicineQuantity').value = quantity;
            this.calculateMedicineTotal();
          }
        });
      });
    }
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

    // Generate automatic billing button
    document.getElementById('generateAutoBillingBtn').addEventListener('click', () => {
      if (!this.selectedAdmissionId) {
        this.showAlert('Please select an admission first', 'warning');
        return;
      }
      this.generateAutomaticBilling();
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
        params: { operation: 'getAllCategories' }
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
      this.updateDashboardMetrics();
    } catch (err) {
      console.error('Error loading billings:', err);
      this.showAlert('Failed to load billing records. Please try again.', 'danger');
      this.billings = [];
      this.renderBillingsTable();
      this.updateDashboardMetrics();
    }
  }
  
  updateDashboardMetrics() {
    // Get dashboard elements
    const totalBillingsCount = document.getElementById('totalBillingsCount');
    const autoBillingsCount = document.getElementById('autoBillingsCount');
    const manualBillingsCount = document.getElementById('manualBillingsCount');
    const dashboardGrandTotal = document.getElementById('dashboardGrandTotal');
    
    // If no billings or elements not found, reset to zero
    if (!this.billings || !this.billings.length) {
      if (totalBillingsCount) totalBillingsCount.textContent = '0';
      if (autoBillingsCount) autoBillingsCount.textContent = '0';
      if (manualBillingsCount) manualBillingsCount.textContent = '0';
      if (dashboardGrandTotal) dashboardGrandTotal.textContent = '₱0.00';
      return;
    }
    
    // Calculate metrics
    const total = this.billings.length;
    const auto = this.billings.filter(b => b.auto_calculated).length;
    const manual = total - auto;
    const grandTotal = this.billings.reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0);
    
    // Update the dashboard with animation
    if (totalBillingsCount) {
      this.animateCounter(totalBillingsCount, 0, total);
    }
    
    if (autoBillingsCount) {
      this.animateCounter(autoBillingsCount, 0, auto);
    }
    
    if (manualBillingsCount) {
      this.animateCounter(manualBillingsCount, 0, manual);
    }
    
    if (dashboardGrandTotal) {
      dashboardGrandTotal.textContent = `₱${this.formatCurrency(grandTotal)}`;
      dashboardGrandTotal.classList.add('pulse-animation');
      setTimeout(() => dashboardGrandTotal.classList.remove('pulse-animation'), 1000);
    }
  }
  
  animateCounter(element, start, end) {
    if (!element) return;
    
    // Ensure we're working with numbers
    start = parseInt(start) || 0;
    end = parseInt(end) || 0;
    
    // If start and end are the same, just set the value
    if (start === end) {
      element.textContent = end.toString();
      return;
    }
    
    // Calculate animation duration based on difference
    const duration = Math.min(1000, Math.max(500, Math.abs(end - start) * 100));
    const startTime = performance.now();
    
    // Animation function
    const updateCounter = (timestamp) => {
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smoother animation
      const easeOutQuad = progress * (2 - progress);
      
      // Calculate current value
      const value = Math.floor(start + (end - start) * easeOutQuad);
      element.textContent = value.toString();
      
      // Continue animation if not complete
      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      } else {
        element.textContent = end.toString();
      }
    };
    
    // Start animation
    requestAnimationFrame(updateCounter);
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
    
    // If admission is selected, load all related data for this category
    if (this.selectedAdmissionId) {
      this.loadRelatedItems(category.name.toLowerCase());
    }

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
        <tr><td colspan="9" class="text-center text-muted py-4">
          <div class="d-flex flex-column align-items-center">
            <i class="bi bi-receipt fs-1 mb-3 text-secondary"></i>
            <h5 class="text-secondary">No Billing Records</h5>
            <p class="text-muted">Select an admission or add new billing items</p>
          </div>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = this.billings.map(b => {
      // Determine status class and icon
      let statusClass = b.auto_calculated ? 'success' : 'secondary';
      let statusIcon = b.auto_calculated ? 'magic' : 'pencil-fill';
      let statusText = b.auto_calculated ? 'Auto' : 'Manual';
      
      // Format the date nicely
      const billingDate = new Date(b.billing_date);
      const formattedDate = billingDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      
      return `
      <tr class="align-middle ${b.auto_calculated ? 'table-success bg-opacity-10' : ''}">
        <td class="fw-bold text-primary">#${b.billingid}</td>
        <td>
          <span class="badge bg-info bg-opacity-75 text-dark">${b.category_name}</span>
        </td>
        <td>
          <div class="d-flex flex-column">
            <span class="fw-medium">${b.description || '-'}</span>
            ${b.reference_name ? `<small class="text-muted"><i class="bi bi-link-45deg"></i> ${b.reference_name}</small>` : ''}
          </div>
        </td>
        <td class="text-center fw-medium">${b.quantity}</td>
        <td class="text-end fw-medium">₱${this.formatCurrency(b.unit_price)}</td>
        <td class="text-end fw-bold">₱${this.formatCurrency(b.total_amount)}</td>
        <td>
          <div class="d-flex flex-column">
            <span>${formattedDate}</span>
            <small class="text-muted">${billingDate.toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})}</small>
          </div>
        </td>
        <td>
          <span class="badge bg-${statusClass} bg-opacity-75">
            <i class="bi bi-${statusIcon} me-1"></i>${statusText}
          </span>
        </td>
        <td>
          <div class="d-flex gap-2">
            <button title="Edit" class="btn btn-sm btn-outline-primary" data-id="${b.billingid}" data-action="edit">
              <i class="bi bi-pencil"></i>
            </button>
            <button title="Delete" class="btn btn-sm btn-outline-danger" data-id="${b.billingid}" data-action="delete">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  renderBillingSummary(summaryData) {
    const tbody = document.getElementById('billingSummaryTableBody');
    const grandTotalElement = document.getElementById('grandTotal');
    if (!tbody) return;

    if (!summaryData || !summaryData.length) {
      tbody.innerHTML = `
        <tr><td colspan="3" class="text-center text-muted py-3">
          <div class="d-flex flex-column align-items-center py-2">
            <i class="bi bi-calculator fs-2 mb-2 text-secondary"></i>
            <p class="mb-0">No billing data available</p>
          </div>
        </td></tr>`;
      
      // Update grand total
      if (grandTotalElement) {
        grandTotalElement.innerHTML = `<i class="bi bi-cash me-1"></i>Total: ₱0.00`;
      }
      return;
    }

    // Calculate grand total
    const grandTotal = summaryData.reduce((total, item) => total + parseFloat(item.total_amount || 0), 0);
    
    // Calculate percentages for each category
    const summaryWithPercentage = summaryData.map(item => {
      const percentage = (parseFloat(item.total_amount) / grandTotal * 100).toFixed(1);
      return {
        ...item,
        percentage
      };
    });

    // Sort by amount (highest first)
    summaryWithPercentage.sort((a, b) => parseFloat(b.total_amount) - parseFloat(a.total_amount));

    // Render the table rows with progress bars
    tbody.innerHTML = summaryWithPercentage.map(item => {
      // Determine category icon
      let categoryIcon = 'tag';
      switch(item.category_name.toLowerCase()) {
        case 'room': categoryIcon = 'house'; break;
        case 'laboratory': categoryIcon = 'clipboard2-pulse'; break;
        case 'medicine': categoryIcon = 'capsule'; break;
        case 'professional fee': categoryIcon = 'person-badge'; break;
        case 'supplies': categoryIcon = 'box-seam'; break;
      }
      
      return `
      <tr>
        <td>
          <div class="d-flex align-items-center">
            <i class="bi bi-${categoryIcon} me-2 text-primary"></i>
            <span class="fw-medium">${item.category_name}</span>
          </div>
          <div class="progress mt-1" style="height: 6px;">
            <div class="progress-bar bg-primary" role="progressbar" style="width: ${item.percentage}%" 
                 aria-valuenow="${item.percentage}" aria-valuemin="0" aria-valuemax="100"></div>
          </div>
        </td>
        <td class="text-end text-muted small">${item.percentage}%</td>
        <td class="text-end fw-bold">₱${this.formatCurrency(item.total_amount)}</td>
      </tr>`;
    }).join('');
    
    // Update grand total with animation
    if (grandTotalElement) {
      grandTotalElement.innerHTML = `<i class="bi bi-cash me-1"></i>Total: ₱${this.formatCurrency(grandTotal)}`;
      grandTotalElement.classList.add('pulse-animation');
      setTimeout(() => grandTotalElement.classList.remove('pulse-animation'), 1000);
    }
  }

  displayPatientInfo() {
    if (!this.selectedAdmissionId) {
      document.getElementById('patientInfo').innerHTML = '';
      return;
    }

    const admission = this.admissions.find(a => a.admissionid == this.selectedAdmissionId);
    if (!admission) return;
    
    // Calculate days admitted
    const admissionDate = new Date(admission.admission_date);
    const today = new Date();
    const daysAdmitted = Math.floor((today - admissionDate) / (1000 * 60 * 60 * 24));
    
    // Format admission date nicely
    const formattedDate = admissionDate.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    
    // Determine status badge color
    let statusBadgeClass = 'bg-secondary';
    if (admission.status === 'Admitted') statusBadgeClass = 'bg-success';
    if (admission.status === 'Discharged') statusBadgeClass = 'bg-info';
    if (admission.status === 'Cancelled') statusBadgeClass = 'bg-danger';

    document.getElementById('patientInfo').innerHTML = `
      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <div class="d-flex align-items-center mb-3">
            <div class="avatar-circle bg-primary bg-opacity-10 me-3">
              <i class="bi bi-person fs-3 text-primary"></i>
            </div>
            <div>
              <h5 class="mb-0">${admission.patient_name}</h5>
              <p class="text-muted mb-0">Patient ID: ${admission.patientid || 'N/A'}</p>
            </div>
            <span class="ms-auto badge ${statusBadgeClass} fs-6">
              <i class="bi bi-${admission.status === 'Admitted' ? 'hospital' : 'check-circle'} me-1"></i>
              ${admission.status}
            </span>
          </div>
          
          <div class="row g-3">
            <div class="col-md-6">
              <div class="d-flex align-items-center">
                <i class="bi bi-calendar-event text-primary me-2"></i>
                <div>
                  <small class="text-muted d-block">Admission Date</small>
                  <span>${formattedDate}</span>
                </div>
              </div>
            </div>
            <div class="col-md-6">
              <div class="d-flex align-items-center">
                <i class="bi bi-clock-history text-primary me-2"></i>
                <div>
                  <small class="text-muted d-block">Length of Stay</small>
                  <span>${daysAdmitted} day${daysAdmitted !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
            <div class="col-md-6">
              <div class="d-flex align-items-center">
                <i class="bi bi-clipboard-plus text-primary me-2"></i>
                <div>
                  <small class="text-muted d-block">Admission ID</small>
                  <span>#${admission.admissionid}</span>
                </div>
              </div>
            </div>
            <div class="col-md-6">
              <div class="d-flex align-items-center">
                <i class="bi bi-building text-primary me-2"></i>
                <div>
                  <small class="text-muted d-block">Room</small>
                  <span>${admission.room_no || 'Not Assigned'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  openModal(mode, billingId = null) {
    const modalTitle = document.getElementById('billingModalLabel');
    const billingForm = document.getElementById('billingForm');
    const billingIdInput = document.getElementById('billingId');
    const modalAdmissionIdInput = document.getElementById('modalAdmissionId');
    const categorySelect = document.getElementById('billingCategory');
    const saveBtn = document.getElementById('saveBillingBtn');
    const modalContent = document.querySelector('#billingModal .modal-content');

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

    // Add animation class to modal content
    modalContent.classList.add('animate__animated', 'animate__fadeIn');

    if (mode === 'edit' && billingId) {
      // Edit mode
      modalTitle.innerHTML = '<i class="bi bi-pencil-square me-2"></i>Edit Billing';
      saveBtn.textContent = 'Update';
      saveBtn.className = 'btn btn-warning';
      billingIdInput.value = billingId;

      // Update modal header color for edit mode
      const modalHeader = document.querySelector('#billingModal .modal-header');
      modalHeader.className = 'modal-header bg-warning text-white';

      // Add billing ID badge
      const idBadge = document.createElement('span');
      idBadge.className = 'badge bg-light text-dark ms-2';
      idBadge.textContent = `ID: ${billingId}`;
      modalTitle.appendChild(idBadge);

      // Find the billing record
      const billing = this.billings.find(b => b.billingid == billingId);
      if (billing) {
        categorySelect.value = billing.billing_categoryid;
        this.onCategoryChange(); // Trigger category change to show appropriate fields

        // Populate fields based on category
        const category = this.billingCategories.find(c => c.billing_categoryid == billing.billing_categoryid);
        if (category) {
          // Add category badge
          const categoryBadge = document.createElement('span');
          categoryBadge.className = 'badge bg-info ms-2';
          categoryBadge.textContent = category.name;
          modalTitle.appendChild(categoryBadge);
          
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
      modalTitle.innerHTML = '<i class="bi bi-plus-circle me-2"></i>Add New Billing';
      saveBtn.textContent = 'Save';
      saveBtn.className = 'btn btn-primary';
      billingIdInput.value = '';

      // Update modal header color for add mode
      const modalHeader = document.querySelector('#billingModal .modal-header');
      modalHeader.className = 'modal-header bg-primary text-white';
    }

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('billingModal'));
    modal.show();
    
    // Focus on the first input field after modal is shown
    modal._element.addEventListener('shown.bs.modal', () => {
      document.getElementById('description')?.focus();
    }, { once: true });
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
  
  async generateAutomaticBilling() {
    if (!this.selectedAdmissionId) {
      this.showAlert('Please select an admission first', 'warning');
      return;
    }
    
    const generateBtn = document.getElementById('generateAutoBillingBtn');
    const originalText = generateBtn.innerHTML;
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generating...';
    
    try {
      const res = await axios.post(this.baseApiUrl, {
        operation: 'generateAutomaticBilling',
        admissionid: this.selectedAdmissionId
      });
      
      if (res.data.success) {
        this.showAlert('Automatic billing generated successfully', 'success');
        // Reload billings to show the newly generated items
        this.loadBillings();
        this.loadBillingSummary();
      } else {
        throw new Error(res.data.error || 'Failed to generate automatic billing');
      }
    } catch (error) {
      console.error('Error generating automatic billing:', error);
      this.showAlert(`Error: ${error.message || 'Failed to generate automatic billing'}`, 'danger');
    } finally {
      generateBtn.disabled = false;
      generateBtn.innerHTML = originalText;
    }
  }
}

// Initialize the billing manager when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new BillingManager();
});
