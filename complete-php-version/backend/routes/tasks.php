<?php
require_once __DIR__ . '/../middleware/auth.php';

global $db;

$employee = AuthMiddleware::verifyToken();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Get tasks
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
    
    // Get tasks
    $tasks = $db->query(
        "SELECT t.*, e.name as assigned_name, l.company_name
         FROM tasks t 
         LEFT JOIN employees e ON t.assigned_to = e.id 
         LEFT JOIN leads l ON t.lead_id = l.id
         $whereClause 
         ORDER BY t.due_date DESC LIMIT ? OFFSET ?",
        array_merge($params, [$limit, $offset])
    );
    
    echo json_encode([
        'success' => true,
        'data' => $tasks
    ]);
    
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Create new task
    $taskData = [
        'title' => $input['title'] ?? '',
        'description' => $input['description'] ?? '',
        'due_date' => $input['due_date'] ?? date('Y-m-d', strtotime('+7 days')),
        'priority' => $input['priority'] ?? 'medium',
        'status' => $input['status'] ?? 'pending',
        'assigned_to' => $input['assigned_to'] ?? $employee['id'],
        'lead_id' => $input['lead_id'] ?? null,
        'created_by' => $employee['id'],
        'company_id' => $employee['company_id']
    ];
    
    $result = $db->query(
        "INSERT INTO tasks (title, description, due_date, priority, status, assigned_to, lead_id, created_by, company_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        array_values($taskData)
    );