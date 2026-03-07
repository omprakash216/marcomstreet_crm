<?php
$currentPage = basename($_SERVER['PHP_SELF']);
$employeeRole = $_SESSION['employee_role'] ?? '';
?>
<div class="col-md-3 col-lg-2 d-md-block bg-light sidebar collapse">
    <div class="position-sticky pt-3">
        <ul class="nav flex-column">
            <li class="nav-item">
                <a class="nav-link <?= $currentPage === 'dashboard.php' ? 'active' : '' ?>" href="dashboard.php">
                    <i class="fas fa-home me-2"></i>
                    Dashboard
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link <?= $currentPage === 'leads.php' ? 'active' : '' ?>" href="leads.php">
                    <i class="fas fa-users me-2"></i>
                    Leads Management
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link <?= $currentPage === 'meetings.php' ? 'active' : '' ?>" href="meetings.php">
                    <i class="fas fa-calendar me-2"></i>
                    Meetings
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link <?= $currentPage === 'tasks.php' ? 'active' : '' ?>" href="tasks.php">
                    <i class="fas fa-tasks me-2"></i>
                    Tasks
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link <?= $currentPage === 'invoices.php' ? 'active' : '' ?>" href="invoices.php">
                    <i class="fas fa-file-invoice me-2"></i>
                    Invoices
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link <?= $currentPage === 'quotations.php' ? 'active' : '' ?>" href="quotations.php">
                    <i class="fas fa-file-contract me-2"></i>
                    Quotations
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link <?= $currentPage === 'reports.php' ? 'active' : '' ?>" href="reports.php">
                    <i class="fas fa-chart-bar me-2"></i>
                    Reports
                </a>
            </li>
            
            <!-- HRMS Section -->
            <li class="nav-item">
                <a class="nav-link <?= $currentPage === 'hrms.php' ? 'active' : '' ?>" href="hrms.php">
                    <i class="fas fa-building me-2"></i>
                    HRMS
                </a>
            </li>
            
            <!-- Admin Section -->
            <?php if ($employeeRole === 'admin'): ?>
                <li class="nav-item">
                    <a class="nav-link <?= $currentPage === 'employees.php' ? 'active' : '' ?>" href="employees.php">
                        <i class="fas fa-user-cog me-2"></i>
                        Employees
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link <?= $currentPage === 'admin.php' ? 'active' : '' ?>" href="admin.php">
                        <i class="fas fa-cogs me-2"></i>
                        Admin Panel
                    </a>
                </li>
            <?php endif; ?>
            
            <!-- Tools Section -->
            <li class="nav-item">
                <a class="nav-link <?= $currentPage === 'checkin.php' ? 'active' : '' ?>" href="checkin.php">
                    <i class="fas fa-fingerprint me-2"></i>
                    Check-in
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link <?= $currentPage === 'chat.php' ? 'active' : '' ?>" href="chat.php">
                    <i class="fas fa-comments me-2"></i>
                    Chat
                </a>
            </li>
        </ul>
        
        <h6 class="sidebar-heading d-flex justify-content-between align-items-center px-3 mt-4 mb-1 text-muted">
            <span>Quick Actions</span>
        </h6>
        <ul class="nav flex-column mb-2">
            <li class="nav-item">
                <a class="nav-link" href="leads.php?action=create">
                    <i class="fas fa-plus-circle me-2"></i>
                    New Lead
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link" href="meetings.php?action=create">
                    <i class="fas fa-calendar-plus me-2"></i>
                    Schedule Meeting
                </a>
            </li>
            <li class="nav-item">
                <a class="nav-link" href="invoices.php?action=create">
                    <i class="fas fa-file-invoice-dollar me-2"></i>
                    Create Invoice
                </a>
            </li>
        </ul>
    </div>
</div>