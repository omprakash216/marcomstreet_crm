<?php
declare(strict_types=1);

/**
 * Serves uploaded PDF files with strict validation and correct headers.
 */
$fileParam = isset($_GET['file']) ? (string) $_GET['file'] : '';
if ($fileParam === '') {
    http_response_code(400);
    header('Content-Type: application/pdf');
    exit;
}

$decodedPath = str_replace('\\', '/', urldecode($fileParam));
$normalized = trim($decodedPath);

// Only allow known document directories inside uploads.
$allowedPrefixes = [
    'uploads/hr_documents/',
    'uploads/salary_slips/',
];

$isAllowed = false;
foreach ($allowedPrefixes as $prefix) {
    if (strpos($normalized, $prefix) === 0) {
        $isAllowed = true;
        break;
    }
}

if (!$isAllowed) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Access denied.';
    exit;
}

$projectRoot = realpath(dirname(__DIR__, 2));
$uploadsRoot = realpath($projectRoot . DIRECTORY_SEPARATOR . 'uploads');

if ($projectRoot === false || $uploadsRoot === false) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Server path configuration error.';
    exit;
}

$targetPath = realpath($projectRoot . DIRECTORY_SEPARATOR . $normalized);
if ($targetPath === false || strpos($targetPath, $uploadsRoot) !== 0) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Invalid file path.';
    exit;
}

if (!is_file($targetPath)) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'PDF file not found.';
    exit;
}

if (strtolower(pathinfo($targetPath, PATHINFO_EXTENSION)) !== 'pdf') {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Invalid file type.';
    exit;
}

$size = filesize($targetPath);
if ($size === false || $size < 100) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Invalid PDF size.';
    exit;
}

$fp = fopen($targetPath, 'rb');
if ($fp === false) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Failed to open PDF.';
    exit;
}

$signature = fread($fp, 4);
fclose($fp);

if ($signature !== '%PDF') {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Invalid PDF format.';
    exit;
}

header('Content-Type: application/pdf');
header('Content-Length: ' . (string) $size);
header('Content-Disposition: inline; filename="' . basename($targetPath) . '"');
header('Cache-Control: private, max-age=3600, must-revalidate');
header('X-Content-Type-Options: nosniff');
header('Accept-Ranges: bytes');

readfile($targetPath);
