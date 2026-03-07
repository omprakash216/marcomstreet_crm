<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/middleware/auth.php';

// Load environment variables
$envFile = __DIR__ . '/.env';
if (file_exists($envFile)) {
    $envVars = parse_ini_file($envFile);
    foreach ($envVars as $key => $value) {
        putenv("$key=$value");
    }
}

// Parse request
$requestUri = $_SERVER['REQUEST_URI'];
$basePath = '/api/';
$requestPath = parse_url($requestUri, PHP_URL_PATH);

// Remove base path
if (strpos($requestPath, $basePath) === 0) {
    $requestPath = substr($requestPath, strlen($basePath));
}

$pathParts = explode('/', trim($requestPath, '/'));
$resource = $pathParts[0] ?? '';
$action = $pathParts[1] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// Get request data
$input = json_decode(file_get_contents('php://input'), true) ?? [];
$queryParams = $_GET;

// Clean expired tokens
AuthMiddleware::cleanupExpiredTokens();

// Route handling
try {
    switch ("/$resource") {
        case '/auth':
            require_once __DIR__ . '/routes/auth.php';
            break;
        case '/leads':
            require_once __DIR__ . '/routes/leads.php';
            break;
        case '/meetings':
            require_once __DIR__ . '/routes/meetings.php';
            break;
        case '/invoices':
            require_once __DIR__ . '/routes/invoices.php';
            break;
        case '/employees':
            require_once __DIR__ . '/routes/employees.php';
            break;
        case '/dashboard':
            require_once __DIR__ . '/routes/dashboard.php';
            break;
        case '/tasks':
            require_once __DIR__ . '/routes/tasks.php';
            break;
        case '/hrms':
            require_once __DIR__ . '/routes/hrms.php';
            break;
        case '/companies':
            require_once __DIR__ . '/routes/companies.php';
            break;
        case '/checkin':
            require_once __DIR__ . '/routes/checkin.php';
            break;
        case '/reports':
            require_once __DIR__ . '/routes/reports.php';
            break;
        case '/quotations':
            require_once __DIR__ . '/routes/quotations.php';
            break;
        case '/admin':
            require_once __DIR__ . '/routes/admin.php';
            break;
        case '/chat':
            require_once __DIR__ . '/routes/chat.php';
            break;
        case '/check':
            echo json_encode(['success' => true, 'message' => 'PHP backend is running', 'timestamp' => date('Y-m-d H:i:s')]);
            break;
        default:
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Endpoint not found', 'requested' => $requestPath]);
            break;
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}
?>