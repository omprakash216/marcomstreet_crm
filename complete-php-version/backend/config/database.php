<?php
class Database {
    private $host;
    private $user;
    private $password;
    private $database;
    private $connection;

    public function __construct() {
        $this->host = getenv('DB_HOST') ?: 'localhost';
        $this->user = getenv('DB_USER') ?: 'root';
        $this->password = getenv('DB_PASSWORD') ?: '';
        $this->database = getenv('DB_NAME') ?: 'marcom_street_crm';
        $this->connect();
    }

    private function connect() {
        try {
            $this->connection = new mysqli($this->host, $this->user, $this->password, $this->database);
            
            if ($this->connection->connect_error) {
                throw new Exception("Database connection failed: " . $this->connection->connect_error);
            }
            
            $this->connection->set_charset('utf8mb4');
        } catch (Exception $e) {
            error_log($e->getMessage());
            throw $e;
        }
    }

    public function query($sql, $params = []) {
        try {
            $stmt = $this->connection->prepare($sql);
            
            if (!$stmt) {
                throw new Exception("Query preparation failed: " . $this->connection->error);
            }

            if (!empty($params)) {
                $types = '';
                $bindParams = [];
                
                foreach ($params as $param) {
                    if (is_int($param)) {
                        $types .= 'i';
                    } elseif (is_float($param)) {
                        $types .= 'd';
                    } else {
                        $types .= 's';
                    }
                    $bindParams[] = $param;
                }
                
                array_unshift($bindParams, $types);
                $stmt->bind_param(...$bindParams);
            }

            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($result) {
                $rows = [];
                while ($row = $result->fetch_assoc()) {
                    $rows[] = $row;
                }
                return $rows;
            } else {
                return $stmt->affected_rows;
            }
        } catch (Exception $e) {
            error_log($e->getMessage());
            throw $e;
        }
    }

    public function getConnection() {
        return $this->connection;
    }

    public function close() {
        if ($this->connection) {
            $this->connection->close();
        }
    }

    public function __destruct() {
        $this->close();
    }
}

// Global database instance
$db = new Database();
?>