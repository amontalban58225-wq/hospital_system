<?php
// Test script for payment.php functionality

// Set error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Function to make API calls
function callAPI($operation, $data = []) {
    $url = 'http://localhost:8000/api/transactions/payment.php';
    
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

// Test 1: Get all payments
printResult("Get All Payments", callAPI('getAllPayments'));

// Test 2: Get payments for a specific admission
$admissionId = 1; // Replace with a valid admission ID
printResult("Get Payments for Admission $admissionId", callAPI('getPaymentsByAdmission', ['admissionid' => $admissionId]));

// Test 3: Insert a new payment
$newPayment = [
    'admissionid' => 1, // Replace with a valid admission ID
    'method' => 'Cash',
    'amount' => 500.00,
    'payment_date' => date('Y-m-d'),
    'reference_no' => 'REF-' . rand(1000, 9999),
    'remarks' => 'Test Payment'
];
printResult("Insert New Payment", callAPI('insertPayment', $newPayment));

// Test 4: Get payment by ID (use the ID from the previous test)
$paymentId = 1; // Replace with a valid payment ID or use the result from Test 3
printResult("Get Payment by ID $paymentId", callAPI('getPaymentById', ['paymentid' => $paymentId]));

// Test 5: Update a payment
$updatePayment = [
    'paymentid' => 1, // Replace with a valid payment ID
    'admissionid' => 1, // Replace with a valid admission ID
    'method' => 'Credit Card',
    'amount' => 600.00,
    'payment_date' => date('Y-m-d'),
    'reference_no' => 'REF-' . rand(1000, 9999),
    'remarks' => 'Updated Test Payment'
];
printResult("Update Payment", callAPI('updatePayment', $updatePayment));

// Test 6: Get payment summary
printResult("Get Payment Summary", callAPI('getPaymentSummary', ['admissionid' => 1])); // Replace with a valid admission ID

echo "\nAll tests completed.\n";
?>