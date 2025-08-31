<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

class BillingCategory {
  private function connect() {
    include "connection.php";
    return (new Database())->connect();
  }

  private function respond($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data);
    exit;
  }

  private function validate($data) {
    if (empty($data['name'])) {
      $this->respond(['success' => false, 'error' => 'Category name is required'], 422);
    }
  }

  public function getAllCategories() {
    try {
      $conn = $this->connect();
      $stmt = $conn->prepare("SELECT billing_categoryid, name FROM Billing_Category ORDER BY billing_categoryid DESC");
      $stmt->execute();
      $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);
      $this->respond($categories);
    } catch (Exception $e) {
      $this->respond(['error' => 'Failed to fetch categories: ' . $e->getMessage()], 500);
    }
  }

  public function insertCategory($data) {
    $data = is_array($data) ? $data : json_decode($data, true);
    $this->validate($data);

    try {
      $conn = $this->connect();
      $stmt = $conn->prepare("INSERT INTO Billing_Category (name) VALUES (:name)");
      $stmt->execute([':name' => $data['name']]);
      $this->respond(['success' => true, 'billing_categoryid' => $conn->lastInsertId()]);
    } catch (PDOException $e) {
      $this->respond(['success' => false, 'error' => 'Insert failed: '.$e->getMessage()], 500);
    }
  }

  public function updateCategory($data) {
    $data = is_array($data) ? $data : json_decode($data, true);
    if (empty($data['billing_categoryid'])) {
      $this->respond(['success' => false, 'error' => 'Category ID is required'], 422);
    }
    $this->validate($data);

    try {
      $conn = $this->connect();
      $stmt = $conn->prepare("UPDATE Billing_Category SET name=:name WHERE billing_categoryid=:billing_categoryid");
      $stmt->execute([
        ':name' => $data['name'],
        ':billing_categoryid' => $data['billing_categoryid']
      ]);
      $this->respond(['success' => true]);
    } catch (PDOException $e) {
      $this->respond(['success' => false, 'error' => 'Update failed: '.$e->getMessage()],500);
    }
  }

  public function deleteCategory($id) {
    if (empty($id)) {
      $this->respond(['success' => false, 'error' => 'Category ID required'], 422);
    }
    try {
      $conn = $this->connect();
      $stmt = $conn->prepare("DELETE FROM Billing_Category WHERE billing_categoryid=:id");
      $stmt->execute([':id' => $id]);
      $this->respond(['success' => true]);
    } catch (Exception $e) {
      $this->respond(['success' => false, 'error' => 'Delete failed: ' . $e->getMessage()], 500);
    }
  }
}

$input = json_decode(file_get_contents("php://input"), true) ?? [];
$params = array_merge($_GET, $_POST, $input);

$operation = $params['operation'] ?? '';
$categoryId = $params['billing_categoryid'] ?? '';
$jsonData = [];

if (!empty($params['json'])) {
  $jsonData = is_array($params['json']) ? $params['json'] : json_decode($params['json'], true);
} else if (!empty($input) && !in_array($operation, ['getAllCategories', 'deleteCategory'])) {
  $jsonData = $input;
}

$category = new BillingCategory();

switch ($operation) {
  case 'getAllCategories':
    $category->getAllCategories();
    break;
  case 'insertCategory':
    $category->insertCategory($jsonData);
    break;
  case 'updateCategory':
    $category->updateCategory($jsonData);
    break;
  case 'deleteCategory':
    $category->deleteCategory($categoryId);
    break;
  default:
    echo json_encode(['error' => 'Invalid operation']);
    break;
}
