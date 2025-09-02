<?php
// Test script to verify uniqueness constraint for prescriptions

// API URL
$apiUrl = 'http://localhost:8000/api/transactions/prescription.php';

// Function to make API calls
function callAPI($operation, $data = []) {
    global $apiUrl;
    
    $data['operation'] = $operation;
    
    $ch = curl_init($apiUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
    
    $response = curl_exec($ch);
    
    if (curl_errno($ch)) {
        echo "cURL Error: " . curl_error($ch) . "\n";
        return null;
    }
    
    curl_close($ch);
    
    return json_decode($response, true);
}

// Function to print test results
function printResult($testName, $result) {
    echo "\n=== Test: $testName ===\n";
    echo json_encode($result, JSON_PRETTY_PRINT);
    echo "\n\n";
}

// Test 1: Insert a new prescription
echo "\n\n*** TESTING UNIQUENESS CONSTRAINT ***\n\n";

// First, let's create a test prescription
$newPrescription = [
    'admissionid' => 1, // Replace with a valid admission ID if needed
    'medicineid' => 1, // Replace with a valid medicine ID if needed
    'doctorid' => 1,   // Replace with a valid doctor ID if needed
    'quantity' => 14,
    'status' => 'Pending'
];

echo "First attempt to insert prescription:\n";
$result1 = callAPI('insertPrescription', $newPrescription);
printResult("Insert New Prescription", $result1);

echo "Second attempt with same admission and medicine (should fail with uniqueness error):\n";
$result2 = callAPI('insertPrescription', $newPrescription);
printResult("Insert Duplicate Prescription", $result2);

// Test 2: Try with a different medicine
$newPrescription2 = [
    'admissionid' => 1, // Same admission
    'medicineid' => 2, // Different medicine
    'doctorid' => 1, 
    'quantity' => 10,
    'status' => 'Pending'
];

echo "Attempt with same admission but different medicine (should succeed):\n";
$result3 = callAPI('insertPrescription', $newPrescription2);
printResult("Insert Different Medicine", $result3);

// Get the prescription ID from the successful insert
$prescriptionId = isset($result3['prescriptionid']) ? $result3['prescriptionid'] : null;

if ($prescriptionId) {
    echo "\n*** TESTING UPDATE UNIQUENESS CONSTRAINT ***\n";
    
    // Test 3: Update prescription to use a medicine that already exists for this admission
    $updateData = [
        'prescriptionid' => $prescriptionId,
        'medicineid' => 1, // Try to change to medicine 1, which already exists for this admission
        'doctorid' => 1,
        'quantity' => 5,
        'status' => 'Pending'
    ];
    
    echo "Attempt to update prescription to use a medicine that already exists for this admission (should fail):\n";
    printResult("Update to Duplicate Medicine", callAPI('updatePrescription', $updateData));
    
    // Test 4: Update with a different medicine (should succeed)
    $updateData['medicineid'] = 3; // Different medicine
    
    echo "Attempt to update prescription with a different medicine (should succeed):\n";
    printResult("Update with Different Medicine", callAPI('updatePrescription', $updateData));
} else {
    echo "Could not get prescription ID for update tests.\n";
}

echo "\nAll tests completed.\n";
?>