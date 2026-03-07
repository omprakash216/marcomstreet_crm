<?php
require_once __DIR__ . '/../middleware/auth.php';

global $db;

$employee = AuthMiddleware::verifyToken();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $action = $_GET['action'] ?? '';
    
    if ($action === 'leaves') {
        // Get leave requests
        $leaves = $db->query(
            "SELECT l.*, e.name as employee_name 
             FROM leave_requests l 
             LEFT JOIN employees e ON l.employee_id = e.id 
             WHERE l.company_id = ? ORDER BY l.created_at DESC",
            [$employee['company_id']]
        );
        
        echo json_encode(['success' => true, 'data' => $leaves]);
        
    } elseif ($action === 'attendance') {
        // Get attendance records
        $attendance = $db->query(
            "SELECT a.*, e.name as employee_name 
             FROM attendance a 
             LEFT JOIN employees e ON a.employee_id = e.id 
             WHERE a.company_id = ? ORDER BY a.date DESC",
            [$employee['company_id']]
        );
        
        echo json_encode(['success' => true, 'data' => $attendance]);
        
    } else {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
    }
    
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_GET['action'] ?? '';
    
    if ($action === 'apply-leave') {
        // Apply for leave
        $leaveData = [
            'employee_id' => $employee['id'],
            'leave_type' => $input['leave_type'] ?? 'casual',
            'start_date' => $input['start_date'] ?? '',
            'end_date' => $input['end_date'] ?? '',
            'reason' => $input['reason'] ?? '',
            'status' => 'pending',
            'company_id' => $employee['company_id']
        ];
        
        $result = $db->query(
            "INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason, status, company_id) 
             VALUES (?, ?, ?, ?, ?, ?, ?)",
            array_values($leaveData)
        );
        
        if ($result) {
            echo json_encode(['success' => true, 'message' => 'Leave application submitted']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to apply for leave']);
        }
        
    } elseif ($action === 'mark-attendance') {
        // Mark attendance
        $attendanceData = [
            'employee_id' => $employee['id'],
            'date' => $input['date'] ?? date('Y-m-d'),
            'status' => $input['status'] ?? 'present',
            'check_in_time' => $input['check_in_time'] ?? date('H:i:s'),
            'check_out_time' => $input['check_out_time'] ?? null,
            'company_id' => $employee['company_id']
        ];
        
        $result = $db->query(
            "INSERT INTO attendance (employee_id, date, status, check_in_time, check_out_time, company_id) 
             VALUES (?, ?, ?, ?, ?, ?)",
            array_values($attendanceData)
        );
        
        if ($result) {
            echo json_encode(['success' => true, 'message' => 'Attendance marked']);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to mark attendance']);
        }
        
    } else {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
    }
    
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}
?>