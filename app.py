"""
Face Recognition Automated Attendance System - Backend Server
Provides Web Kiosk Frontend & REST API endpoints for Live Recognition & Enrolment.
"""

import http.server
import socketserver
import os
import json
from pathlib import Path
from database import db_manager
from face_engine import ai_engine

PORT = 8000
BASE_DIR = Path(__file__).resolve().parent

class AttendanceAppHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        if path == '/' or path == '/index.html':
            return str(BASE_DIR / 'templates' / 'index.html')
        elif path.startswith('/static/'):
            return str(BASE_DIR / path.lstrip('/'))
        return super().translate_path(path)

    def do_GET(self):
        # API: Get Students
        if self.path == '/api/students':
            students = db_manager.get_all_students()
            self._send_json_response({"status": "success", "students": students})
            return

        # API: Get Attendance Logs
        elif self.path.startswith('/api/attendance'):
            logs = db_manager.get_attendance_logs()
            self._send_json_response({"status": "success", "attendance": logs})
            return

        # Serve static files & frontend HTML
        super().do_GET()

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)

        try:
            payload = json.loads(post_data.decode('utf-8'))
        except Exception as e:
            self._send_json_response({"status": "error", "message": "Invalid JSON format"}, 400)
            return

        # API: Student Registration with 128-d Face Embedding
        if self.path == '/api/register':
            name = payload.get('name')
            roll = payload.get('roll_number')
            dept = payload.get('department')
            image = payload.get('image')

            if not name or not roll or not dept or not image:
                self._send_json_response({"status": "error", "message": "Missing required fields"}, 400)
                return

            success, message = ai_engine.register_student(name, roll, dept, image)
            status_code = 200 if success else 400
            self._send_json_response({"status": "success" if success else "error", "message": message}, status_code)
            return

        # API: Live Webcam Frame Scanning & Face Matching
        elif self.path == '/api/scan':
            image = payload.get('image')
            if not image:
                self._send_json_response({"status": "error", "message": "No frame image provided"}, 400)
                return

            results = ai_engine.process_live_frame(image)
            self._send_json_response(results)
            return

        # API: Delete Student Profile
        elif self.path == '/api/delete_student':
            student_id = payload.get('student_id')
            if not student_id:
                self._send_json_response({"status": "error", "message": "Missing student_id"}, 400)
                return

            success, message = db_manager.delete_student(student_id)
            if success:
                ai_engine.reload_database()
            self._send_json_response({"status": "success" if success else "error", "message": message})
            return

        self._send_json_response({"status": "error", "message": "Endpoint not found"}, 404)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def _send_json_response(self, data, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

def run_server():
    os.chdir(BASE_DIR)
    print("Initializing SQLite Database...")
    db_manager.init_db()

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), AttendanceAppHandler) as httpd:
        print(f"==================================================")
        print(f" 🚀 VisionAttend AI (Deep Learning Engine) Active!")
        print(f" 👉 http://localhost:{PORT}")
        print(f" 👉 http://127.0.0.1:{PORT}")
        print(f"==================================================")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server gracefully.")

if __name__ == "__main__":
    run_server()
