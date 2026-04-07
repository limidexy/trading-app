-- Imperial Ledger Database Schema
-- Use the default 'test' database in TiDB Cloud
USE test;

-- Table for Daily Thinking
CREATE TABLE IF NOT EXISTS daily_thinking (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL,
    question_id VARCHAR(10) NOT NULL,
    answer TEXT,
    style VARCHAR(20), -- '连板型' or '趋势型'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for Tomorrow Plan
CREATE TABLE IF NOT EXISTS tomorrow_plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL,
    plan_item TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for Today Reflection
CREATE TABLE IF NOT EXISTS today_reflections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL,
    reflection_text TEXT,
    file_url VARCHAR(255), -- URL to the uploaded file (OSS/COS)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for Today Operation
CREATE TABLE IF NOT EXISTS today_operations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL,
    stock_name VARCHAR(100),
    logic TEXT,
    profit_loss DECIMAL(10, 2),
    screenshot_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
