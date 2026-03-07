<?php
require_once __DIR__ . '/../middleware/auth.php';

global $db;

$employee = AuthMiddleware::verifyToken();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Get check-in status
    $today = date('Y-m-d');
    
    $checkin = $db->query(
        "SELECT * FROM attendance WHERE employee_id = ? AND date = ?",
        [$employee['id'], $today]
    );
    
    $status = empty($checkin) ? 'not_checked_in' : $checkin[0]['status'];
    
    echo json_encode([
        'success' => true,
        'data' => [
            'status' => $status,
            'checkin_time' => $checkin[0]['check_in_time'] ?? null,
            'checkout_time' => $checkin[0]['check_out_time'] ?? null
        ]
    ]);
    
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Check in/out
    $action = $input['action'] ?? 'checkin';
    $today = date('Y-m-d');
    
    if ($action === 'checkin') {
        // Check if already checked in
        $existing = $db->query(
            "SELECT * FROM attendance WHERE employee_id = ? AND date = ?",
            [$employee['id'], $today]
        );
        
        if (!empty($existing)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Already checked in today']);
            exit();
        }
        
        $result = $db->query(
            "INSERT INTO attendance (employee_id, date, status, check_in_time, company_id) 
             VALUES (?, ?, 'present', NOW(), ?)",
            [$employee['id'], $today, $employee['company_id']]
        );
        
        if ($result) {
            echo json_encode(['success' => true, 'message' => 'Checked in successfully']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to check in']);
        }
        
    } elseif ($action === 'checkout') {
        // Check out
        $result = $db->query(
            "UPDATE attendance SET check_out_time = NOW() 
             WHERE employee_id = ? AND date = ? AND check_out_time IS NULL",
            [$employee['id'], $today]
        );
        
        if ($result) {
            echo json_encode(['success' => true, 'message' => 'Checked out successfully']);
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Not checked in or already checked out']);
        }
        
    } else {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
    }
    
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}
?>