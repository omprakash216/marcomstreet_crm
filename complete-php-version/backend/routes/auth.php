<?php
require_once __DIR__ . '/../middleware/auth.php';

global $db;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_GET['action'] ?? '';
    
    if ($action === 'login') {
        // Handle login
        $email = $input['email'] ?? '';
        $password = $input['password'] ?? '';
        
        if (empty($email) || empty($password)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Email and password are required']);
            exit();
        }
        
        try {
            // Get employee by email
            $employees = $db->query(
                "SELECT * FROM employees WHERE email = ? AND status = 'active'",
                [$email]
            );
            
            if (empty($employees)) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Invalid credentials']);
                exit();
            }
            
            $employee = $employees[0];
            
            // Verify password (using password_verify for bcrypt)
            if (!password_verify($password, $employee['password'])) {
                http_response_code(401);
                echo json_encode(['success' => false, 'message' => 'Invalid credentials']);
                exit();
            }
            
            // Generate token
            $token = AuthMiddleware::generateToken($employee['id']);
            
            // Remove password from response
            unset($employee['password']);
            
            echo json_encode([
                'success' => true,
                'message' => 'Login successful',
                'data' => [
                    'employee' => $employee,
                    'token' => $token
                ]
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
        }
        
    } elseif ($action === 'logout') {
        // Handle logout
        $headers = getallheaders();
        $token = null;
        
        if (isset($headers['Authorization'])) {
            if (preg_match('/Bearer\s+(.*)$/i', $headers['Authorization'], $matches)) {
                $token = $matches[1];
            }
        }
        
        if ($token) {
            $db->query("DELETE FROM employee_tokens WHERE token = ?", [$token]);
        }
        
        echo json_encode(['success' => true, 'message' => 'Logout successful']);
        
    } else {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}
?>