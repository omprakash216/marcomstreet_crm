<?php
declare(strict_types=1);

/**
 * Find the largest asset file that matches a glob pattern.
 * This keeps index.php resilient to hashed Vite filenames.
 */
function marcom_find_asset(string $assetsDir, string $pattern, array $excludeSubstrings = []): ?string
{
    $files = glob($assetsDir . DIRECTORY_SEPARATOR . $pattern) ?: [];
    $candidates = [];

    foreach ($files as $file) {
        if (!is_file($file)) {
            continue;
        }

        $name = basename($file);
        $excluded = false;
        foreach ($excludeSubstrings as $exclude) {
            if ($exclude !== '' && strpos($name, $exclude) !== false) {
                $excluded = true;
                break;
            }
        }

        if (!$excluded) {
            $candidates[] = $file;
        }
    }

    if (empty($candidates)) {
        return null;
    }

    usort(
        $candidates,
        static function (string $a, string $b): int {
            return (filesize($b) ?: 0) <=> (filesize($a) ?: 0);
        }
    );

    return basename($candidates[0]);
}

function marcom_render_react_spa(?string $routeOverride = null, string $title = 'MARCOM STREET CRM - Employee Portal'): void
{
    $assetsDir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'assets';

    $entryJs = marcom_find_asset($assetsDir, 'index.*.js', ['index.es.', '.map']);
    if ($entryJs === null) {
        $entryJs = marcom_find_asset($assetsDir, '*.js', ['.map']);
    }

    $entryCss = marcom_find_asset($assetsDir, 'index.*.css', ['.map']);
    $logo = marcom_find_asset($assetsDir, 'MS_LOGO2.*');
    $vendorJs = marcom_find_asset($assetsDir, 'vendor.*.js', ['.map']);
    $chartsJs = marcom_find_asset($assetsDir, 'charts.*.js', ['.map']);

    $normalizedRoute = null;
    if ($routeOverride !== null && trim($routeOverride) !== '') {
        $normalizedRoute = '/' . ltrim(trim($routeOverride), '/');
    }

    header('Content-Type: text/html; charset=utf-8');
    http_response_code(200);
    ?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title><?= htmlspecialchars($title, ENT_QUOTES, 'UTF-8') ?></title>
<?php if ($logo !== null): ?>
  <link rel="icon" type="image/png" href="/assets/<?= rawurlencode($logo) ?>" />
<?php endif; ?>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" />
<?php if ($vendorJs !== null): ?>
  <link rel="modulepreload" crossorigin href="/assets/<?= rawurlencode($vendorJs) ?>" />
<?php endif; ?>
<?php if ($chartsJs !== null): ?>
  <link rel="modulepreload" crossorigin href="/assets/<?= rawurlencode($chartsJs) ?>" />
<?php endif; ?>
<?php if ($entryCss !== null): ?>
  <link rel="stylesheet" crossorigin href="/assets/<?= rawurlencode($entryCss) ?>" />
<?php endif; ?>
</head>
<body>
<?php if ($normalizedRoute !== null): ?>
  <script>
    (function () {
      var target = <?= json_encode($normalizedRoute, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
      if (window.location.pathname !== target) {
        window.history.replaceState({}, '', target + window.location.search + window.location.hash);
      }
    })();
  </script>
<?php endif; ?>
  <div id="root"></div>
<?php if ($entryJs !== null): ?>
  <script type="module" crossorigin src="/assets/<?= rawurlencode($entryJs) ?>"></script>
<?php else: ?>
  <main style="font-family:Arial,sans-serif;padding:24px;color:#991b1b;">
    React build assets not found. Run `npm run build` in `frontend` and sync `dist/assets` to `complete-php-version/frontend/assets`.
  </main>
<?php endif; ?>
</body>
</html>
<?php
}
