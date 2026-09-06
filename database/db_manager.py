"""
SQLite Database Manager for Automated Attendance System
Handles persistence for Student Profiles, 128-d Face Embeddings, and Attendance Logs.
"""

import sqlite3
import pickle
import numpy as np
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "database" / "attendance_system.db"

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes SQLite database tables."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Students Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            roll_number TEXT UNIQUE NOT NULL,
            department TEXT NOT NULL,
            registered_date TEXT NOT NULL,
            face_encoding BLOB NOT NULL
        )
    ''')

    # Attendance Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            status TEXT NOT NULL,
            confidence TEXT NOT NULL,
            FOREIGN KEY (student_id) REFERENCES students(student_id),
            UNIQUE(student_id, date)
        )
    ''')

    conn.commit()
    conn.close()
    print("[Database] SQLite database initialized successfully.")

def save_student(student_id, name, roll_number, department, face_encoding_np):
    """Saves a new student profile and their 128-d face embedding vector to SQLite."""
    conn = get_db_connection()
    cursor = conn.cursor()
    registered_date = datetime.now().strftime("%Y-%m-%d")
    
    # Serialize numpy 128-d vector to binary BLOB using pickle
    encoding_blob = pickle.dumps(face_encoding_np)

    try:
        cursor.execute('''
            INSERT INTO students (student_id, name, roll_number, department, registered_date, face_encoding)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (student_id, name, roll_number, department, registered_date, encoding_blob))
        conn.commit()
        return True, "Student registered successfully in database."
    except sqlite3.IntegrityError as e:
        return False, f"Roll number or Student ID already exists! ({e})"
    finally:
        conn.close()

def get_all_students():
    """Returns list of all enrolled students."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT student_id, name, roll_number, department, registered_date FROM students ORDER BY id DESC')
    students = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return students

def get_all_known_encodings():
    """Retrieves all 128-d facial embeddings from SQLite for AI face matching."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT student_id, name, face_encoding FROM students')
    rows = cursor.fetchall()
    conn.close()

    known_ids = []
    known_names = []
    known_encodings = []

    for row in rows:
        known_ids.append(row['student_id'])
        known_names.append(row['name'])
        encoding_np = pickle.loads(row['face_encoding'])
        known_encodings.append(encoding_np)

    return known_ids, known_names, known_encodings

def mark_attendance(student_id, status="Present", confidence="98.5%"):
    """
    Marks attendance for a student for today. 
    Prevents duplicate entries on the same day.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    today_date = datetime.now().strftime("%Y-%m-%d")
    now_time = datetime.now().strftime("%I:%M:%S %p")

    try:
        cursor.execute('''
            INSERT INTO attendance (student_id, date, time, status, confidence)
            VALUES (?, ?, ?, ?, ?)
        ''', (student_id, today_date, now_time, status, confidence))
        conn.commit()
        conn.close()
        return True, f"Attendance marked for {student_id} at {now_time}"
    except sqlite3.IntegrityError:
        conn.close()
        return False, f"Attendance already marked for today."

def get_attendance_logs(date_filter=None):
    """Retrieves attendance logs with student info."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = '''
        SELECT a.id, a.student_id, s.name, s.roll_number, s.department, a.date, a.time, a.status, a.confidence
        FROM attendance a
        JOIN students s ON a.student_id = s.student_id
    '''
    params = []
    if date_filter:
        query += ' WHERE a.date = ?'
        params.append(date_filter)

    query += ' ORDER BY a.id DESC'
    cursor.execute(query, params)
def delete_student(student_id):
    """Deletes student profile and their attendance logs from SQLite database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('DELETE FROM attendance WHERE student_id = ?', (student_id,))
        cursor.execute('DELETE FROM students WHERE student_id = ?', (student_id,))
        conn.commit()
        conn.close()
        return True, f"Student {student_id} removed from database."
    except Exception as e:
        conn.close()
        return False, f"Failed to delete student: {e}"

# Initialize DB on module load
init_db()
