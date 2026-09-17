-- ========================================================
-- Campus Maintenance Reporting System - Database Schema
-- Designed for 1st Year Project Presentation & Review
-- ========================================================

-- 1. Create Database (If using MySQL)
CREATE DATABASE IF NOT EXISTS campus_maintenance;
USE campus_maintenance;

-- 2. Students Table
CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    roll_number VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Admins Table
CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL
);

-- Insert Default Admin Account
INSERT OR IGNORE INTO admins (name, email, password) 
VALUES ('System Admin', 'admin@campus.edu', 'admin123');

-- 4. Maintenance Complaints Table (With Photo Attachment Support)
CREATE TABLE IF NOT EXISTS complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    student_name VARCHAR(100) NOT NULL,
    roll_number VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    location VARCHAR(100) NOT NULL,
    urgency VARCHAR(20) DEFAULT 'Medium',
    description TEXT NOT NULL,
    image_url LONGTEXT,
    status VARCHAR(30) DEFAULT 'Pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id)
);

-- Sample Data for Demo
INSERT OR IGNORE INTO students (id, name, roll_number, email, password)
VALUES (1, 'John Doe', '24CS001', 'john@student.edu', 'student123');

INSERT OR IGNORE INTO complaints (student_id, student_name, roll_number, category, location, urgency, description, image_url, status)
VALUES 
(1, 'John Doe', '24CS001', 'Fan', 'Block A - Room 102', 'High', 'Ceiling fan is making loud noise and not rotating at full speed.', NULL, 'Pending'),
(1, 'John Doe', '24CS001', 'Light', 'Lab 3 - Desk 12', 'Medium', 'Tubelight flickering continuously.', NULL, 'In Progress');
