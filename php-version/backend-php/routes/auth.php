<?php
require_once __DIR__ . '/../middleware/auth.php';

global $db;

// Handle login
if ($_SERVER['REQUEST_METHOD'] === 'POST' && empty($pathParts[1])) {
    $email = $input['email'] ?? '';
    $password = $input['password'] ?? '';
    
    if (empty($email) || empty($password)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Email and password are required']);
        exit();
    }
    
    try {
        // Check if employee exists
        $employee = $db->queryOne(
            'SELECT * FROM employees WHERE email = ? AND status = ?',
            [$email, 'active']
        );
        
        if (!$employee) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Invalid email or password']);
            exit();
        }
        
        $passwordMatch = false;
        
        // 1) Plain text match (for existing seed/demo data)
        if ($password === $employee['password']) {
            $passwordMatch = true;
        }
        
        // 2) Bcrypt hash match
        if (!$passwordMatch && isset($employee['password'])) {
            $passwordMatch = PasswordHelper::verify($password, $employee['password']);
        }
        
        if (!$passwordMatch) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Invalid email or password']);
            exit();
        }
        
        // Prepare employee data for response
        $employeeData = [
            'id' => $employee['id'],
            'employee_code' => $employee['employee_code'] ?? '',
            'name' => $employee['name'],
            'email' => $employee['email'],
            'phone' => $employee['phone'] ?? '',
            'role' => $employee['role'] ?? 'employee',
            'department' => $employee['department'] ?? '',
            'designation' => $employee['designation'] ?? '',
            'status' => $employee['status'] ?? 'active',
            'created_at' => $employee['created_at'] ?? '',
            'updated_at' => $employee['updated_at'] ?? ''
        ];
        
        // Generate JWT token
        $tokenPayload = [
            'id' => $employee['id'],
            'email' => $employee['email'],
            'role' => $employee['role']
        ];
        
        $token = AuthMiddleware::generateToken($tokenPayload);
        
        echo json_encode([
            'success' => true,
            'message' => 'Login successful',
            'data' => [
                'employee' => $employeeData,
                'token' => $token
            ]
        ]);
        
    } catch (Exception $e) {
        error_log('Login error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Server error']);
    }
    
    exit();
}

// Handle logout
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($pathParts[1] ?? '') === 'logout') {
    $authData = AuthMiddleware::authenticate();
    
    echo json_encode([
        'success' => true,
        'message' => 'Logged out'
    ]);
    exit();
}

// Handle invalid routes
http_response_code(404);
echo json_encode(['success' => false, 'message' => 'Endpoint not found']);
?>