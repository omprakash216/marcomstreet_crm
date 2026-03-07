<?php
require_once __DIR__ . '/../middleware/auth.php';

global $db;

$employee = AuthMiddleware::verifyToken();

// Only admin can manage employees
if ($employee['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Access denied']);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Get employees
    $employees = $db->query(
        "SELECT id, name, email, role, department_id, status, created_at 
         FROM employees WHERE company_id = ? ORDER BY name",
        [$employee['company_id']]
    );
    
    echo json_encode([
        'success' => true,
        'data' => $employees
    ]);
    
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Create new employee
    $employeeData = [
        'name' => $input['name'] ?? '',
        'email' => $input['email'] ?? '',
        'password' => password_hash($input['password'] ?? 'password123', PASSWORD_DEFAULT),
        'role' => $input['role'] ?? 'employee',
        'department_id' => $input['department_id'] ?? null,
        'status' => $input['status'] ?? 'active',
        'company_id' => $employee['company_id']
    ];
    
    $result = $db->query(
        "INSERT INTO employees (name, email, password, role, department_id, status, company_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        array_values($employeeData)
    );
    
    if ($result) {
        $employeeId = $db->getConnection()->insert_id;
        echo json_encode([
            'success' => true,
            'message' => 'Employee created successfully',
            'data' => ['id' => $employeeId]
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to create employee']);
    }
    
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}
?>