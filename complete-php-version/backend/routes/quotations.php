<?php
require_once __DIR__ . '/../middleware/auth.php';

global $db;

$employee = AuthMiddleware::verifyToken();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Get quotations
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
        $whereConditions[] = "(employee_id = ? OR created_by = ?)";
        $params[] = $employee['id'];
        $params[] = $employee['id'];
    }
    
    $whereClause = empty($whereConditions) ? '' : 'WHERE ' . implode(' AND ', $whereConditions);
    
    // Get quotations with client info
    $quotations = $db->query(
        "SELECT q.*, l.company_name, l.contact_person, e.name as employee_name
         FROM quotations q 
         LEFT JOIN leads l ON q.lead_id = l.id 
         LEFT JOIN employees e ON q.employee_id = e.id
         $whereClause 
         ORDER BY q.created_at DESC LIMIT ? OFFSET ?",
        array_merge($params, [$limit, $offset])
    );
    
    echo json_encode([
        'success' => true,
        'data' => $quotations
    ]);
    
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Create new quotation
    $quotationData = [
        'lead_id' => $input['lead_id'] ?? null,
        'quotation_number' => $input['quotation_number'] ?? 'QTN-' . date('YmdHis'),
        'client_name' => $input['client_name'] ?? '',
        'total_amount' => $input['total_amount'] ?? 0,
        'valid_until' => $input['valid_until'] ?? date('Y-m-d', strtotime('+30 days')),
        'status' => $input['status'] ?? 'draft',
        'notes' => $input['notes'] ?? '',
        'employee_id' => $employee['id'],
        'company_id' => $employee['company_id']
    ];
    
    $result = $db->query(
        "INSERT INTO quotations (lead_id, quotation_number, client_name, total_amount, valid_until, status, notes, employee_id, company_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        array_values($quotationData)
    );
    
    if ($result) {
        $quotationId = $db->getConnection()->insert_id;
        echo json_encode([
            'success' => true,
            'message' => 'Quotation created successfully',
            'data' => ['id' => $quotationId]
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to create quotation']);
    }
    
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}
?>