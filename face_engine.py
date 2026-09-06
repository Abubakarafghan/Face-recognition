"""
Face Recognition AI Engine (Deep Learning ResNet-29 Embeddings)
Uses Adam Geitgey's `face_recognition` library (built on dlib deep neural network).
Integrates with SQLite database.
"""

import os
import base64
import numpy as np
import cv2
import face_recognition
from pathlib import Path
from database import db_manager

class FaceRecognitionEngine:
    def __init__(self, tolerance=0.50):
        """
        :param tolerance: Lower distance threshold = stricter match accuracy (default 0.50).
        """
        self.tolerance = tolerance
        self.reload_database()

    def reload_database(self):
        """Reloads 128-dimensional facial embedding vectors from SQLite DB."""
        self.known_student_ids, self.known_student_names, self.known_face_encodings = db_manager.get_all_known_encodings()
        print(f"[AI Engine] Loaded {len(self.known_student_ids)} student profiles from SQLite database.")

    def decode_base64_image(self, base64_str):
        """Decodes base64 image string from webcam to RGB numpy image format."""
        if "," in base64_str:
            base64_str = base64_str.split(",")[1]
        img_bytes = base64.b64decode(base64_str)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img_bgr is None:
            return None
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        return img_rgb

    def register_student(self, name, roll_number, department, base64_image):
        """
        Extracts 128-d deep embedding vector from student photo and saves to SQLite DB.
        """
        img_rgb = self.decode_base64_image(base64_image)
        if img_rgb is None:
            return False, "Invalid image data received."

        # Detect face locations & extract 128-d vector
        face_locations = face_recognition.face_locations(img_rgb, model="hog")
        if len(face_locations) == 0:
            return False, "No face detected in photo. Please make sure face is clearly visible."
        elif len(face_locations) > 1:
            return False, "Multiple faces detected. Please ensure only one person is in the photo."

        encodings = face_recognition.face_encodings(img_rgb, known_face_locations=face_locations)
        if len(encodings) > 0:
            face_encoding = encodings[0]
            student_id = f"STU-{1000 + len(self.known_student_ids) + 1}"
            
            # Save cropped face image to disk
            faces_dir = BASE_DIR / "database" / "registered_faces"
            os.makedirs(faces_dir, exist_ok=True)
            top, right, bottom, left = face_locations[0]
            face_crop = img_rgb[max(0, top-20):bottom+20, max(0, left-20):right+20]
            if face_crop.size > 0:
                face_crop_bgr = cv2.cvtColor(face_crop, cv2.COLOR_RGB2BGR)
                cv2.imwrite(str(faces_dir / f"{student_id}.jpg"), face_crop_bgr)

            # Save in SQLite
            success, msg = db_manager.save_student(student_id, name, roll_number, department, face_encoding)
            if success:
                self.reload_database()
                return True, f"Enrolled {name} ({roll_number}) successfully!"
            else:
                return False, msg

        return False, "Failed to extract facial embedding vector."

    def process_live_frame(self, base64_image):
        """
        Performs real-time face detection & recognition on a base64 webcam frame.
        Calculates 128-d vector, matches against SQLite database, and auto-marks attendance.
        """
        img_rgb = self.decode_base64_image(base64_image)
        if img_rgb is None:
            return {"status": "error", "message": "Invalid frame"}

        # Find faces & compute 128-d encodings
        face_locations = face_recognition.face_locations(img_rgb, model="hog")
        face_encodings = face_recognition.face_encodings(img_rgb, face_locations)

        detections = []

        for (top, right, bottom, left), face_encoding in zip(face_locations, face_encodings):
            name = "Unknown"
            student_id = None
            roll_number = None
            department = None
            confidence = "0.0%"
            is_matched = False
            attendance_marked = False

            if len(self.known_face_encodings) > 0:
                # Euclidean distance calculation
                face_distances = face_recognition.face_distance(self.known_face_encodings, face_encoding)
                best_match_index = np.argmin(face_distances)
                best_distance = face_distances[best_match_index]

                if best_distance <= self.tolerance:
                    student_id = self.known_student_ids[best_match_index]
                    name = self.known_student_names[best_match_index]
                    conf_val = round((1.0 - best_distance) * 100, 1)
                    confidence = f"{conf_val}%"
                    is_matched = True

                    # Auto Mark Attendance in SQLite DB
                    marked, att_msg = db_manager.mark_attendance(student_id, status="Present", confidence=confidence)
                    attendance_marked = marked

            detections.append({
                "student_id": student_id,
                "name": name,
                "confidence": confidence,
                "is_matched": is_matched,
                "attendance_marked": attendance_marked,
                "box": {"top": top, "right": right, "bottom": bottom, "left": left}
            })

        return {
            "status": "success",
            "faces_count": len(detections),
            "detections": detections
        }

# Global Instance
ai_engine = FaceRecognitionEngine()
