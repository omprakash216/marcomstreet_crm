<?php
class AuthMiddleware {
    public static function verifyToken() {
        $headers = getallheaders();
        $token = null;

        // Check Authorization header
        if (isset($headers['Authorization'])) {
            if (preg_match('/Bearer\s+(.*)$/i', $headers['Authorization'], $matches)) {
                $token = $matches[1];
            }
        }

        // Check token in session (for PHP frontend)
        if (!$token && session_status() === PHP_SESSION_ACTIVE && isset($_SESSION['token'])) {
            $token = $_SESSION['token'];
        }

        if (!$token) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Access token required']);
            exit();
        }

        try {
            $decoded = self::validateToken($token);
            return $decoded;
        } catch (Exception $e) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Invalid token']);
            exit();
        }
    }

    private static function validateToken($token) {
        global $db;
        
        // Check if token exists in database
        $result = $db->query("SELECT * FROM employee_tokens WHERE token = ? AND expires_at > NOW()", [$token]);
        
        if (empty($result)) {
            throw new Exception('Token invalid or expired');
        }

        $tokenData = $result[0];
        
        // Get employee data
        $employee = $db->query("SELECT * FROM employees WHERE id = ? AND status = 'active'", [$tokenData['employee_id']]);
        
        if (empty($employee)) {
            throw new Exception('Employee not found');
        }

        return [
            'id' => $employee[0]['id'],
            'name' => $employee[0]['name'],
            'email' => $employee[0]['email'],
            'role' => $employee[0]['role'],
            'department_id' => $employee[0]['department_id'],
            'company_id' => $employee[0]['company_id']
        ];
    }

    public static function generateToken($employeeId) {
        global $db;
        
        $token = bin2hex(random_bytes(32));
        $expiresAt = date('Y-m-d H:i:s', strtotime('+8 hours'));
        
        // Store token in database
        $db->query(
            "INSERT INTO employee_tokens (employee_id, token, expires_at) VALUES (?, ?, ?)",
            [$employeeId, $token, $expiresAt]
        );
        
        return $token;
    }

    public static function cleanupExpiredTokens() {
        global $db;
        $db->query("DELETE FROM employee_tokens WHERE expires_at <= NOW()");
    }
}
?>