class RoomAssignmentManager {
  constructor() {
    this.apiUrl = "http://localhost/hospital_billing2/api/transactions/room_assignment.php";
    this.assignments = [];
    this.admissions = [];
    this.rooms = [];
    this.init();
  }

  async init() {
    try {
      await Promise.all([
        this.loadAssignments(),
        this.loadAdmissions(),
        this.loadRooms(),
      ]);
      this.setupEventListeners();
    } catch (e) {
      console.error("Initialization failed:", e);
    }
  }

  setupEventListeners() {
    const addBtn = document.getElementById("addAssignmentBtn");
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        const form = document.getElementById("assignmentForm");
        form.reset();
        form.classList.remove("was-validated");
        document.getElementById("assignmentId").value = "";
        new bootstrap.Modal(document.getElementById("assignmentModal")).show();
      });
    }

    const form = document.getElementById("assignmentForm");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.saveAssignment();
      });
    }

    const tbody = document.getElementById("assignmentTableBody");
    if (tbody) {
      tbody.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;

        const id = btn.getAttribute("data-id");
        const action = btn.getAttribute("data-action");
        if (!id || !action) return;

        if (action === "edit") {
          this.editAssignment(Number(id));
        } else if (action === "delete") {
          this.deleteAssignment(Number(id));
        } else if (action === "view") {
          this.viewAssignment(Number(id));
        }
      });
    }
  }

  async loadAssignments() {
    try {
      const res = await axios.get(this.apiUrl);
      this.assignments = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      this.renderTable();
    } catch (err) {
      console.error("Failed to load assignments:", err);
      this.assignments = [];
      this.renderTable();
    }
  }

  async loadAdmissions() {
    try {
      const res = await axios.get("http://localhost/hospital_billing2/api/transactions/admission.php", {
        params: { operation: "getAllAdmissions" },
      });
      this.admissions = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      const admissionSelect = document.getElementById("admissionSelect");
      if (admissionSelect) {
        admissionSelect.innerHTML =
          `<option value="">-- Select Admission --</option>` +
          this.admissions
            .map(
              (a) =>
                `<option value="${this.escape(a.admissionid)}">#${this.escape(a.admissionid)} - ${this.escape(a.patient_name)}</option>`
            )
            .join("");
      }
    } catch (err) {
      console.error("Failed to load admissions:", err);
    }
  }

  async loadRooms() {
    try {
      const res = await axios.get("http://localhost/hospital_billing2/api/rooms.php", {
        params: { operation: "getAllRooms" },
      });
      this.rooms = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      const roomSelect = document.getElementById("roomSelect");
      if (roomSelect) {
        // Disable occupied rooms in select
        roomSelect.innerHTML =
          `<option value="">-- Select Room --</option>` +
          this.rooms
            .map((r) => {
              const disabled = String(r.status).toLowerCase() === "occupied" ? "disabled" : "";
              const note = String(r.status).toLowerCase() === "occupied" ? " — Occupied" : "";
              return `<option value="${this.escape(r.room_no)}" ${disabled}>${this.escape(r.room_no)} - ${this.escape(r.category_name)} (${this.escape(r.floor_name)})${this.escape(note)}</option>`;
            })
            .join("");
      }
    } catch (err) {
      console.error("Failed to load rooms:", err);
    }
  }

  renderTable() {
    const tbody = document.getElementById("assignmentTableBody");
    if (!tbody) return;

    if (!this.assignments.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No assignments found.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.assignments
      .map(
        (a) => `
      <tr>
        <td><strong>${this.escape(a.patient_name || "Unknown")}</strong></td>
        <td><strong>${this.escape(a.room_no)}</strong> (${this.escape(a.category_name || "Unknown")})</td>
        <td>${this.escape(a.start_date || "")}</td>
    
        <td>
          <div class="d-flex gap-2 flex-nowrap">
            <button class="btn btn-sm btn-info" title="View Assignment" data-id="${this.escape(a.assignmentid)}" data-action="view">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-sm btn-warning" title="Edit Assignment" data-id="${this.escape(a.assignmentid)}" data-action="edit">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-danger" title="Delete Assignment" data-id="${this.escape(a.assignmentid)}" data-action="delete" data-room="${this.escape(a.room_no)}">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `
      )
      .join("");
  }

  async saveAssignment() {
    const form = document.getElementById("assignmentForm");
    if (!form.checkValidity()) {
      form.classList.add("was-validated");
      return;
    }

    const assignmentId = document.getElementById("assignmentId").value;
    const startDateInput = document.getElementById("assignedDate").value;
    const startDate = startDateInput ? `${startDateInput} 00:00:00` : null;

    const data = {
      assignmentid: assignmentId || null,
      admissionid: document.getElementById("admissionSelect").value,
      room_no: document.getElementById("roomSelect").value,
      start_date: startDate,
    };

    if (!data.admissionid || !data.room_no) {
      alert("Please select both admission and room.");
      return;
    }

    try {
      if (assignmentId) {
        await axios.put(this.apiUrl, data, { headers: { "Content-Type": "application/json" } });
      } else {
        await axios.post(this.apiUrl, data, { headers: { "Content-Type": "application/json" } });
      }

      const modalEl = document.getElementById("assignmentModal");
      const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
      modal.hide();

      form.classList.remove("was-validated");
      form.reset();
      await Promise.all([this.loadAssignments(), this.loadRooms()]);
    } catch (err) {
      console.error("Save failed:", err?.response?.data || err.message);
      const serverMsg = err?.response?.data?.error || err?.response?.data || err.message;
      alert("Error saving assignment: " + JSON.stringify(serverMsg));
    }
  }

  editAssignment(id) {
    const assignment = this.assignments.find((a) => a.assignmentid == id);
    if (!assignment) return;

    const form = document.getElementById("assignmentForm");
    form.classList.remove("was-validated");

    document.getElementById("assignmentId").value = assignment.assignmentid;
    document.getElementById("admissionSelect").value = assignment.admissionid;
    document.getElementById("roomSelect").value = assignment.room_no;

    const dateValue = assignment.start_date ? String(assignment.start_date).split(" ")[0] : "";
    document.getElementById("assignedDate").value = dateValue;

    new bootstrap.Modal(document.getElementById("assignmentModal")).show();
  }

  async deleteAssignment(id) {
    if (!confirm("Are you sure you want to delete this assignment?")) return;

    try {
      // find room_no for this assignment to pass? our API only needs assignmentid
      await axios.delete(this.apiUrl, {
        data: { assignmentid: id },
        headers: { "Content-Type": "application/json" },
      });

      await Promise.all([this.loadAssignments(), this.loadRooms()]);
    } catch (err) {
      console.error("Delete failed:", err?.response?.data || err.message);
      const serverMsg = err?.response?.data?.error || err?.response?.data || err.message;
      alert("Error deleting assignment: " + JSON.stringify(serverMsg));
    }
  }

  viewAssignment(id) {
    const assignment = this.assignments.find((a) => a.assignmentid == id);
    if (!assignment) return;

    const details = `
      <div class="p-2">
        <h5>Assignment #${this.escape(assignment.assignmentid)}</h5>
        <p><strong>Patient:</strong> ${this.escape(assignment.patient_name)}</p>
        <p><strong>Admission ID:</strong> #${this.escape(assignment.admissionid)}</p>
        <p><strong>Room:</strong> ${this.escape(assignment.room_no)} (${this.escape(assignment.category_name || "Unknown")})</p>
        <p><strong>Floor:</strong> ${this.escape(assignment.floor_name || "N/A")}</p>
        <p><strong>Start Date:</strong> ${this.escape(assignment.start_date || "N/A")}</p>
        <p><strong>Room Status:</strong> ${this.escape(assignment.room_status || "N/A")}</p>
      </div>
    `;

    const modalEl = document.getElementById("viewModal");
    if (modalEl) {
      modalEl.querySelector(".modal-body").innerHTML = details;
      new bootstrap.Modal(modalEl).show();
    } else {
      alert(details.replace(/<[^>]+>/g, ""));
    }
  }

  escape(text) {
    if (text === null || typeof text === 'undefined') return "";
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

document.addEventListener("DOMContentLoaded", () => new RoomAssignmentManager());
