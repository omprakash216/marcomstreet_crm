<?php
declare(strict_types=1);

/**
 * Serves files from /uploads safely.
 */
$relativeFile = isset($_GET['file']) ? (string) $_GET['file'] : '';
$relativeFile = str_replace('\\', '/', urldecode($relativeFile));
$relativeFile = ltrim($relativeFile, '/');

if ($relativeFile === '' || strpos($relativeFile, '..') !== false) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Invalid file.';
    exit;
}

$uploadsRoot = realpath(dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'uploads');
if ($uploadsRoot === false) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Uploads directory not configured.';
    exit;
}

$targetPath = realpath($uploadsRoot . DIRECTORY_SEPARATOR . $relativeFile);
if ($targetPath === false || strpos($targetPath, $uploadsRoot) !== 0 || !is_file($targetPath)) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'File not found.';
    exit;
}

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime = $finfo ? finfo_file($finfo, $targetPath) : 'application/octet-stream';
if ($finfo) {
    finfo_close($finfo);
}

$size = filesize($targetPath);

header('Content-Type: ' . ($mime ?: 'application/octet-stream'));
if ($size !== false) {
    header('Content-Length: ' . (string) $size);
}
header('Content-Disposition: inline; filename="' . basename($targetPath) . '"');
header('Cache-Control: private, max-age=1800');
header('X-Content-Type-Options: nosniff');

readfile($targetPath);
