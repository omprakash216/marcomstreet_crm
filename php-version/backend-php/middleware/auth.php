<?php
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class AuthMiddleware {
    private static $jwtSecret;
    
    public static function init() {
        self::$jwtSecret = getenv('JWT_SECRET') ?: 'marcom_crm_secret_key_2024';
    }
    
    public static function verifyToken($token) {
        self::init();
        
        try {
            $decoded = JWT::decode($token, new Key(self::$jwtSecret, 'HS256'));
            return (array)$decoded;
        } catch (Exception $e) {
            return null;
        }
    }
    
    public static function generateToken($payload) {
        self::init();
        
        $payload['exp'] = time() + (7 * 24 * 60 * 60); // 7 days
        return JWT::encode($payload, self::$jwtSecret, 'HS256');
    }
    
    public static function authenticate() {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        
        if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            $token = $matches[1];
            $decoded = self::verifyToken($token);
            
            if ($decoded) {
                return $decoded;
            }
        }
        
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Unauthorized']);
        exit();
    }
}

// Password hashing functions
class PasswordHelper {
    public static function hash($password) {
        return password_hash($password, PASSWORD_BCRYPT);
    }
    
    public static function verify($password, $hash) {
        return password_verify($password, $hash);
    }
}
?>