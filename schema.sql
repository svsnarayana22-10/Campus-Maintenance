-- ========================================================
-- Campus Maintenance Reporting System - MySQL Database Schema
-- Designed for MySQL Database Deployment & Review
-- ========================================================

-- 1. Create Database
CREATE DATABASE IF NOT EXISTS campus_maintenance;
USE campus_maintenance;

-- 2. Students Table
CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    roll_number VARCHAR(50) NOT NULL UNIQUE,
    department VARCHAR(50) NOT NULL DEFAULT 'IECT',
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Admins Table
CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert Default Admin Account
INSERT IGNORE INTO admins (id, name, email, password) 
VALUES (1, 'System Admin', 'admin@campus.edu', 'admin123');

-- 4. Maintenance Complaints Table
CREATE TABLE IF NOT EXISTS complaints (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    student_name VARCHAR(100) NOT NULL,
    roll_number VARCHAR(50) NOT NULL,
    department VARCHAR(50) DEFAULT 'IECT',
    category VARCHAR(50) NOT NULL,
    location VARCHAR(100) NOT NULL,
    urgency VARCHAR(20) DEFAULT 'Medium',
    description TEXT NOT NULL,
    image_url LONGTEXT,
    status VARCHAR(30) DEFAULT 'Pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Pre-seeded Students (IECT, DE, CSE)
INSERT IGNORE INTO students (id, name, roll_number, department, email, password)
VALUES 
(1, 'Satya Narayana', '24IE001', 'IECT', 'satya@student.edu', 'satya123'),
(2, 'Data Engineer Student', '24DE001', 'DE', 'de@student.edu', 'de123'),
(3, 'John Doe', '24CS001', 'CSE', 'john@student.edu', 'student123');

