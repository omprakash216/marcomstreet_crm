<?php
require_once __DIR__ . '/../middleware/auth.php';

global $db;

$employee = AuthMiddleware::verifyToken();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Get invoices
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
    
    // Get invoices with client info
    $invoices = $db->query(
        "SELECT i.*, l.company_name, l.contact_person, e.name as employee_name
         FROM invoices i 
         LEFT JOIN leads l ON i.lead_id = l.id 
         LEFT JOIN employees e ON i.employee_id = e.id
         $whereClause 
         ORDER BY i.created_at DESC LIMIT ? OFFSET ?",
        array_merge($params, [$limit, $offset])
    );
    
    echo json_encode([
        'success' => true,
        'data' => $invoices
    ]);
    
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Create new invoice
    $invoiceData = [
        'lead_id' => $input['lead_id'] ?? null,
        'invoice_number' => $input['invoice_number'] ?? 'INV-' . date('YmdHis'),
        'client_name' => $input['client_name'] ?? '',
        'total_amount' => $input['total_amount'] ?? 0,
        'tax_amount' => $input['tax_amount'] ?? 0,
        'discount' => $input['discount'] ?? 0,
        'status' => $input['status'] ?? 'draft',
        'due_date' => $input['due_date'] ?? date('Y-m-d', strtotime('+30 days')),
        'notes' => $input['notes'] ?? '',
        'employee_id' => $employee['id'],
        'company_id' => $employee['company_id']
    ];
    
    $result = $db->query(
        "INSERT INTO invoices (lead_id, invoice_number, client_name, total_amount, tax_amount, discount, status, due_date, notes, employee_id, company_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        array_values($invoiceData)
    );
    
    if ($result) {
        $invoiceId = $db->getConnection()->insert_id;
        echo json_encode([
            'success' => true,
            'message' => 'Invoice created successfully',
            'data' => ['id' => $invoiceId]
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to create invoice']);
    }
    
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}
?>