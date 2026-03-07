<?php
declare(strict_types=1);

/**
 * Frontend API bridge:
 * /api/* -> ../backend/index.php
 */
$path = $_GET['__path'] ?? '';
if (!is_string($path)) {
    $path = '';
}
$path = trim($path, '/');

unset($_GET['__path']);

$_SERVER['REQUEST_URI'] = '/api' . ($path !== '' ? '/' . $path : '');
$_SERVER['QUERY_STRING'] = http_build_query($_GET);

require_once dirname(__DIR__, 2) . '/backend/index.php';
