<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

error_reporting(E_ALL);
ini_set('display_errors', 1);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

class PrescriptionAPI {
    private function connect() {
        include __DIR__ . "/../connection.php";
        return (new Database())->connect();
    }

    private function respond($data, $status = 200) {
        http_response_code($status);
        echo json_encode($data);
        exit;
    }
    
    private function validateInput($data, $requiredFields = []) {
        if (!is_array($data)) {
            $data = json_decode($data ?? "{}", true);
            if (!is_array($data)) {
                $this->respond(["success" => false, "error" => "Invalid data format"], 422);
            }
        }
        
        $missingFields = [];
        foreach ($requiredFields as $field) {
            if (empty($data[$field])) {
                $missingFields[] = $field;
            }
        }
        
        if (!empty($missingFields)) {
            $this->respond([
                "success" => false, 
                "error" => "Missing required fields: " . implode(", ", $missingFields)
            ], 422);
        }
        
        return $data;
    }

    function getAllPrescriptions() {
        try {
            $conn = $this->connect();
            $sql = "SELECT p.*, 
                           a.admissionid,
                           pt.fullname as patient_name,
                           m.brand_name as medicine_name,
                           d.fullname as doctor_name,
                           CASE 
                               WHEN p.status = 'Pending' THEN 'badge bg-warning'
                               WHEN p.status = 'Dispensed' THEN 'badge bg-success'
                               WHEN p.status = 'Canceled' THEN 'badge bg-danger'
                               ELSE 'badge bg-secondary'
                           END as status_class,
                           CASE 
                               WHEN p.status = 'Pending' THEN 'Pending'
                               WHEN p.status = 'Dispensed' THEN 'Dispensed'
                               WHEN p.status = 'Canceled' THEN 'Canceled'
                               ELSE p.status
                           END as status_label
                    FROM Prescription p
                    JOIN Admission a ON p.admissionid = a.admissionid
                    JOIN Patient pt ON a.patientid = pt.patientid
                    JOIN Medicine m ON p.medicineid = m.medicineid
                    JOIN Doctor d ON p.doctorid = d.doctorid
                    WHERE a.deleted_at IS NULL 
                      AND pt.deleted_at IS NULL 
                      AND m.is_deleted = 0 
                      AND d.deleted_at IS NULL
                    ORDER BY p.prescription_date DESC";
            
            $stmt = $conn->prepare($sql);
            $stmt->execute();
            $this->respond($stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
        } catch (Exception $e) {
            $this->respond(["error" => $e->getMessage()], 500);
        }
    }

    function getPrescriptionById($id) {
        try {
            if (empty($id)) $this->respond(["error" => "Prescription ID required"], 422);
            
            $conn = $this->connect();
            $stmt = $conn->prepare("SELECT p.*, 
                                          a.admissionid,
                                          pt.fullname as patient_name,
                                          m.brand_name as medicine_name,
                                          d.fullname as doctor_name
                                   FROM Prescription p
                                   JOIN Admission a ON p.admissionid = a.admissionid
                                   JOIN Patient pt ON a.patientid = pt.patientid
                                   JOIN Medicine m ON p.medicineid = m.medicineid
                                   JOIN Doctor d ON p.doctorid = d.doctorid
                                   WHERE p.prescriptionid = :id");
            $stmt->execute([":id" => $id]);
            
            $prescription = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$prescription) {
                $this->respond(["error" => "Prescription not found"], 404);
            }
            
            $this->respond($prescription);
        } catch (Exception $e) {
            $this->respond(["error" => $e->getMessage()], 500);
        }
    }

    function insertPrescription($data) {
        try {
            $data = $this->validateInput($data, ['admissionid', 'medicineid', 'doctorid', 'quantity']);
            
            $conn = $this->connect();
            
            // Validate admission exists and is active
            $stmt = $conn->prepare("SELECT a.admissionid, pt.fullname 
                                   FROM Admission a 
                                   JOIN Patient pt ON a.patientid = pt.patientid 
                                   WHERE a.admissionid = :admissionid AND a.status = 'Admitted'");
            $stmt->execute([":admissionid" => $data['admissionid']]);
            $admission = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$admission) {
                $this->respond(["success" => false, "error" => "Invalid or inactive admission"], 422);
            }
            
            // Validate medicine exists
            $stmt = $conn->prepare("SELECT medicineid FROM Medicine WHERE medicineid = :medicineid AND is_deleted = 0");
            $stmt->execute([":medicineid" => $data['medicineid']]);
            if (!$stmt->fetch()) {
                $this->respond(["success" => false, "error" => "Invalid medicine"], 422);
            }
            
            // Validate doctor exists
            $stmt = $conn->prepare("SELECT doctorid FROM Doctor WHERE doctorid = :doctorid AND deleted_at IS NULL");
            $stmt->execute([":doctorid" => $data['doctorid']]);
            if (!$stmt->fetch()) {
                $this->respond(["success" => false, "error" => "Invalid doctor"], 422);
            }
            
            $sql = "INSERT INTO Prescription (admissionid, medicineid, doctorid, quantity, status, prescription_date) 
                    VALUES (:admissionid, :medicineid, :doctorid, :quantity, :status, NOW())";
            
            $stmt = $conn->prepare($sql);
            $stmt->execute([
                ":admissionid" => $data['admissionid'],
                ":medicineid" => $data['medicineid'],
                ":doctorid" => $data['doctorid'],
                ":quantity" => $data['quantity'],
                ":status" => $data['status'] ?? 'Pending'
            ]);
            
            $this->respond([
                "success" => true, 
                "message" => "Prescription added successfully",
                "prescriptionid" => $conn->lastInsertId()
            ]);
        } catch (Exception $e) {
            $this->respond(["success" => false, "error" => $e->getMessage()], 500);
        }
    }

    function updatePrescription($data) {
        try {
            $data = $this->validateInput($data, ['prescriptionid', 'medicineid', 'doctorid', 'quantity', 'status']);
            
            $conn = $this->connect();
            
            // Check if prescription exists
            $stmt = $conn->prepare("SELECT prescriptionid FROM Prescription WHERE prescriptionid = :id");
            $stmt->execute([":id" => $data['prescriptionid']]);
            if (!$stmt->fetch()) {
                $this->respond(["success" => false, "error" => "Prescription not found"], 404);
            }
            
            // Validate medicine exists
            $stmt = $conn->prepare("SELECT medicineid FROM Medicine WHERE medicineid = :medicineid AND is_deleted = 0");
            $stmt->execute([":medicineid" => $data['medicineid']]);
            if (!$stmt->fetch()) {
                $this->respond(["success" => false, "error" => "Invalid medicine"], 422);
            }
            
            // Validate doctor exists
            $stmt = $conn->prepare("SELECT doctorid FROM Doctor WHERE doctorid = :doctorid AND deleted_at IS NULL");
            $stmt->execute([":doctorid" => $data['doctorid']]);
            if (!$stmt->fetch()) {
                $this->respond(["success" => false, "error" => "Invalid doctor"], 422);
            }
            
            $sql = "UPDATE Prescription 
                    SET medicineid = :medicineid, 
                        doctorid = :doctorid, 
                        quantity = :quantity, 
                        status = :status 
                    WHERE prescriptionid = :id";
            
            $stmt = $conn->prepare($sql);
            $stmt->execute([
                ":id" => $data['prescriptionid'],
                ":medicineid" => $data['medicineid'],
                ":doctorid" => $data['doctorid'],
                ":quantity" => $data['quantity'],
                ":status" => $data['status']
            ]);
            
            $this->respond([
                "success" => true, 
                "message" => "Prescription updated successfully"
            ]);
        } catch (Exception $e) {
            $this->respond(["success" => false, "error" => $e->getMessage()], 500);
        }
    }

    function deletePrescription($data) {
        try {
            $data = $this->validateInput($data, ['prescriptionid']);
            
            $conn = $this->connect();
            
            // Check if prescription exists
            $stmt = $conn->prepare("SELECT prescriptionid FROM Prescription WHERE prescriptionid = :id");
            $stmt->execute([":id" => $data['prescriptionid']]);
            if (!$stmt->fetch()) {
                $this->respond(["success" => false, "error" => "Prescription not found"], 404);
            }
            
            $sql = "DELETE FROM Prescription WHERE prescriptionid = :id";
            $stmt = $conn->prepare($sql);
            $stmt->execute([":id" => $data['prescriptionid']]);
            
            $this->respond([
                "success" => true, 
                "message" => "Prescription deleted successfully"
            ]);
        } catch (Exception $e) {
            $this->respond(["success" => false, "error" => $e->getMessage()], 500);
        }
    }
}

// Handle requests
$api = new PrescriptionAPI();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $operation = $_GET['operation'] ?? '';
    
    switch ($operation) {
        case 'getAllPrescriptions':
            $api->getAllPrescriptions();
            break;
        case 'getPrescriptionById':
            $api->getPrescriptionById($_GET['id'] ?? '');
            break;
        default:
            $api->respond(["error" => "Invalid operation"], 400);
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $operation = $input['operation'] ?? '';
    
    switch ($operation) {
        case 'insertPrescription':
            $api->insertPrescription($input);
            break;
        case 'updatePrescription':
            $api->updatePrescription($input);
            break;
        case 'deletePrescription':
            $api->deletePrescription($input);
            break;
        default:
            $api->respond(["error" => "Invalid operation"], 400);
    }
} else {
    $api->respond(["error" => "Method not allowed"], 405);
}
?>
