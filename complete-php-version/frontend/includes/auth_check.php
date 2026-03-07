<?php
session_start();

// Redirect to login if not authenticated
if (!isset($_SESSION['employee_id'])) {
    header('Location: ../index.php');
    exit();
}

// Check if token is still valid (optional - can be enhanced with API call)
if (isset($_SESSION['token_expiry']) && time() > $_SESSION['token_expiry']) {
    session_destroy();
    header('Location: ../index.php');
    exit();
}
?>