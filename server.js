const express = require("express");
const path = require("path");
const os = require("os");
const { DatabaseSync } = require("node:sqlite");

const app = express();

// Parse JSON with larger limit for base64 image uploads (up to 10MB)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve static files from the root project directory
app.use(express.static(path.join(__dirname, "..")));

// Initialize SQLite database
const dbPath = path.join(__dirname, "campus_maintenance.db");
const db = new DatabaseSync(dbPath);

// Initialize database tables
function initDb() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            roll_number TEXT NOT NULL UNIQUE,
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

    try {
        db.exec("ALTER TABLE complaints ADD COLUMN image_url TEXT");
    } catch (e) {}

    const checkAdmin = db.prepare("SELECT * FROM admins WHERE email = ?").get("admin@campus.edu");
    if (!checkAdmin) {
        db.prepare("INSERT INTO admins (name, email, password) VALUES (?, ?, ?)").run(
            "System Admin",
            "admin@campus.edu",
            "admin123"
        );
    }

    const checkStudent = db.prepare("SELECT * FROM students WHERE email = ?").get("john@student.edu");
    if (!checkStudent) {
        const studentResult = db.prepare(
            "INSERT INTO students (name, roll_number, email, password) VALUES (?, ?, ?, ?)"
        ).run("John Doe", "24CS001", "john@student.edu", "student123");

        const studentId = studentResult.lastInsertRowid;
        const sampleFanPhoto = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><rect width='200' height='200' fill='%23e2e8f0'/><text x='50%' y='45%' dominant-baseline='middle' text-anchor='middle' font-size='48'>🌀</text><text x='50%' y='70%' dominant-baseline='middle' text-anchor='middle' font-size='14' fill='%23475569'>Damaged Fan Photo</text></svg>";

        db.prepare(`
            INSERT INTO complaints (student_id, student_name, roll_number, category, location, urgency, description, image_url, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(studentId, "John Doe", "24CS001", "Fan", "Block A - Room 102", "High", "Ceiling fan making loud noise.", sampleFanPhoto, "Pending");

        db.prepare(`
            INSERT INTO complaints (student_id, student_name, roll_number, category, location, urgency, description, image_url, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(studentId, "John Doe", "24CS001", "Light", "Lab 3 - Desk 12", "Medium", "Tubelight flickering continuously.", null, "In Progress");
    }
}

initDb();

// Routes
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "index.html"));
});

app.post("/register", (req, res) => {
    const { name, roll_number, email, password } = req.body;
    if (!name || !roll_number || !email || !password) {
        return res.status(400).json({ success: false, message: "All fields are required" });
    }

    try {
        const stmt = db.prepare("INSERT INTO students (name, roll_number, email, password) VALUES (?, ?, ?, ?)");
        stmt.run(name, roll_number, email, password);
        return res.json({ success: true, message: "Registration successful! Please login." });
    } catch (err) {
        if (err.message && err.message.includes("UNIQUE")) {
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
        const student = db.prepare("SELECT id, name, roll_number, email FROM students WHERE email = ? AND password = ?").get(email, password);
        if (!student) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }
        return res.json({ success: true, message: "Login successful!", student: student });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Login failed" });
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

app.get("/complaints", (req, res) => {
    const studentId = req.query.student_id;
    try {
        let complaints;
        if (studentId) {
            complaints = db.prepare("SELECT * FROM complaints WHERE student_id = ? ORDER BY id DESC").all(Number(studentId));
        } else {
            complaints = db.prepare("SELECT * FROM complaints ORDER BY id DESC").all();
        }
        return res.json({ success: true, complaints: complaints });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to fetch complaints" });
    }
});

app.post("/complaints/create", (req, res) => {
    const { student_id, student_name, roll_number, category, location, urgency, description, image_url } = req.body;
    if (!student_id || !category || !location || !description) {
        return res.status(400).json({ success: false, message: "Missing required complaint details" });
    }

    try {
        const stmt = db.prepare(`
            INSERT INTO complaints (student_id, student_name, roll_number, category, location, urgency, description, image_url, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
        `);
        stmt.run(
            Number(student_id),
            student_name || "Student",
            roll_number || "N/A",
            category,
            location,
            urgency || "Medium",
            description,
            image_url || null
        );
        return res.json({ success: true, message: "Complaint submitted successfully!" });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to submit complaint" });
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

// Auto-detect Local Wi-Fi IP Address
function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return '127.0.0.1';
}

const PORT = process.env.PORT || 3000;
const localIp = getLocalIpAddress();

// Bind to '0.0.0.0' to accept connections from phones/other computers on the same Wi-Fi
app.listen(PORT, "0.0.0.0", () => {
    console.log(`===================================================`);
    console.log(`🏫 Campus Maintenance Server Running!`);
    console.log(`💻 On your Mac: http://localhost:${PORT}`);
    console.log(`📱 On Mobile / Other Laptops (Same Wi-Fi): http://${localIp}:${PORT}`);
    console.log(`===================================================`);
});