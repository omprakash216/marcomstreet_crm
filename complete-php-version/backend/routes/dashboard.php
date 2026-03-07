<?php
require_once __DIR__ . '/../middleware/auth.php';

global $db;

$employee = AuthMiddleware::verifyToken();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Get dashboard statistics
    $stats = [];
    
    // Total leads
    $leadsCount = $db->query(
        "SELECT COUNT(*) as total FROM leads WHERE company_id = ?",
        [$employee['company_id']]
    );
    $stats['total_leads'] = $leadsCount[0]['total'];
    
    // Active leads
    $activeLeads = $db->query(
        "SELECT COUNT(*) as total FROM leads WHERE company_id = ? AND status IN ('new', 'contacted', 'proposal')",
        [$employee['company_id']]
    );
    $stats['active_leads'] = $activeLeads[0]['total'];
    
    // Total meetings
    $meetingsCount = $db->query(
        "SELECT COUNT(*) as total FROM meetings WHERE company_id = ?",
        [$employee['company_id']]
    );
    $stats['total_meetings'] = $meetingsCount[0]['total'];
    
    // Today's meetings
    $todayMeetings = $db->query(
        "SELECT COUNT(*) as total FROM meetings WHERE company_id = ? AND DATE(scheduled_time) = CURDATE()",
        [$employee['company_id']]
    );
    $stats['today_meetings'] = $todayMeetings[0]['total'];
    
    // Total invoices
    $invoicesCount = $db->query(
        "SELECT COUNT(*) as total FROM invoices WHERE company_id = ?",
        [$employee['company_id']]
    );
    $stats['total_invoices'] = $invoicesCount[0]['total'];
    
    // Revenue
    $revenue = $db->query(
        "SELECT SUM(total_amount) as total FROM invoices WHERE company_id = ? AND status = 'paid'",
        [$employee['company_id']]
    );
    $stats['total_revenue'] = $revenue[0]['total'] ?? 0;
    
    // Recent activities
    $recentActivities = $db->query(
        "SELECT 'lead' as type, company_name as title, created_at as date FROM leads 
         WHERE company_id = ? 
         UNION ALL 
         SELECT 'meeting' as type, title, scheduled_time as date FROM meetings 
         WHERE company_id = ? 
         UNION ALL 
         SELECT 'invoice' as type, invoice_number as title, created_at as date FROM invoices 
         WHERE company_id = ? 
         ORDER BY date DESC LIMIT 10",
        [$employee['company_id'], $employee['company_id'], $employee['company_id']]
    );
    
    echo json_encode([
        'success' => true,
        'data' => [
            'stats' => $stats,
            'recent_activities' => $recentActivities
        ]
    ]);
    
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}
?>