<?php
require_once __DIR__ . '/../middleware/auth.php';

global $db;

$employee = AuthMiddleware::verifyToken();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Get meetings
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
        $whereConditions[] = "(organizer_id = ? OR attendee_id = ?)";
        $params[] = $employee['id'];
        $params[] = $employee['id'];
    }
    
    $whereClause = empty($whereConditions) ? '' : 'WHERE ' . implode(' AND ', $whereConditions);
    
    // Get meetings with lead and company info
    $meetings = $db->query(
        "SELECT m.*, l.company_name, l.contact_person, c.name as company_name_full
         FROM meetings m 
         LEFT JOIN leads l ON m.lead_id = l.id 
         LEFT JOIN companies c ON m.company_id = c.id
         $whereClause 
         ORDER BY m.scheduled_time DESC LIMIT ? OFFSET ?",
        array_merge($params, [$limit, $offset])
    );
    
    echo json_encode([
        'success' => true,
        'data' => $meetings
    ]);
    
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Create new meeting
    $meetingData = [
        'lead_id' => $input['lead_id'] ?? null,
        'title' => $input['title'] ?? '',
        'description' => $input['description'] ?? '',
        'scheduled_time' => $input['scheduled_time'] ?? date('Y-m-d H:i:s'),
        'duration' => $input['duration'] ?? 60,
        'status' => $input['status'] ?? 'scheduled',
        'organizer_id' => $employee['id'],
        'company_id' => $employee['company_id']
    ];
    
    $result = $db->query(
        "INSERT INTO meetings (lead_id, title, description, scheduled_time, duration, status, organizer_id, company_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        array_values($meetingData)
    );
    
    if ($result) {
        $meetingId = $db->getConnection()->insert_id;
        echo json_encode([
            'success' => true,
            'message' => 'Meeting scheduled successfully',
            'data' => ['id' => $meetingId]
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to schedule meeting']);
    }
    
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}
?>