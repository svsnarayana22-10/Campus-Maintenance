# 🏫 Campus Maintenance Reporting System
## 🎓 1st Year Project Review & Viva Preparation Guide

Welcome! This guide is designed to help 1st-year computer science/engineering students present this project confidently during evaluation and ace all viva questions.

---

## 🚀 1. How to Run the Project (2 Easy Steps)

### Step 1: Start the Backend Server
Open your terminal / command prompt, navigate to the `server` directory, and run:
```bash
cd server
node server.js
```
*You will see the message:* `🏫 Server running on port 3000`

### Step 2: Open in Browser
Open your web browser (Chrome / Edge / Firefox / Safari) and visit:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🔑 2. Demo Credentials for Reviewers

- **Student Accounts:**
  - **IECT Student:** `satya@student.edu` / `satya123` (Department: **IECT**)
  - **DE Student:** `de@student.edu` / `de123` (Department: **DE**)
  - **CSE Student:** `john@student.edu` / `student123` (Department: **CSE**)
  - *(Or click "Continue with Google" or "Register here" to create/login with your device accounts live during your presentation!)*

- **Admin Account (Pre-configured):**
  - **Email:** `admin@campus.edu`
  - **Password:** `admin123`

---

## 🌟 3. Key Project Features

### 👤 Student Portal
1. **Google Sign-In & Manual Registration:** Instant login using device Google accounts (`Continue with Google`) or persistent email/password signup. Re-logging in with registered credentials works seamlessly anytime later.
2. **Academic Departments:** Comprehensive branch support including **IECT** (Information Engineering & Computational Tech) and **DE** (Data Engineering & Data Science) alongside CSE, ECE, EEE, Mechanical, Civil, and General Campus.
3. **Submit Maintenance Complaints:** Easy form to log issues with Department, Category (Fan, Light, Water/Plumbing, Furniture, Wi-Fi, Other), Room/Location, Urgency level, Description, and Photo Attachment.
4. **Track Status in Real-Time:** Color-coded badges for complaint status (`Pending`, `In Progress`, `Resolved`).

### 🛡️ Admin Portal
1. **Real Data Display (No Mock Complaints):** Displays pure live data dynamically from the SQLite database.
2. **Overview Dashboard:** Live counter cards showing Total Issues, Pending, In Progress, and Resolved counts.
3. **Branch-Wise Complaints Table:** Filter complaints by Department (IECT, DE, CSE, ECE, EEE, MECH, CIVIL), Category, and Status.
4. **Status Update Action:** Dropdown menu allowing maintenance staff to change any complaint status (e.g. from `Pending` to `In Progress` or `Resolved`).

---

## 🏗️ 4. System Architecture & Tech Stack

```
   [ Student / Admin Frontend ]
    (HTML5 + CSS3 + JavaScript)
                 │
                 ▼  HTTP REST API (fetch JSON)
     [ Express Node.js Backend ]
           (server/server.js)
                 │
                 ▼  Embedded SQLite / MySQL
    [ Persistent Database Engine ]
       (campus_maintenance.db)
```

- **Frontend:** HTML5, CSS3 (Flexbox & Grid), JavaScript (Fetch API, DOM Manipulation, LocalStorage).
- **Backend:** Node.js (v22+ with built-in `node:sqlite`), Express.js REST API framework.
- **Database:**
  - **Local Development (Default):** Built-in zero-config SQLite (`server/campus_maintenance.db`). Runs immediately out-of-the-box without requiring database installation.
  - **Production / Cloud Deployment:** Standard SQL Schema (`server/schema.sql`) provided for cloud MySQL setup.

---

## ☁️ 5. Render Production Deployment Environment Variables

When deploying to Render, configure the following MySQL environment variables under Service Settings:
- `DB_HOST`: Hostname of your cloud MySQL instance.
- `DB_USER`: Username for MySQL connection.
- `DB_PASSWORD`: Password for MySQL connection.
- `DB_NAME`: `campus_maintenance`
- `DB_PORT`: `3306` (or database port)
- `DB_SSL`: `true` (if provider requires SSL)

---

## ❓ 6. Viva Questions & Answers

### Q1: What is Express.js and why did you use it?
**Answer:** Express.js is a lightweight web application framework for Node.js. It simplifies handling HTTP requests (GET, POST), setting up URL routes, and serving static HTML/CSS files to the browser.

### Q2: How does the Frontend communicate with the Backend?
**Answer:** The frontend sends asynchronous HTTP requests using JavaScript's native `fetch()` API with JSON formatted data (`POST /login`, `POST /register`, `POST /complaints/create`, `GET /complaints`). The Node.js backend processes these requests against MySQL and sends back JSON responses.

### Q3: How is user session managed after login?
**Answer:** Upon successful authentication, user information is saved in the browser's `localStorage`. When opening dashboards, JavaScript checks `localStorage` to verify if the student or admin is logged in.

### Q4: How is the database organized?
**Answer:** We have three main MySQL database tables:
- `students`: Stores student credentials (`id`, `name`, `roll_number`, `department`, `email`, `password`, `created_at`).
- `admins`: Stores administrative user credentials (`id`, `name`, `email`, `password`, `created_at`).
- `complaints`: Stores maintenance issue records linked to students via foreign key (`student_id`).

### Q5: Why is MySQL used instead of temporary or local file storage?
**Answer:** MySQL is a production-grade relational database management system. Using MySQL ensures data persistence across page reloads, browser restarts, server restarts, and cloud platform redeployments.
