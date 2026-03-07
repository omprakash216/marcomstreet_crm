<?php
session_start();

// Check if user is logged in
if (!isset($_SESSION['employee'])) {
    header('Location: index.php');
    exit();
}

$employee = $_SESSION['employee'];
$token = $_SESSION['token'];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - MARCOM STREET CRM</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
                'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
                sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        .sidebar {
            background: linear-gradient(180deg, #4f46e5 0%, #7c3aed 100%);
        }

        .nav-item {
            transition: all 0.2s;
        }

        .nav-item:hover {
            background: rgba(255, 255, 255, 0.1);
            transform: translateX(4px);
        }

        .nav-item.active {
            background: rgba(255, 255, 255, 0.15);
            border-left: 4px solid white;
        }

        .stats-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
    </style>
</head>
<body class="bg-gray-100">
    <!-- Sidebar -->
    <div class="sidebar min-h-screen w-64 fixed left-0 top-0 text-white">
        <!-- Logo -->
        <div class="p-6 border-b border-white/10">
            <div class="text-2xl font-bold">MARCOM STREET</div>
            <div class="text-sm opacity-80">CRM Portal</div>
        </div>

        <!-- User Info -->
        <div class="p-4 border-b border-white/10">
            <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <i class="fas fa-user text-white"></i>
                </div>
                <div>
                    <div class="font-semibold"><?php echo htmlspecialchars($employee['name']); ?></div>
                    <div class="text-xs opacity-80"><?php echo htmlspecialchars($employee['role']); ?></div>
                </div>
            </div>
        </div>

        <!-- Navigation -->
        <nav class="p-4 space-y-2">
            <a href="#" class="nav-item active flex items-center space-x-3 p-3 rounded-lg">
                <i class="fas fa-home w-5"></i>
                <span>Dashboard</span>
            </a>
            <a href="#" class="nav-item flex items-center space-x-3 p-3 rounded-lg">
                <i class="fas fa-users w-5"></i>
                <span>Leads</span>
            </a>
            <a href="#" class="nav-item flex items-center space-x-3 p-3 rounded-lg">
                <i class="fas fa-calendar w-5"></i>
                <span>Meetings</span>
            </a>
            <a href="#" class="nav-item flex items-center space-x-3 p-3 rounded-lg">
                <i class="fas fa-file-invoice w-5"></i>
                <span>Invoices</span>
            </a>
            <a href="#" class="nav-item flex items-center space-x-3 p-3 rounded-lg">
                <i class="fas fa-chart-line w-5"></i>
                <span>Reports</span>
            </a>
        </nav>

        <!-- Logout -->
        <div class="absolute bottom-4 left-4 right-4">
            <form method="POST" action="logout.php">
                <button type="submit" class="nav-item flex items-center space-x-3 p-3 rounded-lg w-full text-left">
                    <i class="fas fa-sign-out-alt w-5"></i>
                    <span>Logout</span>
                </button>
            </form>
        </div>
    </div>

    <!-- Main Content -->
    <div class="ml-64 min-h-screen">
        <!-- Header -->
        <header class="bg-white border-b border-gray-200 p-4">
            <div class="flex justify-between items-center">
                <h1 class="text-2xl font-bold text-gray-800">Dashboard</h1>
                <div class="flex items-center space-x-4">
                    <div class="relative">
                        <i class="fas fa-bell text-gray-600"></i>
                        <span class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">3</span>
                    </div>
                    <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <span class="text-white font-semibold"><?php echo strtoupper(substr($employee['name'], 0, 1)); ?></span>
                    </div>
                </div>
            </div>
        </header>

        <!-- Dashboard Content -->
        <main class="p-6">
            <!-- Stats Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div class="stats-card rounded-xl p-6 shadow-lg">
                    <div class="flex justify-between items-start">
                        <div>
                            <div class="text-2xl font-bold">142</div>
                            <div class="text-sm opacity-90">Total Leads</div>
                        </div>
                        <i class="fas fa-users text-2xl opacity-80"></i>
                    </div>
                    <div class="mt-4 text-xs opacity-80">+12 this week</div>
                </div>

                <div class="stats-card rounded-xl p-6 shadow-lg">
                    <div class="flex justify-between items-start">
                        <div>
                            <div class="text-2xl font-bold">28</div>
                            <div class="text-sm opacity-90">Meetings</div>
                        </div>
                        <i class="fas fa-calendar text-2xl opacity-80"></i>
                    </div>
                    <div class="mt-4 text-xs opacity-80">+5 today</div>
                </div>

                <div class="stats-card rounded-xl p-6 shadow-lg">
                    <div class="flex justify-between items-start">
                        <div>
                            <div class="text-2xl font-bold">₹1.2L</div>
                            <div class="text-sm opacity-90">Revenue</div>
                        </div>
                        <i class="fas fa-rupee-sign text-2xl opacity-80"></i>
                    </div>
                    <div class="mt-4 text-xs opacity-80">+₹25K this month</div>
                </div>

                <div class="stats-card rounded-xl p-6 shadow-lg">
                    <div class="flex justify-between items-start">
                        <div>
                            <div class="text-2xl font-bold">87%</div>
                            <div class="text-sm opacity-90">Conversion</div>
                        </div>
                        <i class="fas fa-chart-line text-2xl opacity-80"></i>
                    </div>
                    <div class="mt-4 text-xs opacity-80">+3% from last month</div>
                </div>
            </div>

            <!-- Recent Activity -->
            <div class="bg-white rounded-xl shadow-lg p-6">
                <h2 class="text-xl font-semibold mb-4">Recent Activity</h2>
                <div class="space-y-3">
                    <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div class="flex items-center space-x-3">
                            <div class="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                <i class="fas fa-check text-green-600 text-sm"></i>
                            </div>
                            <div>
                                <div class="font-medium">New lead assigned</div>
                                <div class="text-sm text-gray-500">Rajesh Enterprises</div>
                            </div>
                        </div>
                        <div class="text-sm text-gray-500">2 hours ago</div>
                    </div>

                    <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div class="flex items-center space-x-3">
                            <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <i class="fas fa-calendar text-blue-600 text-sm"></i>
                            </div>
                            <div>
                                <div class="font-medium">Meeting scheduled</div>
                                <div class="text-sm text-gray-500">With Tech Solutions Inc.</div>
                            </div>
                        </div>
                        <div class="text-sm text-gray-500">Yesterday</div>
                    </div>

                    <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div class="flex items-center space-x-3">
                            <div class="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                                <i class="fas fa-file-invoice text-purple-600 text-sm"></i>
                            </div>
                            <div>
                                <div class="font-medium">Invoice generated</div>
                                <div class="text-sm text-gray-500">INV-2024-001</div>
                            </div>
                        </div>
                        <div class="text-sm text-gray-500">2 days ago</div>
                    </div>
                </div>
            </div>
        </main>
    </div>
</body>
</html>