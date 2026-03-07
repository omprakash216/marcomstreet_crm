<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/middleware/auth.php';

// Load environment variables
$dotenv = parse_ini_file(__DIR__ . '/.env');
if ($dotenv) {
    foreach ($dotenv as $key => $value) {
        putenv("$key=$value");
    }
}

// Parse request URL
$requestUri = $_SERVER['REQUEST_URI'];
$basePath = '/api/';
$requestPath = parse_url($requestUri, PHP_URL_PATH);

// Remove base path
if (strpos($requestPath, $basePath) === 0) {
    $requestPath = substr($requestPath, strlen($basePath));
}

$pathParts = explode('/', trim($requestPath, '/'));
$resource = $pathParts[0] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// Get request data
$input = json_decode(file_get_contents('php://input'), true) ?? [];
$queryParams = $_GET;

// Route handling
switch ("/$resource") {
    case '/auth':
        require_once __DIR__ . '/routes/auth.php';
        break;
    case '/check':
        echo json_encode(['success' => true, 'message' => 'PHP backend is running']);
        break;
    default:
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Endpoint not found']);
        break;
}

// Handle file serving for uploads and assets
if (strpos($requestPath, '/uploads/') === 0 || strpos($requestPath, '/backend/assets/') === 0) {
    $filePath = __DIR__ . '/../..' . $requestPath;
    if (file_exists($filePath) && is_file($filePath)) {
        $mimeTypes = [
            'pdf' => 'application/pdf',
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'gif' => 'image/gif',
        ];
        
        $extension = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
        $contentType = $mimeTypes[$extension] ?? 'application/octet-stream';
        
        header('Content-Type: ' . $contentType);
        readfile($filePath);
        exit();
    } else {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'File not found']);
    }
}
?>