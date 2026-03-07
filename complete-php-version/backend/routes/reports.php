<?php
require_once __DIR__ . '/../middleware/auth.php';

global $db;

$employee = AuthMiddleware::verifyToken();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $reportType = $_GET['type'] ?? 'overview';
    $startDate = $_GET['start_date'] ?? date('Y-m-01');
    $endDate = $_GET['end_date'] ?? date('Y-m-t');
    
    $reports = [];
    
    switch ($reportType) {
        case 'overview':
            // Leads by status
            $leadsByStatus = $db->query(
                "SELECT status, COUNT(*) as count FROM leads 
                 WHERE company_id = ? AND created_at BETWEEN ? AND ? 
                 GROUP BY status",
                [$employee['company_id'], $startDate, $endDate]
            );
            
            // Revenue by month
            $revenueByMonth = $db->query(
                "SELECT DATE_FORMAT(created_at, '%Y-%m') as month, 
                 SUM(total_amount) as revenue FROM invoices 
                 WHERE company_id = ? AND status = 'paid' AND created_at BETWEEN ? AND ? 
                 GROUP BY DATE_FORMAT(created_at, '%Y-%m')",
                [$employee['company_id'], $startDate, $endDate]
            );
            
            $reports = [
                'leads_by_status' => $leadsByStatus,
                'revenue_by_month' => $revenueByMonth
            ];
            break;
            
        case 'performance':
            // Employee performance
            $performance = $db->query(
                "SELECT e.name, COUNT(l.id) as leads_count, 
                 COUNT(m.id) as meetings_count, SUM(i.total_amount) as revenue
                 FROM employees e 
                 LEFT JOIN leads l ON e.id = l.assigned_to 
                 LEFT JOIN meetings m ON e.id = m.organizer_id 
                 LEFT JOIN invoices i ON e.id = i.employee_id 
                 WHERE e.company_id = ? AND e.status = 'active'
                 GROUP BY e.id",
                [$employee['company_id']]
            );
            
            $reports = ['performance' => $performance];
            break;
            
        default:
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid report type']);
            exit();
    }
    
    echo json_encode(['success' => true, 'data' => $reports]);
    
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}
?>