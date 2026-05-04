CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS opportunities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    duration TEXT NOT NULL,
    start_date TEXT NOT NULL,
    description TEXT NOT NULL,
    skills_json TEXT NOT NULL,
    category TEXT NOT NULL,
    future_opportunities TEXT NOT NULL,
    max_applicants INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (admin_id) REFERENCES admins (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (admin_id) REFERENCES admins (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id_str TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active',
    enrolled_courses_count INTEGER DEFAULT 0,
    certificates_count INTEGER DEFAULT 0,
    last_login TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS verifiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    verifier_id_str TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    enrolled_count INTEGER DEFAULT 0,
    completed_count INTEGER DEFAULT 0,
    in_progress_count INTEGER DEFAULT 0,
    half_done_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
);
