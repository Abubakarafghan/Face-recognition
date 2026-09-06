# VisionAttend AI

An open-source face recognition attendance system with a browser-based kiosk interface. It uses `face_recognition` to create face embeddings, OpenCV to process webcam frames, and SQLite to store student profiles and attendance logs.

## Features

- Live webcam face recognition
- Student enrollment from the browser
- Automatic daily attendance marking
- Student roster and attendance log views
- Local SQLite storage

## Requirements

- Python 3.9 or newer
- A working webcam
- A modern browser such as Chrome, Firefox, or Edge
- Build tools required by `dlib` if a prebuilt package is not available for your platform

## Installation

Clone the repository and open its directory:

```bash
git clone https://github.com/Abubakarafghan/Face-recognition.git
cd Face-recognition
```

Create and activate a virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

On Windows PowerShell, activate it with:

```powershell
.venv\Scripts\Activate.ps1
```

Install the Python dependencies:

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

On Linux, `face_recognition` may need native build dependencies before installation:

```bash
sudo apt update
sudo apt install build-essential cmake python3-dev
```

## Running the application

Start the local server from the project root:

```bash
python app.py
```

Open [http://localhost:8000](http://localhost:8000) in your browser and allow camera access when prompted.

Press `Ctrl+C` in the terminal to stop the server.

## Data storage

The application creates `database/attendance_system.db` automatically on first startup. Enrolled face images are stored in `database/registered_faces/`. These runtime files are local application data and should not be committed to a public repository.

## Project structure

```text
app.py                    Local HTTP server and API routes
face_engine.py            Face detection, encoding, and matching
database/db_manager.py    SQLite database operations
templates/index.html      Browser interface
static/                   CSS and JavaScript assets
requirements.txt          Python dependencies
```

## Notes

- Camera access is normally allowed for `localhost`; deployment over a network may require HTTPS.
- Face matching runs locally on the machine running the server.
- This project is intended for legitimate, consent-based attendance use. Follow applicable privacy and data-protection laws.

## License

This project is licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.
 
