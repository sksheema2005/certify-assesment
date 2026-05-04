import hashlib
import json
import logging
import os
import re
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path

from flask import Flask, g, jsonify, render_template, request, send_from_directory, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash


BASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = BASE_DIR / "instance" / "admin_portal.db"
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
ALLOWED_CATEGORIES = {
    "technology": "Technology",
    "business": "Business",
    "design": "Design",
    "marketing": "Marketing",
    "data science": "Data Science",
    "other": "Other",
}


app = Flask(__name__, static_folder="sky", static_url_path="")
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "qf-admin-portal-dev-secret")
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=30)

app.config["SESSION_COOKIE_SAMESITE"] = "None"
app.config["SESSION_COOKIE_SECURE"] = True
app.config["SESSION_COOKIE_PARTITIONED"] = True
app.config["PREFERRED_URL_SCHEME"] = "https"

logging.basicConfig(level=logging.INFO)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def to_iso(value: datetime) -> str:
    return value.isoformat()


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
        g.db = sqlite3.connect(DATABASE_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def close_db(_error):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db() -> None:
    db = get_db()
    with open(BASE_DIR / "schema.sql", "r", encoding="utf-8") as schema_file:
        db.executescript(schema_file.read())
    db.commit()


def ensure_db() -> None:
    if not DATABASE_PATH.exists():
        init_db()


def json_error(message: str, status_code: int = 400):
    return jsonify({"error": message}), status_code


def require_json() -> dict:
    return request.get_json(silent=True) or {}


def validate_email(email: str) -> bool:
    return bool(email and EMAIL_PATTERN.match(email))


def normalize_category(category: str) -> str | None:
    normalized = " ".join((category or "").strip().lower().replace("_", " ").split())
    if normalized == "data":
        normalized = "data science"
    return normalized if normalized in ALLOWED_CATEGORIES else None


def row_to_admin(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "full_name": row["full_name"],
        "email": row["email"],
    }


def row_to_student(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "student_id": row["student_id_str"],
        "full_name": row["full_name"],
        "email": row["email"],
        "status": row["status"],
        "enrolled_courses": row["enrolled_courses_count"],
        "certificates": row["certificates_count"],
        "last_login": row["last_login"] or "Never",
    }


def row_to_verifier(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "verifier_id": row["verifier_id_str"],
        "full_name": row["full_name"],
        "email": row["email"],
        "status": row["status"],
    }


def row_to_course(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "category": row["category"],
        "stats": {
            "enrolled": row["enrolled_count"],
            "completed": row["completed_count"],
            "in_progress": row["in_progress_count"],
            "half_done": row["half_done_count"],
        },
    }


def row_to_opportunity(row: sqlite3.Row) -> dict:
    skills = json.loads(row["skills_json"])
    return {
        "id": row["id"],
        "name": row["name"],
        "duration": row["duration"],
        "start_date": row["start_date"],
        "description": row["description"],
        "skills": skills,
        "category": row["category"],
        "future_opportunities": row["future_opportunities"],
        "max_applicants": row["max_applicants"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def get_current_admin() -> sqlite3.Row | None:
    admin_id = session.get("admin_id")
    if not admin_id:
        return None
    db = get_db()
    return db.execute("SELECT id, full_name, email FROM admins WHERE id = ?", (admin_id,)).fetchone()


def login_required(route):
    @wraps(route)
    def wrapped(*args, **kwargs):
        if not get_current_admin():
            return json_error("Authentication required", 401)
        return route(*args, **kwargs)

    return wrapped


def parse_opportunity_payload(payload: dict):
    name = (payload.get("name") or "").strip()
    duration = (payload.get("duration") or "").strip()
    start_date = (payload.get("start_date") or "").strip()
    description = (payload.get("description") or "").strip()
    future_opportunities = (payload.get("future_opportunities") or "").strip()
    category_key = normalize_category(payload.get("category") or "")
    skills_input = payload.get("skills")
    if isinstance(skills_input, str):
        skills = [skill.strip() for skill in skills_input.split(",") if skill.strip()]
    else:
        skills = [str(skill).strip() for skill in (skills_input or []) if str(skill).strip()]
    max_applicants_value = payload.get("max_applicants")

    if not all([name, duration, start_date, description, future_opportunities, category_key]) or not skills:
        return None, "Please fill all required fields."

    try:
        datetime.strptime(start_date, "%Y-%m-%d")
    except ValueError:
        return None, "Start date must be a valid date."

    max_applicants = None
    if max_applicants_value not in (None, ""):
        try:
            max_applicants = int(max_applicants_value)
        except (TypeError, ValueError):
            return None, "Maximum applicants must be a valid number."
        if max_applicants < 1:
            return None, "Maximum applicants must be greater than zero."

    return {
        "name": name,
        "duration": duration,
        "start_date": start_date,
        "description": description,
        "skills": skills,
        "category": ALLOWED_CATEGORIES[category_key],
        "future_opportunities": future_opportunities,
        "max_applicants": max_applicants,
    }, None


def get_reset_token_record(token: str) -> sqlite3.Row | None:
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    db = get_db()
    return db.execute(
        """
        SELECT prt.*, a.email
        FROM password_reset_tokens prt
        JOIN admins a ON a.id = prt.admin_id
        WHERE prt.token_hash = ?
        """,
        (token_hash,),
    ).fetchone()


def token_error(token_row: sqlite3.Row | None) -> str | None:
    if token_row is None:
        return "This password reset link is invalid."
    if token_row["used_at"]:
        return "This password reset link has already been used."
    if datetime.fromisoformat(token_row["expires_at"]) < utc_now():
        return "This password reset link has expired."
    return None


@app.route("/")
def index():
    ensure_db()
    return send_from_directory(os.path.join(app.root_path, app.static_folder), "admin.html")


@app.route("/admin.css")
def admin_css():
    return send_from_directory(app.static_folder, "admin.css")


@app.route("/admin.js")
def admin_js():
    return send_from_directory(app.static_folder, "admin.js")


@app.route("/api/session", methods=["GET"])
def session_status():
    ensure_db()
    admin = get_current_admin()
    if not admin:
        return jsonify({"authenticated": False})
    return jsonify({"authenticated": True, "admin": row_to_admin(admin)})


@app.route("/api/auth/signup", methods=["POST"])
def signup():
    ensure_db()
    payload = require_json()
    full_name = (payload.get("full_name") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    confirm_password = payload.get("confirm_password") or ""

    if not all([full_name, email, password, confirm_password]):
        return json_error("All fields are required.")
    if not validate_email(email):
        return json_error("Please enter a valid email address.")
    if len(password) < 8:
        return json_error("Password must be at least 8 characters long.")
    if password != confirm_password:
        return json_error("Passwords do not match.")

    db = get_db()
    existing_admin = db.execute("SELECT id FROM admins WHERE email = ?", (email,)).fetchone()
    if existing_admin:
        return json_error("An account with this email already exists.", 409)

    db.execute(
        "INSERT INTO admins (full_name, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
        (full_name, email, generate_password_hash(password), to_iso(utc_now())),
    )
    db.commit()
    return jsonify({"message": "Account created successfully."}), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    ensure_db()
    payload = require_json()
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    remember_me = bool(payload.get("remember_me"))

    if not email or not password:
        return json_error("Invalid email or password.", 401)

    db = get_db()
    admin = db.execute("SELECT * FROM admins WHERE email = ?", (email,)).fetchone()
    if not admin or not check_password_hash(admin["password_hash"], password):
        return json_error("Invalid email or password.", 401)

    session.clear()
    session["admin_id"] = admin["id"]
    session.permanent = remember_me

    return jsonify({"message": "Login successful.", "admin": row_to_admin(admin)})


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out successfully."})


@app.route("/api/auth/forgot-password", methods=["POST"])
def forgot_password():
    ensure_db()
    payload = require_json()
    email = (payload.get("email") or "").strip().lower()
    if not validate_email(email):
        return json_error("Please enter a valid email address.")

    db = get_db()
    admin = db.execute("SELECT id, email FROM admins WHERE email = ?", (email,)).fetchone()
    if admin:
        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        db.execute(
            "DELETE FROM password_reset_tokens WHERE admin_id = ? OR expires_at < ? OR used_at IS NOT NULL",
            (admin["id"], to_iso(utc_now())),
        )
        db.execute(
            "INSERT INTO password_reset_tokens (admin_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)",
            (admin["id"], token_hash, to_iso(utc_now() + timedelta(hours=1)), to_iso(utc_now())),
        )
        db.commit()
        reset_link = url_for("reset_password", token=raw_token, _external=True)
        app.logger.info("Password reset link for %s: %s", admin["email"], reset_link)

    return jsonify({"message": "If the email is registered, a password reset link has been generated."})


@app.route("/reset-password/<token>", methods=["GET", "POST"])
def reset_password(token: str):
    ensure_db()
    token_row = get_reset_token_record(token)
    error = token_error(token_row)
    if error:
        return render_template(
            "reset_password.html",
            title="Reset Link Unavailable",
            message="Password reset links stay active for 1 hour.",
            error=error,
        ), 400

    if request.method == "POST":
        password = request.form.get("password", "")
        confirm_password = request.form.get("confirm_password", "")
        if len(password) < 8:
            return render_template(
                "reset_password.html",
                title="Create a New Password",
                message=f"Resetting access for {token_row['email']}.",
                form_error="Password must be at least 8 characters long.",
            ), 400
        if password != confirm_password:
            return render_template(
                "reset_password.html",
                title="Create a New Password",
                message=f"Resetting access for {token_row['email']}.",
                form_error="Passwords do not match.",
            ), 400

        db = get_db()
        db.execute(
            "UPDATE admins SET password_hash = ? WHERE id = ?",
            (generate_password_hash(password), token_row["admin_id"]),
        )
        db.execute(
            "UPDATE password_reset_tokens SET used_at = ? WHERE id = ?",
            (to_iso(utc_now()), token_row["id"]),
        )
        db.commit()
        return render_template(
            "reset_password.html",
            title="Password Updated",
            message="Your password has been reset successfully.",
            success="You can now sign in to the admin portal with your new password.",
        )

    return render_template(
        "reset_password.html",
        title="Create a New Password",
        message=f"Resetting access for {token_row['email']}. This link expires 1 hour after it is created.",
    )


@app.route("/api/opportunities", methods=["GET"])
@login_required
def list_opportunities():
    db = get_db()
    admin = get_current_admin()
    rows = db.execute(
        "SELECT * FROM opportunities WHERE admin_id = ? ORDER BY datetime(created_at) DESC, id DESC",
        (admin["id"],),
    ).fetchall()
    return jsonify({"opportunities": [row_to_opportunity(row) for row in rows]})


@app.route("/api/opportunities", methods=["POST"])
@login_required
def create_opportunity():
    payload, error = parse_opportunity_payload(require_json())
    if error:
        return json_error(error)

    db = get_db()
    admin = get_current_admin()
    timestamp = to_iso(utc_now())
    cursor = db.execute(
        """
        INSERT INTO opportunities (
            admin_id, name, duration, start_date, description, skills_json,
            category, future_opportunities, max_applicants, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            admin["id"],
            payload["name"],
            payload["duration"],
            payload["start_date"],
            payload["description"],
            json.dumps(payload["skills"]),
            payload["category"],
            payload["future_opportunities"],
            payload["max_applicants"],
            timestamp,
            timestamp,
        ),
    )
    db.commit()
    row = db.execute("SELECT * FROM opportunities WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return jsonify({"message": "Opportunity created successfully.", "opportunity": row_to_opportunity(row)}), 201


def get_owned_opportunity(opportunity_id: int) -> sqlite3.Row | None:
    admin = get_current_admin()
    db = get_db()
    return db.execute(
        "SELECT * FROM opportunities WHERE id = ? AND admin_id = ?",
        (opportunity_id, admin["id"]),
    ).fetchone()


@app.route("/api/opportunities/<int:opportunity_id>", methods=["GET"])
@login_required
def get_opportunity(opportunity_id: int):
    row = get_owned_opportunity(opportunity_id)
    if not row:
        return json_error("Opportunity not found.", 404)
    return jsonify({"opportunity": row_to_opportunity(row)})


@app.route("/api/opportunities/<int:opportunity_id>", methods=["PUT"])
@login_required
def update_opportunity(opportunity_id: int):
    existing = get_owned_opportunity(opportunity_id)
    if not existing:
        return json_error("Opportunity not found.", 404)

    payload, error = parse_opportunity_payload(require_json())
    if error:
        return json_error(error)

    db = get_db()
    db.execute(
        """
        UPDATE opportunities
        SET name = ?, duration = ?, start_date = ?, description = ?, skills_json = ?,
            category = ?, future_opportunities = ?, max_applicants = ?, updated_at = ?
        WHERE id = ?
        """,
        (
            payload["name"],
            payload["duration"],
            payload["start_date"],
            payload["description"],
            json.dumps(payload["skills"]),
            payload["category"],
            payload["future_opportunities"],
            payload["max_applicants"],
            to_iso(utc_now()),
            opportunity_id,
        ),
    )
    db.commit()
    row = db.execute("SELECT * FROM opportunities WHERE id = ?", (opportunity_id,)).fetchone()
    return jsonify({"message": "Opportunity updated successfully.", "opportunity": row_to_opportunity(row)})


@app.route("/api/opportunities/<int:opportunity_id>", methods=["DELETE"])
@login_required
def delete_opportunity(opportunity_id: int):
    existing = get_owned_opportunity(opportunity_id)
    if not existing:
        return json_error("Opportunity not found.", 404)

    db = get_db()
    db.execute("DELETE FROM opportunities WHERE id = ?", (opportunity_id,))
    db.commit()
    return jsonify({"message": "Opportunity deleted successfully."})


@app.route("/api/dashboard/stats", methods=["GET"])
@login_required
def dashboard_stats():
    db = get_db()
    # Mocking some stats that aren't fully tracked in DB yet
    stats = {
        "total_students": db.execute("SELECT COUNT(*) FROM students").fetchone()[0] or 1200,
        "total_teachers": 150,
        "total_parents": 1260,
        "learner": {
            "total": db.execute("SELECT COUNT(*) FROM students").fetchone()[0] or 1200,
            "certified": db.execute("SELECT SUM(certificates_count) FROM students").fetchone()[0] or 342,
            "enrolled": db.execute("SELECT SUM(enrolled_courses_count) FROM students").fetchone()[0] or 1120,
            "deactivated": db.execute("SELECT COUNT(*) FROM students WHERE status = 'deactivated'").fetchone()[0] or 24,
        },
        "verifier": {
            "total": db.execute("SELECT COUNT(*) FROM verifiers").fetchone()[0] or 48,
            "active": db.execute("SELECT COUNT(*) FROM verifiers WHERE status = 'active'").fetchone()[0] or 42,
            "inactive": db.execute("SELECT COUNT(*) FROM verifiers WHERE status = 'inactive'").fetchone()[0] or 4,
            "pending": db.execute("SELECT COUNT(*) FROM verifiers WHERE status = 'pending'").fetchone()[0] or 2,
        }
    }
    return jsonify(stats)


@app.route("/api/students", methods=["GET"])
@login_required
def list_students():
    db = get_db()
    rows = db.execute("SELECT * FROM students ORDER BY id DESC").fetchall()
    return jsonify({"students": [row_to_student(row) for row in rows]})


@app.route("/api/verifiers", methods=["GET"])
@login_required
def list_verifiers():
    db = get_db()
    rows = db.execute("SELECT * FROM verifiers ORDER BY id DESC").fetchall()
    return jsonify({"verifiers": [row_to_verifier(row) for row in rows]})


@app.route("/api/courses", methods=["GET"])
@login_required
def list_courses():
    db = get_db()
    rows = db.execute("SELECT * FROM courses ORDER BY id DESC").fetchall()
    # If no courses, return some defaults to keep UI populated
    if not rows:
        return jsonify({"courses": [
            {"id": 1, "name": "Digital Marketing Fundamentals", "category": "Marketing", "stats": {"enrolled": 245, "completed": 180, "in_progress": 45, "half_done": 20}},
            {"id": 2, "name": "Web Development Bootcamp", "category": "Technology", "stats": {"enrolled": 189, "completed": 125, "in_progress": 48, "half_done": 16}}
        ]})
    return jsonify({"courses": [row_to_course(row) for row in rows]})


@app.route("/api/students", methods=["POST"])
@login_required
def create_student():
    payload = require_json()
    full_name = (payload.get("full_name") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    
    if not full_name or not email:
        return json_error("Name and email are required.")
    
    db = get_db()
    student_id_str = f"{db.execute('SELECT COUNT(*) FROM students').fetchone()[0] + 1001}"
    
    try:
        db.execute(
            "INSERT INTO students (student_id_str, full_name, email, created_at) VALUES (?, ?, ?, ?)",
            (student_id_str, full_name, email, to_iso(utc_now()))
        )
        db.commit()
    except sqlite3.IntegrityError:
        return json_error("A student with this email already exists.", 409)
        
    return jsonify({"message": "Student added successfully."}), 201


@app.route("/api/students/bulk-upload", methods=["POST"])
@login_required
def bulk_upload_students():
    if "file" not in request.files:
        return json_error("No file uploaded.")
    
    file = request.files["file"]
    if not file.filename.endswith(".csv"):
        return json_error("Please upload a valid CSV file.")
    
    try:
        content = file.read().decode("utf-8")
        lines = content.splitlines()
        if len(lines) < 2:
            return json_error("CSV file is empty or missing headers.")
            
        db = get_db()
        count = 0
        for line in lines[1:]: # Skip header
            parts = line.split(",")
            if len(parts) >= 2:
                name = parts[0].strip()
                email = parts[1].strip().lower()
                if name and email and validate_email(email):
                    student_id_str = f"{db.execute('SELECT COUNT(*) FROM students').fetchone()[0] + 1001}"
                    try:
                        db.execute(
                            "INSERT INTO students (student_id_str, full_name, email, created_at) VALUES (?, ?, ?, ?)",
                            (student_id_str, name, email, to_iso(utc_now()))
                        )
                        count += 1
                    except sqlite3.IntegrityError:
                        continue # Skip duplicates
        db.commit()
        return jsonify({"message": f"Successfully uploaded {count} students."})
    except Exception as e:
        return json_error(f"Error parsing CSV: {str(e)}")


@app.route("/api/verifiers", methods=["POST"])
@login_required
def create_verifier():
    payload = require_json()
    full_name = (payload.get("full_name") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    
    if not full_name or not email:
        return json_error("Name and email are required.")
    
    db = get_db()
    verifier_id_str = f"V{db.execute('SELECT COUNT(*) FROM verifiers').fetchone()[0] + 1:03d}"
    
    try:
        db.execute(
            "INSERT INTO verifiers (verifier_id_str, full_name, email, created_at) VALUES (?, ?, ?, ?)",
            (verifier_id_str, full_name, email, to_iso(utc_now()))
        )
        db.commit()
    except sqlite3.IntegrityError:
        return json_error("A verifier with this email already exists.", 409)
        
    return jsonify({"message": "Verifier added successfully."}), 201


if __name__ == "__main__":
    with app.app_context():
        ensure_db()
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)
