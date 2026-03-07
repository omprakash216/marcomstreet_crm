<?php
class APIClient {
    private static $baseUrl = 'http://localhost/api/';
    private static $token;

    public static function init() {
        session_start();
        self::$token = $_SESSION['token'] ?? '';
    }

    public static function get($endpoint, $params = []) {
        return self::request('GET', $endpoint, $params);
    }

    public static function post($endpoint, $data = []) {
        return self::request('POST', $endpoint, $data);
    }

    public static function put($endpoint, $data = []) {
        return self::request('PUT', $endpoint, $data);
    }

    public static function delete($endpoint) {
        return self::request('DELETE', $endpoint);
    }

    private static function request($method, $endpoint, $data = []) {
        $url = self::$baseUrl . ltrim($endpoint, '/');
        
        $ch = curl_init();
        
        $headers = [
            'Content-Type: application/json',
            'Authorization: Bearer ' . self::$token
        ];

        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HEADER, false);

        switch ($method) {
            case 'GET':
                if (!empty($data)) {
                    $url .= '?' . http_build_query($data);
                }
                break;

            case 'POST':
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
                break;

            case 'PUT':
                curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
                break;

            case 'DELETE':
                curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
                break;
        }

        curl_setopt($ch, CURLOPT_URL, $url);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $result = json_decode($response, true);
        
        if ($httpCode === 401) {
            // Token expired or invalid
            session_destroy();
            header('Location: ../index.php');
            exit();
        }

        return $result;
    }
}

// Initialize API client
APIClient::init();
?>