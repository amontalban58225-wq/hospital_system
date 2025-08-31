<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS'){ http_response_code(204); exit; }

include_once __DIR__ . '/../connection.php';
error_reporting(E_ALL);
ini_set('display_errors', 0);

class AdmissionAPI {
    private PDO $conn;
    public function __construct(){
        $this->conn = (new Database())->connect();
        $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    }

    private function respond($data, $status = 200){
        http_response_code($status);
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
        exit;
    }

    private function hasColumn(string $table, string $column): bool {
        $sql = "SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute([':table' => $table, ':column' => $column]);
        return (int)$stmt->fetchColumn() > 0;
    }

    private function checkExists(string $table, string $column, $value): bool {
        $sql = "SELECT 1 FROM {$table} WHERE {$column} = :value";
        if ($this->hasColumn($table, 'deleted_at')) $sql .= " AND deleted_at IS NULL";
        $sql .= " LIMIT 1";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute([':value' => $value]);
        return $stmt->fetchColumn() !== false;
    }

    private function mapStatusUI($status): array {
        $map = [
            'Admitted'   => ['label' => 'Admitted',   'class' => 'badge bg-green-500 text-white'],
            'Discharged' => ['label' => 'Discharged', 'class' => 'badge bg-red-500 text-white'],
            'Closed'     => ['label' => 'Closed',     'class' => 'badge bg-gray-500 text-white'],
        ];
        return $map[$status] ?? ['label' => $status, 'class' => 'badge bg-blue-500 text-white'];
    }

    public function getAllAdmissions(){
        $adDeleted = $this->hasColumn('Admission','deleted_at') ? 'AND a.deleted_at IS NULL' : '';
        $raDeleted = $this->hasColumn('Room_Assignment','deleted_at') ? 'AND ra.deleted_at IS NULL' : '';

        $sql = "
            SELECT a.admissionid, a.patientid, a.doctorid, a.userid, a.admission_date, a.status,
                   COALESCE(p.fullname, '') AS patient_name,
                   COALESCE(d.fullname, '') AS doctor_name,
                   COALESCE(u.username, '') AS user_name,
                   COALESCE(ra.room_no, '') AS roomno
            FROM Admission a
            LEFT JOIN Patient p ON a.patientid = p.patientid
            LEFT JOIN Doctor d ON a.doctorid = d.doctorid
            LEFT JOIN User u ON a.userid = u.userid
            LEFT JOIN Room_Assignment ra ON a.admissionid = ra.admissionid AND ra.end_date IS NULL {$raDeleted}
            WHERE 1=1 {$adDeleted}
            ORDER BY a.admissionid DESC
        ";
        $stmt = $this->conn->query($sql);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        foreach ($rows as &$row) {
            $statusUI = $this->mapStatusUI($row['status']);
            $row['status_label'] = $statusUI['label'];
            $row['status_class'] = $statusUI['class'];
        }

        $this->respond($rows);
    }

    public function getActiveAdmissions(){
        $adDeleted = $this->hasColumn('Admission','deleted_at') ? 'AND a.deleted_at IS NULL' : '';
        $raDeleted = $this->hasColumn('Room_Assignment','deleted_at') ? 'AND ra.deleted_at IS NULL' : '';

        $sql = "
            SELECT a.admissionid, a.patientid, a.admission_date, a.status,
                   COALESCE(p.fullname, '') AS patient_name,
                   COALESCE(ra.room_no, '') AS roomno
            FROM Admission a
            JOIN Patient p ON a.patientid = p.patientid
            LEFT JOIN Room_Assignment ra ON a.admissionid = ra.admissionid AND ra.end_date IS NULL {$raDeleted}
            WHERE COALESCE(a.status, '') NOT IN ('Discharged', 'Closed') {$adDeleted}
            ORDER BY a.admission_date DESC
        ";
        $stmt = $this->conn->query($sql);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        foreach ($rows as &$row) {
            $statusUI = $this->mapStatusUI($row['status']);
            $row['status_label'] = $statusUI['label'];
            $row['status_class'] = $statusUI['class'];
        }

        $this->respond($rows);
    }

