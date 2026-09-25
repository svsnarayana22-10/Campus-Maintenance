const express = require("express");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { DatabaseSync } = require("node:sqlite");

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

let staticDir = path.join(__dirname, "..");
if (!fs.existsSync(path.join(staticDir, "index.html"))) {
    staticDir = __dirname;
}
app.use(express.static(staticDir));

app.use((req, res, next) => {
    const reqPath = req.path;
    if (reqPath.startsWith("/pages/") || reqPath.startsWith("/css/")) {
        const fileBasename = path.basename(reqPath);
        const rootFilePath = path.join(__dirname, fileBasename);
        if (fs.existsSync(rootFilePath)) {
            return res.sendFile(rootFilePath);
        }
    }
    next();
});

const dbPath = path.join(__dirname, "campus_maintenance.db");
const db = new DatabaseSync(dbPath);

function initDb() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            roll_number TEXT NOT NULL UNIQUE,
            department TEXT DEFAULT 'CSE',
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS complaints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            student_name TEXT NOT NULL,
            roll_number TEXT NOT NULL,
            department TEXT DEFAULT 'CSE',
            category TEXT NOT NULL,
            location TEXT NOT NULL,
            urgency TEXT DEFAULT 'Medium',
            description TEXT NOT NULL,
            image_url TEXT,
            status TEXT DEFAULT 'Pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES students(id)
        );
    `);

    try { db.exec("ALTER TABLE students ADD COLUMN department TEXT DEFAULT 'CSE'"); } catch (e) {}
    try { db.exec("ALTER TABLE complaints ADD COLUMN image_url TEXT"); } catch (e) {}
    try { db.exec("ALTER TABLE complaints ADD COLUMN department TEXT DEFAULT 'CSE'"); } catch (e) {}

    // Pre-seed Admin Account
    const checkAdmin = db.prepare("SELECT * FROM admins WHERE LOWER(email) = LOWER(?)").get("admin@campus.edu");
    if (!checkAdmin) {
        db.prepare("INSERT INTO admins (name, email, password) VALUES (?, ?, ?)").run(
            "System Admin",
            "admin@campus.edu",
            "admin123"
        );
    }

    // Pre-seed default student accounts if not existing
    const defaultStudents = [
        { name: "Satya Narayana", roll_number: "24IE001", department: "IECT", email: "satya@student.edu", password: "satya123" },
        { name: "Data Engineer Student", roll_number: "24DE001", department: "DE", email: "de@student.edu", password: "de123" },
        { name: "John Doe", roll_number: "24CS001", department: "CSE", email: "john@student.edu", password: "student123" }
    ];

    defaultStudents.forEach(s => {
        const check = db.prepare("SELECT * FROM students WHERE LOWER(email) = LOWER(?)").get(s.email);
        if (!check) {
            db.prepare("INSERT INTO students (name, roll_number, department, email, password) VALUES (?, ?, ?, ?, ?)").run(
                s.name, s.roll_number, s.department, s.email.toLowerCase(), s.password
            );
        } else {
            db.prepare("UPDATE students SET department = ?, roll_number = ? WHERE LOWER(email) = LOWER(?)").run(s.department, s.roll_number, s.email.toLowerCase());
        }
    });

    // NOTE: All sample mock complaints are removed so Admin Portal only shows real complaints submitted by users!
}

initDb();

app.get("/", (req, res) => {
    const parentIndex = path.join(__dirname, "..", "index.html");
    const localIndex = path.join(__dirname, "index.html");
    
    if (fs.existsSync(parentIndex)) {
        res.sendFile(parentIndex);
    } else if (fs.existsSync(localIndex)) {
        res.sendFile(localIndex);
    } else {
        res.send("Campus Maintenance Server is Running!");
    }
});

app.post("/register", (req, res) => {
    const { name, roll_number, department, email, password } = req.body;
    if (!name || !roll_number || !email || !password) {
        return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanRoll = roll_number.trim();
    const cleanName = name.trim();
    const cleanDept = department || "IECT";

    try {
        const stmt = db.prepare("INSERT INTO students (name, roll_number, department, email, password) VALUES (?, ?, ?, ?, ?)");
        const result = stmt.run(cleanName, cleanRoll, cleanDept, cleanEmail, password);
        const student = db.prepare("SELECT id, name, roll_number, department, email FROM students WHERE id = ?").get(result.lastInsertRowid);
        return res.json({ success: true, message: "Registration successful! Please login.", student });
    } catch (err) {
        if (err.message && err.message.includes("UNIQUE")) {
            // Update existing student's password and department if re-registering
            try {
                db.prepare("UPDATE students SET password = ?, department = ?, name = ? WHERE LOWER(email) = ? OR roll_number = ?").run(password, cleanDept, cleanName, cleanEmail, cleanRoll);
            } catch (uErr) {}
            const existing = db.prepare("SELECT id, name, roll_number, department, email FROM students WHERE LOWER(email) = ? OR roll_number = ?").get(cleanEmail, cleanRoll);
            return res.json({ success: true, message: "Account details updated! Proceeding to login...", student: existing });
        }
        return res.status(500).json({ success: false, message: "Registration failed: " + err.message });
    }
});

app.post("/login", (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const cleanEmail = email.trim().toLowerCase();

    try {
        let student = db.prepare("SELECT id, name, roll_number, department, email FROM students WHERE LOWER(email) = ? AND password = ?").get(cleanEmail, password);
        
        // Fallback check if student exists by email (e.g. initial Google login or password case match)
        if (!student) {
            const checkUser = db.prepare("SELECT id, name, roll_number, department, email, password FROM students WHERE LOWER(email) = ?").get(cleanEmail);
            if (checkUser && (checkUser.password === "google_oauth_pass" || checkUser.password === password)) {
                // Auto update password for user
                db.prepare("UPDATE students SET password = ? WHERE id = ?").run(password, checkUser.id);
                student = { id: checkUser.id, name: checkUser.name, roll_number: checkUser.roll_number, department: checkUser.department, email: checkUser.email };
            }
        }

        if (!student) {
            return res.status(401).json({ success: false, message: "Invalid email or password. Please check your credentials or register." });
        }
        return res.json({ success: true, message: "Login successful!", student: student });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Login failed" });
    }
});

app.post("/google-login", (req, res) => {
    const { name, email, google_id, department, roll_number } = req.body;
    if (!email) {
        return res.status(400).json({ success: false, message: "Email is required for Google login" });
    }

    const cleanEmail = email.trim().toLowerCase();

    try {
        let student = db.prepare("SELECT id, name, roll_number, department, email FROM students WHERE LOWER(email) = ?").get(cleanEmail);
        
        const finalRoll = roll_number || (student ? student.roll_number : "24IE" + Math.floor(100 + Math.random() * 900));
        const finalDept = department || (student ? student.department : "IECT");
        const studentName = name || (student ? student.name : cleanEmail.split("@")[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));

        if (!student) {
            const stmt = db.prepare("INSERT INTO students (name, roll_number, department, email, password) VALUES (?, ?, ?, ?, ?)");
            const result = stmt.run(studentName, finalRoll, finalDept, cleanEmail, "google_oauth_pass");
            student = db.prepare("SELECT id, name, roll_number, department, email FROM students WHERE id = ?").get(result.lastInsertRowid);
        } else {
            db.prepare("UPDATE students SET name = ?, roll_number = ?, department = ? WHERE id = ?").run(studentName, finalRoll, finalDept, student.id);
            student = db.prepare("SELECT id, name, roll_number, department, email FROM students WHERE id = ?").get(student.id);
        }

        return res.json({ success: true, message: "Google Sign-In Successful!", student: student });
    } catch (err) {
        console.error("Google login error:", err);
        return res.status(500).json({ success: false, message: "Google Login failed: " + err.message });
    }
});

app.post("/admin-login", (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const cleanEmail = email.trim().toLowerCase();

    try {
        const admin = db.prepare("SELECT id, name, email FROM admins WHERE LOWER(email) = ? AND password = ?").get(cleanEmail, password);
        if (!admin) {
            return res.status(401).json({ success: false, message: "Invalid admin credentials" });
        }
        return res.json({ success: true, message: "Admin login successful!", admin: admin });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Admin login failed" });
    }
});

app.get("/students", (req, res) => {
    try {
        const students = db.prepare("SELECT id, name, roll_number, department, email, created_at FROM students ORDER BY id DESC").all();
        return res.json({ success: true, students: students });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to fetch students" });
    }
});

app.get("/complaints", (req, res) => {
    const studentId = req.query.student_id;
    try {
        let complaints;
        if (studentId) {
            complaints = db.prepare("SELECT * FROM complaints WHERE student_id = ? ORDER BY id DESC").all(Number(studentId));
            if (complaints.length === 0) {
                complaints = db.prepare("SELECT * FROM complaints ORDER BY id DESC").all();
            }
        } else {
            complaints = db.prepare("SELECT * FROM complaints ORDER BY id DESC").all();
        }
        return res.json({ success: true, complaints: complaints });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to fetch complaints" });
    }
});

app.post("/complaints/create", (req, res) => {
    const { student_id, student_name, roll_number, department, category, location, urgency, description, image_url } = req.body;
    if (!category || !location || !description) {
        return res.status(400).json({ success: false, message: "Missing required complaint details" });
    }

    try {
        let validStudentId = Number(student_id);
        const checkStudent = db.prepare("SELECT id FROM students WHERE id = ?").get(validStudentId);
        if (!checkStudent) {
            const findByRoll = db.prepare("SELECT id FROM students WHERE roll_number = ? OR email = ?").get(roll_number || '', student_name || '');
            if (findByRoll) {
                validStudentId = findByRoll.id;
            } else {
                const firstStudent = db.prepare("SELECT id FROM students LIMIT 1").get();
                validStudentId = firstStudent ? firstStudent.id : 1;
            }
        }

        const stmt = db.prepare(`
            INSERT INTO complaints (student_id, student_name, roll_number, department, category, location, urgency, description, image_url, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
        `);
        stmt.run(
            validStudentId,
            student_name || "Student",
            roll_number || "N/A",
            department || "CSE",
            category,
            location,
            urgency || "Medium",
            description,
            image_url || null
        );
        return res.json({ success: true, message: "Complaint submitted successfully!" });
    } catch (err) {
        console.error("Complaint error:", err);
        return res.status(500).json({ success: false, message: "Failed to submit complaint: " + err.message });
    }
});

app.post("/complaints/update-status", (req, res) => {
    const { complaint_id, status } = req.body;
    if (!complaint_id || !status) {
        return res.status(400).json({ success: false, message: "Complaint ID and new status are required" });
    }

    try {
        const stmt = db.prepare("UPDATE complaints SET status = ? WHERE id = ?");
        const result = stmt.run(status, Number(complaint_id));
        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: "Complaint not found" });
        }
        return res.json({ success: true, message: `Status updated to '${status}' successfully!` });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to update complaint status" });
    }
});

app.get("/stats", (req, res) => {
    try {
        const total = db.prepare("SELECT COUNT(*) as count FROM complaints").get().count;
        const pending = db.prepare("SELECT COUNT(*) as count FROM complaints WHERE status = 'Pending'").get().count;
        const inProgress = db.prepare("SELECT COUNT(*) as count FROM complaints WHERE status = 'In Progress'").get().count;
        const resolved = db.prepare("SELECT COUNT(*) as count FROM complaints WHERE status = 'Resolved'").get().count;

        return res.json({
            success: true,
            stats: { total, pending, inProgress, resolved }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to fetch stats" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});