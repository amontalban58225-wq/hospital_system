<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/../connection.php';

class DoctorAssignment {
    private $conn;

    public function __construct() {
        $this->conn = (new Database())->connect();
        $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    }

    private function respond($data, $code = 200) {
        http_response_code($code);
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
        exit;
    }

    private function parsePayload($payload) {
        if (is_array($payload)) return $payload;
        if (is_string($payload) && trim($payload) !== '') {
            $decoded = json_decode($payload, true);
            if (json_last_error() === JSON_ERROR_NONE)
                return $decoded;
        }
        return [];
    }

    public function getAssignments() {
        $sql = "SELECT
                    da.assignmentid, da.admissionid, da.doctorid, da.role, da.notes,
                    p.fullname AS patient_name,
                    d.fullname AS doctor_name
                FROM Doctor_Assignment da
                LEFT JOIN Admission a ON da.admissionid = a.admissionid
                LEFT JOIN Patient p ON a.patientid = p.patientid
                LEFT JOIN Doctor d ON da.doctorid = d.doctorid
                WHERE da.deleted_at IS NULL
                ORDER BY da.assignmentid DESC";

        try {
            $stmt = $this->conn->prepare($sql);
            $stmt->execute();
            $assignments = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $this->respond(['success' => true, 'data' => $assignments]);
        } catch (Exception $e) {
            $this->respond(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    public function insertAssignment($payload) {
        $data = $this->parsePayload($payload);
        if (empty($data['admissionid']) || empty($data['doctorid']) || empty($data['role'])) {
            $this->respond(['success' => false, 'error' => 'Missing required fields'], 422);
        }

        try {
            $stmt = $this->conn->prepare("INSERT INTO Doctor_Assignment (admissionid, doctorid, role, notes) VALUES (:aid, :did, :role, :notes)");
            $stmt->execute([
                ':aid' => $data['admissionid'],
                ':did' => $data['doctorid'],
                ':role' => $data['role'],
                ':notes' => $data['notes'] ?? ''
            ]);
            $id = (int)$this->conn->lastInsertId();
            $this->respond(['success' => true, 'message' => 'Assignment created', 'assignmentid' => $id], 201);
        } catch (Exception $e) {
            $this->respond(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    public function updateAssignment($payload) {
        $data = $this->parsePayload($payload);
        if (empty($data['assignmentid']) || empty($data['doctorid']) || empty($data['role'])) {
            $this->respond(['success' => false, 'error' => 'Missing required fields'], 422);
        }

        try {
            $stmt = $this->conn->prepare("UPDATE Doctor_Assignment SET admissionid=:aid, doctorid=:did, role=:role, notes=:notes WHERE assignmentid=:id AND deleted_at IS NULL");
            $stmt->execute([
                ':aid' => $data['admissionid'],
                ':did' => $data['doctorid'],
                ':role' => $data['role'],
                ':notes' => $data['notes'] ?? '',
                ':id' => $data['assignmentid']
            ]);
            $this->respond(['success' => true, 'message' => 'Assignment updated']);
        } catch (Exception $e) {
            $this->respond(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    public function deleteAssignment($id) {
        if (empty($id)) {
            $this->respond(['success' => false, 'error' => 'Assignment id required'], 422);
        }

        try {
            $stmt = $this->conn->prepare("UPDATE Doctor_Assignment SET deleted_at=NOW() WHERE assignmentid=:id AND deleted_at IS NULL");
            $stmt->execute([':id' => $id]);
            if ($stmt->rowCount() === 0) {
                $this->respond(['success' => false, 'error' => 'Assignment not found or already deleted'], 404);
            }
            $this->respond(['success' => true, 'message' => 'Assignment deleted']);
        } catch (Exception $e) {
            $this->respond(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }
}

$api = new DoctorAssignment();

$input = json_decode(file_get_contents('php://input'), true) ?? [];
if (isset($_POST['json'])) $input = json_decode($_POST['json'], true) ?? $input;

$params = array_merge($_GET, $_POST, $input);
$operation = $params['operation'] ?? null;
$payload = $params['json'] ?? $input;

switch ($operation) {
    case 'getAssignments':
        $api->getAssignments();
        break;
    case 'insertAssignment':
        $api->insertAssignment($payload);
        break;
    case 'updateAssignment':
        $api->updateAssignment($payload);
        break;
    case 'deleteAssignment':
        $api->deleteAssignment($params['assignmentid'] ?? null);
        break;
    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid operation']);
}
?>
