<?php
require_once __DIR__ . '/../middleware/auth.php';

global $db;

$employee = AuthMiddleware::verifyToken();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Get chat messages
    $page = $_GET['page'] ?? 1;
    $limit = $_GET['limit'] ?? 50;
    $offset = ($page - 1) * $limit;
    
    $messages = $db->query(
        "SELECT m.*, e.name as sender_name 
         FROM chat_messages m 
         LEFT JOIN employees e ON m.sender_id = e.id 
         WHERE m.company_id = ? 
         ORDER BY m.created_at DESC LIMIT ? OFFSET ?",
        [$employee['company_id'], $limit, $offset]
    );
    
    echo json_encode([
        'success' => true,
        'data' => array_reverse($messages) // Return in chronological order
    ]);
    
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Send chat message
    $messageData = [
        'sender_id' => $employee['id'],
        'message' => $input['message'] ?? '',
        'company_id' => $employee['company_id']
    ];
    
    if (empty($messageData['message'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Message cannot be empty']);
        exit();
    }
    
    $result = $db->query(
        "INSERT INTO chat_messages (sender_id, message, company_id) VALUES (?, ?, ?)",
        array_values($messageData)
    );
    
    if ($result) {
        $messageId = $db->getConnection()->insert_id;
        
        // Get the created message with sender info
        $newMessage = $db->query(
            "SELECT m.*, e.name as sender_name 
             FROM chat_messages m 
             LEFT JOIN employees e ON m.sender_id = e.id 
             WHERE m.id = ?",
            [$messageId]
        );
        
        echo json_encode([
            'success' => true,
            'message' => 'Message sent successfully',
            'data' => $newMessage[0] ?? null
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to send message']);
    }
    
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}
?>