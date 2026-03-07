<?php
require_once __DIR__ . '/../middleware/auth.php';

global $db;

$employee = AuthMiddleware::verifyToken();

// Only admin can access admin routes
if ($employee['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Access denied']);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $action = $_GET['action'] ?? 'dashboard';
    
    switch ($action) {
        case 'dashboard':
            // Admin dashboard stats
            $totalEmployees = $db->query("SELECT COUNT(*) as count FROM employees WHERE company_id = ?", [$employee['company_id']]);
            $totalLeads = $db->query("SELECT COUNT(*) as count FROM leads WHERE company_id = ?", [$employee['company_id']]);
            $totalRevenue = $db->query("SELECT SUM(total_amount) as total FROM invoices WHERE company_id = ? AND status = 'paid'", [$employee['company_id']]);
            
            echo json_encode([
                'success' => true,
                'data' => [
                    'total_employees' => $totalEmployees[0]['count'],
                    'total_leads' => $totalLeads[0]['count'],
                    'total_revenue' => $totalRevenue[0]['total'] ?? 0
                ]
            ]);
            break;
            
        case 'users':
            // Get all users
            $users = $db->query(
                "SELECT id, name, email, role, status, created_at FROM employees WHERE company_id = ? ORDER BY name",
                [$employee['company_id']]
            );
            echo json_encode(['success' => true, 'data' => $users]);
            break;
            
        default:
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid action']);
    }
    
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_GET['action'] ?? '';
    
    switch ($action) {
        case 'create-user':
            // Create new user
            $userData = [
                'name' => $input['name'] ?? '',
                'email' => $input['email'] ?? '',
                'password' => password_hash($input['password'] ?? 'password123', PASSWORD_DEFAULT),
                'role' => $input['role'] ?? 'employee',
                'status' => $input['status'] ?? 'active',
                'company_id' => $employee['company_id']
            ];
            
            $result = $db->query(
                "INSERT INTO employees (name, email, password, role, status, company_id) VALUES (?, ?, ?, ?, ?, ?)",
                array_values($userData)
            );
            
            if ($result) {
                echo json_encode(['success' => true, 'message' => 'User created successfully']);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to create user']);
            }
            break;
            
        case 'update-user':
            // Update user
            $userId = $input['id'] ?? 0;
            $updateData = [
                'name' => $input['name'] ?? '',
                'email' => $input['email'] ?? '',
                'role' => $input['role'] ?? '',
                'status' => $input['status'] ?? ''
            ];
            
            $result = $db->query(
                "UPDATE employees SET name = ?, email = ?, role = ?, status = ? WHERE id = ? AND company_id = ?",
                array_merge(array_values($updateData), [$userId, $employee['company_id']])
            );
            
            if ($result) {
                echo json_encode(['success' => true, 'message' => 'User updated successfully']);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to update user']);
            }
            break;
            
        default:
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid action']);
    }
    
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}
?>