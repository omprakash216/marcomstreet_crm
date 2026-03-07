<?php
require_once __DIR__ . '/../middleware/auth.php';

global $db;

$employee = AuthMiddleware::verifyToken();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Get leads
    $page = $_GET['page'] ?? 1;
    $limit = $_GET['limit'] ?? 20;
    $offset = ($page - 1) * $limit;
    
    $whereConditions = [];
    $params = [];
    
    // Filter by status
    if (isset($_GET['status'])) {
        $whereConditions[] = "status = ?";
        $params[] = $_GET['status'];
    }
    
    // Filter by employee
    if ($employee['role'] !== 'admin') {
        $whereConditions[] = "(assigned_to = ? OR created_by = ?)";
        $params[] = $employee['id'];
        $params[] = $employee['id'];
    }
    
    $whereClause = empty($whereConditions) ? '' : 'WHERE ' . implode(' AND ', $whereConditions);
    
    // Get total count
    $countResult = $db->query("SELECT COUNT(*) as total FROM leads $whereClause", $params);
    $total = $countResult[0]['total'];
    
    // Get leads
    $leads = $db->query(
        "SELECT * FROM leads $whereClause ORDER BY created_at DESC LIMIT ? OFFSET ?",
        array_merge($params, [$limit, $offset])
    );
    
    echo json_encode([
        'success' => true,
        'data' => $leads,
        'pagination' => [
            'page' => (int)$page,
            'limit' => (int)$limit,
            'total' => (int)$total,
            'pages' => ceil($total / $limit)
        ]
    ]);
    
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Create new lead
    $leadData = [
        'company_name' => $input['company_name'] ?? '',
        'contact_person' => $input['contact_person'] ?? '',
        'email' => $input['email'] ?? '',
        'phone' => $input['phone'] ?? '',
        'source' => $input['source'] ?? 'website',
        'status' => $input['status'] ?? 'new',
        'assigned_to' => $input['assigned_to'] ?? $employee['id'],
        'created_by' => $employee['id'],
        'company_id' => $employee['company_id']
    ];
    
    $result = $db->query(
        "INSERT INTO leads (company_name, contact_person, email, phone, source, status, assigned_to, created_by, company_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        array_values($leadData)
    );
    
    if ($result) {
        $leadId = $db->getConnection()->insert_id;
        echo json_encode([
            'success' => true,
            'message' => 'Lead created successfully',
            'data' => ['id' => $leadId]
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to create lead']);
    }
    
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}
?>