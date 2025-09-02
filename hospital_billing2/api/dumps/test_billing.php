<?php
// Test script for billing.php functionality

// Set error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Function to make API calls
function callAPI($operation, $data = []) {
    $url = 'http://localhost:8000/api/transactions/billing.php';
    
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

// Test 1: Get all billings
printResult("Get All Billings", callAPI('getAllBillings'));

// Test 2: Get billings for a specific admission
$admissionId = 1; // Replace with a valid admission ID
printResult("Get Billings for Admission $admissionId", callAPI('getAllBillings', ['admissionid' => $admissionId]));

// Test 3: Insert a new billing with reference fields
$newBilling = [
    'admissionid' => 1, // Replace with a valid admission ID
    'billing_categoryid' => 1, // Replace with a valid billing category ID
    'description' => 'Test Billing with Reference',
    'quantity' => 2,
    'unit_price' => 100.00,
    'total_amount' => 200.00,
    'reference_id' => '101',
    'reference_type' => 'room',
    'auto_calculated' => 0
];
printResult("Insert New Billing", callAPI('insertBilling', $newBilling));

// Test 4: Get billing by ID (use the ID from the previous test)
$billingId = 1; // Replace with a valid billing ID or use the result from Test 3
printResult("Get Billing by ID $billingId", callAPI('getBillingById', ['billingid' => $billingId]));

// Test 5: Update a billing
$updateBilling = [
    'billingid' => 1, // Replace with a valid billing ID
    'admissionid' => 1, // Replace with a valid admission ID
    'billing_categoryid' => 1, // Replace with a valid billing category ID
    'description' => 'Updated Test Billing',
    'quantity' => 3,
    'unit_price' => 100.00,
    'total_amount' => 300.00,
    'reference_id' => '101',
    'reference_type' => 'room',
    'auto_calculated' => 1
];
printResult("Update Billing", callAPI('updateBilling', $updateBilling));

// Test 6: Generate automatic billing
printResult("Generate Automatic Billing", callAPI('generateAutomaticBilling', ['admissionid' => 1])); // Replace with a valid admission ID

// Test 7: Get billings by category
printResult("Get Billings by Category", callAPI('getBillingsByCategory', ['admissionid' => 1])); // Replace with a valid admission ID

// Test 8: Get total billing
printResult("Get Total Billing", callAPI('getTotalBilling', ['admissionid' => 1])); // Replace with a valid admission ID

echo "\nAll tests completed.\n";
?>