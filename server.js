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
    const checkAdmin = db.prepare("SELECT * FROM admins WHERE email = ?").get("admin@campus.edu");
    if (!checkAdmin) {
        db.prepare("INSERT INTO admins (name, email, password) VALUES (?, ?, ?)").run(
            "System Admin",
            "admin@campus.edu",
            "admin123"
        );
    }

    // Pre-seed Demo Students (Ensures login ALWAYS works even after Render container restarts!)
    const demoStudents = [
        { name: "John Doe", roll_number: "24CS001", department: "CSE", email: "john@student.edu", password: "student123" },
        { name: "Satya Narayana", roll_number: "24IE001", department: "IECT", email: "satya@student.edu", password: "satya123" }
    ];

    demoStudents.forEach(s => {
        const check = db.prepare("SELECT * FROM students WHERE email = ?").get(s.email);
        if (!check) {
            db.prepare("INSERT INTO students (name, roll_number, department, email, password) VALUES (?, ?, ?, ?, ?)").run(
                s.name, s.roll_number, s.department, s.email, s.password
            );
        } else {
            db.prepare("UPDATE students SET department = ?, roll_number = ? WHERE email = ?").run(s.department, s.roll_number, s.email);
        }
    });

    // Pre-seed sample complaints across departments
    const checkComplaints = db.prepare("SELECT COUNT(*) as count FROM complaints").get().count;
    if (checkComplaints === 0) {
        const student = db.prepare("SELECT id FROM students WHERE email = ?").get("john@student.edu");
        const studentId = student ? student.id : 1;
        const sampleFanPhoto = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><rect width='200' height='200' fill='%23e2e8f0'/><text x='50%' y='45%' dominant-baseline='middle' text-anchor='middle' font-size='48'>🌀</text><text x='50%' y='70%' dominant-baseline='middle' text-anchor='middle' font-size='14' fill='%23475569'>Damaged Fan Photo</text></svg>";

        const insertStmt = db.prepare(`
            INSERT INTO complaints (student_id, student_name, roll_number, department, category, location, urgency, description, image_url, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        insertStmt.run(studentId, "John Doe", "24CS001", "CSE", "Fan", "CS Lab 1 - Room 204", "High", "Ceiling fan making loud noise.", sampleFanPhoto, "Pending");
        insertStmt.run(studentId, "John Doe", "24CS001", "CSE", "Light", "CS Lab 3 - Desk 12", "Medium", "Tubelight flickering continuously.", null, "In Progress");
        insertStmt.run(studentId, "John Doe", "24CS001", "ECE", "WiFi", "ECE Block - DSP Lab", "High", "Wi-Fi router disconnected in lab.", null, "Pending");
        insertStmt.run(studentId, "John Doe", "24CS001", "EEE", "Light", "Electrical Machine Lab", "High", "Main circuit breaker light tripping.", null, "In Progress");
        insertStmt.run(studentId, "John Doe", "24CS001", "MECH", "Furniture", "Workshop - Bench 4", "Medium", "Desk wooden leg broken.", null, "Resolved");
        insertStmt.run(studentId, "John Doe", "24CS001", "CIVIL", "Water", "Civil Block 2nd Floor", "Medium", "Water tap leaking in washroom.", null, "Pending");
        insertStmt.run(studentId, "John Doe", "24CS001", "General", "Water", "Hostel Block B", "High", "Water cooler not cooling water.", null, "Pending");
    }
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

    try {
        const stmt = db.prepare("INSERT INTO students (name, roll_number, department, email, password) VALUES (?, ?, ?, ?, ?)");
        const result = stmt.run(name, roll_number, department || "CSE", email, password);
        const student = db.prepare("SELECT id, name, roll_number, department, email FROM students WHERE id = ?").get(result.lastInsertRowid);
        return res.json({ success: true, message: "Registration successful! Please login.", student });
    } catch (err) {
        if (err.message && err.message.includes("UNIQUE")) {
            const existing = db.prepare("SELECT id, name, roll_number, department, email FROM students WHERE email = ? OR roll_number = ?").get(email, roll_number);
            if (existing) {
                return res.json({ success: true, message: "Email or Roll Number already registered", student: existing });
            }
            return res.status(400).json({ success: false, message: "Email or Roll Number already registered" });
        }
        return res.status(500).json({ success: false, message: "Registration failed" });
    }
});

app.post("/login", (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    try {
        const student = db.prepare("SELECT id, name, roll_number, department, email FROM students WHERE email = ? AND password = ?").get(email, password);
        if (!student) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }
        return res.json({ success: true, message: "Login successful!", student: student });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Login failed" });
    }
});

app.post("/google-login", (req, res) => {
    const { name, email, google_id } = req.body;
    if (!email) {
        return res.status(400).json({ success: false, message: "Email is required for Google login" });
    }

    try {
        let student = db.prepare("SELECT id, name, roll_number, department, email FROM students WHERE email = ?").get(email);
        
        if (!student) {
            const roll_number = "24GOOG" + Math.floor(100 + Math.random() * 900);
            const studentName = name || email.split("@")[0];
            const stmt = db.prepare("INSERT INTO students (name, roll_number, department, email, password) VALUES (?, ?, ?, ?, ?)");
            const result = stmt.run(studentName, roll_number, "CSE", email, "google_oauth_pass");
            student = db.prepare("SELECT id, name, roll_number, department, email FROM students WHERE id = ?").get(result.lastInsertRowid);
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

    try {
        const admin = db.prepare("SELECT id, name, email FROM admins WHERE email = ? AND password = ?").get(email, password);
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