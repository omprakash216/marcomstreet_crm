<?php
require_once __DIR__ . '/../middleware/auth.php';

global $db;

$employee = AuthMiddleware::verifyToken();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Get company details
    $company = $db->query(
        "SELECT * FROM companies WHERE id = ?",
        [$employee['company_id']]
    );
    
    if (empty($company)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Company not found']);
        exit();
    }
    
    echo json_encode(['success' => true, 'data' => $company[0]]);
    
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Update company details
    $updateData = [
        'name' => $input['name'] ?? '',
        'address' => $input['address'] ?? '',
        'phone' => $input['phone'] ?? '',
        'email' => $input['email'] ?? '',
        'website' => $input['website'] ?? ''
    ];
    
    $result = $db->query(
        "UPDATE companies SET name = ?, address = ?, phone = ?, email = ?, website = ? WHERE id = ?",
        array_merge(array_values($updateData), [$employee['company_id']])
    );
    
    if ($result) {
        echo json_encode(['success' => true, 'message' => 'Company details updated']);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to update company details']);
    }
    
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}
?>