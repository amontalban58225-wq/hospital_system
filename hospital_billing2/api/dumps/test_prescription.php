<?php
// Test script for prescription.php functionality

// Set error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Function to make API calls
function callAPI($operation, $data = []) {
    $url = 'http://localhost:8000/api/transactions/prescription.php';
    
    // Add operation to data
    $data['operation'] = $operation;
    
    // Initialize cURL
    $curl = curl_init();
    
    // Set cURL options
    curl_setopt($curl, CURLOPT_URL, $url);
    curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($curl, CURLOPT_POST, true);
    curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($curl, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json'
    ]);
    
    // Execute cURL request
    $response = curl_exec($curl);
    
    // Check for errors
    if ($response === false) {
        echo "cURL Error: " . curl_error($curl);
        return null;
    }
    
    // Close cURL
    curl_close($curl);
    
    // Return response
    return json_decode($response, true);
}

// Function to print test results
function printResult($testName, $result) {
    echo "\n=== Test: $testName ===\n";
    echo json_encode($result, JSON_PRETTY_PRINT);
    echo "\n\n";
}

// Test 1: Get all prescriptions
printResult("Get All Prescriptions", callAPI('getAllPrescriptions'));

// Test 2: Get prescriptions for a specific admission
$admissionId = 1; // Replace with a valid admission ID
printResult("Get Prescriptions for Admission $admissionId", callAPI('getAllPrescriptions', ['admissionid' => $admissionId]));

// Test 3: Insert a new prescription
$newPrescription = [
    'admissionid' => 1, // Replace with a valid admission ID
    'medicineid' => 1, // Replace with a valid medicine ID
    'doctorid' => 1, // Replace with a valid doctor ID
    'dosage' => '500mg',
    'frequency' => 'Twice daily',
    'duration' => '7 days',
    'notes' => 'Take after meals',
    'date_prescribed' => date('Y-m-d'),
    'is_dispensed' => 0,
    'quantity' => 14,
    'status' => 'Pending'
];
printResult("Insert New Prescription", callAPI('insertPrescription', $newPrescription));

// Test 4: Get prescription by ID (use the ID from the previous test)
$prescriptionId = 1; // Replace with a valid prescription ID or use the result from Test 3
printResult("Get Prescription by ID $prescriptionId", callAPI('getPrescriptionById', ['prescriptionid' => $prescriptionId]));

// Test 5: Update a prescription
$updatePrescription = [
    'prescriptionid' => 1, // Replace with a valid prescription ID
    'admissionid' => 1, // Replace with a valid admission ID
    'medicineid' => 1, // Replace with a valid medicine ID
    'doctorid' => 1, // Replace with a valid doctor ID
    'dosage' => '250mg',
    'frequency' => 'Three times daily',
    'duration' => '5 days',
    'notes' => 'Take before meals',
    'date_prescribed' => date('Y-m-d'),
    'is_dispensed' => 1,
    'quantity' => 15,
    'status' => 'Dispensed'
];
printResult("Update Prescription", callAPI('updatePrescription', $updatePrescription));

echo "\nAll tests completed.\n";
?>