    public function insertAdmission($data){
        if (!is_array($data) || empty($data))
            $this->respond(['success' => false, 'error' => 'Invalid payload'], 422);

        $patientid = $data['patientid'] ?? null;
        $doctorid = $data['doctorid'] ?? null;
        $userid = $data['userid'] ?? null;
        $admission_date = $data['admission_date'] ?? date('Y-m-d H:i:s');
        // status will be handled by DB default (Admitted)

        if (empty($patientid) || empty($doctorid) || empty($userid))
            $this->respond(['success' => false, 'error' => 'Missing required fields (patientid, doctorid, userid)'], 422);

        if (!$this->checkExists('Patient', 'patientid', $patientid))
            $this->respond(['success' => false, 'error' => 'Invalid patient ID'], 422);
        if (!$this->checkExists('Doctor', 'doctorid', $doctorid))
            $this->respond(['success' => false, 'error' => 'Invalid doctor ID'], 422);
        if (!$this->checkExists('User', 'userid', $userid))
            $this->respond(['success' => false, 'error' => 'Invalid user ID'], 422);

        // Prevent duplicate active admission
        $sqlCheck = "SELECT 1 FROM Admission WHERE patientid = :pid AND COALESCE(status, '') NOT IN ('Discharged', 'Closed')";
        if ($this->hasColumn('Admission','deleted_at')) $sqlCheck .= " AND deleted_at IS NULL";
        $sqlCheck .= " LIMIT 1";
        $stmt = $this->conn->prepare($sqlCheck);
        $stmt->execute([':pid' => $patientid]);
        if ($stmt->fetchColumn())
            $this->respond(['success' => false, 'error' => 'Patient is already admitted'], 422);

        $sql = "
            INSERT INTO Admission (patientid, doctorid, userid, admission_date)
            VALUES (:patientid, :doctorid, :userid, :admission_date)
        ";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute([
            ':patientid' => $patientid,
            ':doctorid' => $doctorid,
            ':userid' => $userid,
            ':admission_date' => $admission_date
        ]);

        $this->respond(['success' => true, 'admissionid' => $this->conn->lastInsertId()], 201);
    }

    public function updateAdmission($data){
        if (!is_array($data) || empty($data))
            $this->respond(['success' => false, 'error' => 'Invalid payload'], 422);

        $admissionid = $data['admissionid'] ?? null;
        $patientid = $data['patientid'] ?? null;
        $doctorid = $data['doctorid'] ?? null;
        $userid = $data['userid'] ?? null;
        $admission_date = $data['admission_date'] ?? null;
        $status = $data['status'] ?? null;

        if (empty($admissionid) || empty($patientid) || empty($doctorid) || empty($userid) || empty($admission_date) || empty($status)) {
            $this->respond(['success' => false, 'error' => 'Missing required fields'], 422);
        }

        if (!$this->checkExists('Patient', 'patientid', $patientid))
            $this->respond(['success' => false, 'error' => 'Invalid patient ID'], 422);
        if (!$this->checkExists('Doctor', 'doctorid', $doctorid))
            $this->respond(['success' => false, 'error' => 'Invalid doctor ID'], 422);
        if (!$this->checkExists('User', 'userid', $userid))
            $this->respond(['success' => false, 'error' => 'Invalid user ID'], 422);

        $sql = "
            UPDATE Admission
            SET patientid = :patientid, doctorid = :doctorid, userid = :userid, admission_date = :admission_date, status = :status
            WHERE admissionid = :admissionid
        ";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute([
            ':admissionid' => $admissionid,
            ':patientid' => $patientid,
            ':doctorid' => $doctorid,
            ':userid' => $userid,
            ':admission_date' => $admission_date,
            ':status' => $status
        ]);

        if ($stmt->rowCount() === 0)
            $this->respond(['success' => false, 'error' => 'Admission not found or nothing changed'], 404);

        $this->respond(['success' => true]);
    }

    public function deleteAdmission($admissionid){
        if (empty($admissionid)) $this->respond(['success' => false, 'error' => 'Admission ID is required'], 422);

        if ($this->hasColumn('Admission','deleted_at')) {
            $stmt = $this->conn->prepare("UPDATE Admission SET deleted_at = NOW() WHERE admissionid = :id AND deleted_at IS NULL");
            $stmt->execute([':id' => $admissionid]);
            if ($stmt->rowCount() === 0)
                $this->respond(['success' => false, 'error' => 'Admission not found or already deleted'], 404);
            $this->respond(['success' => true, 'message' => 'Admission soft-deleted']);
        } else {
            $stmt = $this->conn->prepare("DELETE FROM Admission WHERE admissionid = :id");
            $stmt->execute([':id' => $admissionid]);
            if ($stmt->rowCount() === 0)
                $this->respond(['success' => false, 'error' => 'Admission not found'], 404);
            $this->respond(['success' => true, 'message' => 'Admission deleted']);
        }
    }
}

$api = new AdmissionAPI();
$input = json_decode(file_get_contents("php://input"), true) ?? [];
$params = array_merge($_GET, $_POST, $input);
$operation = $params['operation'] ?? null;

switch ($operation) {
    case 'getAllAdmissions':
        $api->getAllAdmissions();
        break;
    case 'getActiveAdmissions':
        $api->getActiveAdmissions();
        break;
    case 'insertAdmission':
        $api->insertAdmission($input);
        break;
    case 'updateAdmission':
        $api->updateAdmission($input);
        break;
    case 'deleteAdmission':
        $api->deleteAdmission($params['admissionid'] ?? null);
        break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid operation']);
}
