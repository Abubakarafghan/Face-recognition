/**
 * Automated Face Recognition Attendance System
 * Frontend Application Logic connected to Python AI Deep Learning Backend
 */

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initClock();
    initWebcamControls();
    initStudentRegistration();
    initFilters();
    loadStudentsFromBackend();
    loadAttendanceFromBackend();
});

// --- State Management ---
let isScanning = false;
let mediaStream = null;
let scanInterval = null;

// Hidden canvas for video frame extraction
const frameCanvas = document.createElement('canvas');

// --- 1. Tab Navigation ---
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    const pageTitle = document.getElementById('pageTitle');
    const pageSubtitle = document.getElementById('pageSubtitle');

    const headers = {
        'scanner': { title: 'Live Attendance Scanner', subtitle: 'Automated real-time facial recognition attendance kiosk' },
        'logs': { title: 'Attendance Logs & Reports', subtitle: 'View, filter, and export daily attendance records' },
        'students': { title: 'Student Management', subtitle: 'Enroll new students and manage facial profiles' },
        'analytics': { title: 'Analytics & Insights', subtitle: 'Attendance statistics and department performance' }
    };

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = item.getAttribute('data-tab');

            navItems.forEach(nav => nav.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            item.classList.add('active');
            document.getElementById(`tab-${tabId}`).classList.add('active');

            if (headers[tabId]) {
                pageTitle.textContent = headers[tabId].title;
                pageSubtitle.textContent = headers[tabId].subtitle;
            }

            if (tabId === 'logs') loadAttendanceFromBackend();
            if (tabId === 'students') loadStudentsFromBackend();

            if (tabId === 'scanner' && !mediaStream) {
                startCamera('webcamFeed');
            }
        });
    });
}

// --- 2. Real-Time Clock ---
function initClock() {
    const clockElement = document.getElementById('liveClock');
    const updateTime = () => {
        const now = new Date();
        clockElement.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };
    updateTime();
    setInterval(updateTime, 1000);
}

// --- 3. Webcam Controls ---
async function startCamera(videoElementId) {
    const video = document.getElementById(videoElementId);
    const placeholder = document.getElementById('cameraPlaceholder');
    const overlay = document.getElementById('scannerOverlay');

    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }
        });
        video.srcObject = mediaStream;
        video.play();
        if (placeholder) placeholder.style.display = 'none';
        if (overlay) overlay.style.display = 'block';
        showToast("Webcam connected successfully", "success");
    } catch (err) {
        console.error("Webcam access error:", err);
        showToast("Camera access denied or unavailable", "danger");
    }
}

function stopCamera() {
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    const video = document.getElementById('webcamFeed');
    const placeholder = document.getElementById('cameraPlaceholder');
    const overlay = document.getElementById('scannerOverlay');

    if (video) video.srcObject = null;
    if (placeholder) placeholder.style.display = 'flex';
    if (overlay) overlay.style.display = 'none';
}

function initWebcamControls() {
    const toggleCamBtn = document.getElementById('btnToggleCam');
    const toggleScanBtn = document.getElementById('btnToggleScan');
    const statusBadge = document.getElementById('scanStatusBadge');
    const statusText = document.getElementById('recognizedStudentText');

    startCamera('webcamFeed');

    if (toggleCamBtn) {
        toggleCamBtn.addEventListener('click', () => {
            if (mediaStream) {
                stopCamera();
                toggleCamBtn.innerHTML = '<i class="bi bi-camera-video-fill"></i> Start Camera';
                if (isScanning) stopScanning();
            } else {
                startCamera('webcamFeed');
                toggleCamBtn.innerHTML = '<i class="bi bi-camera-video-off-fill"></i> Stop Camera';
            }
        });
    }

    if (toggleScanBtn) {
        toggleScanBtn.addEventListener('click', () => {
            if (!mediaStream) {
                showToast("Please enable webcam first!", "warning");
                return;
            }

            if (!isScanning) {
                isScanning = true;
                toggleScanBtn.innerHTML = '<i class="bi bi-pause-fill"></i> Pause Scanner';
                toggleScanBtn.classList.replace('btn-primary', 'btn-danger');
                statusBadge.className = "status-badge scanning";
                statusBadge.textContent = "ACTIVE SCANNING";
                statusText.textContent = "Scanning frame with AI ResNet engine...";
                
                // Real AI Frame Processing every 1.5 seconds
                scanInterval = setInterval(sendFrameToAIBackend, 1500);
            } else {
                stopScanning();
            }
        });
    }
}

function stopScanning() {
    isScanning = false;
    if (scanInterval) clearInterval(scanInterval);
    const toggleScanBtn = document.getElementById('btnToggleScan');
    const alertBanner = document.getElementById('scanAlertBanner');
    const alertIconBox = document.getElementById('alertIconBox');
    const alertTitle = document.getElementById('alertTitle');
    const alertSubtext = document.getElementById('alertSubtext');
    const alertConfidence = document.getElementById('alertConfidence');

    if (toggleScanBtn) {
        toggleScanBtn.innerHTML = '<i class="bi bi-play-fill"></i> Start Auto Recognition';
        toggleScanBtn.classList.replace('btn-danger', 'btn-primary');
    }
    if (alertBanner) {
        alertBanner.className = "scan-alert-banner idle";
        alertIconBox.innerHTML = '<i class="bi bi-person-bounding-box"></i>';
        alertTitle.textContent = "Scanner Paused";
        alertSubtext.textContent = "Click 'Start Auto Recognition' to scan faces.";
        alertConfidence.textContent = "Confidence: --";
    }
}

// --- 4. Real AI Backend Frame Recognition API Call ---
async function sendFrameToAIBackend() {
    if (!isScanning) return;

    const video = document.getElementById('webcamFeed');
    if (!video) return;

    // Use videoWidth or fallback to 640x480 if video element hasn't loaded dimensions yet
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    frameCanvas.width = width;
    frameCanvas.height = height;
    const ctx = frameCanvas.getContext('2d');
    ctx.drawImage(video, 0, 0, width, height);
    
    const base64Image = frameCanvas.toDataURL('image/jpeg', 0.85);

    try {
        const response = await fetch('/api/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64Image })
        });

        const data = await response.json();
        console.log("[AI Scanner Results]", data);
        
        const alertBanner = document.getElementById('scanAlertBanner');
        const alertIconBox = document.getElementById('alertIconBox');
        const alertTitle = document.getElementById('alertTitle');
        const alertSubtext = document.getElementById('alertSubtext');
        const alertConfidence = document.getElementById('alertConfidence');

        if (data.status === 'success' && data.detections && data.detections.length > 0) {
            drawFaceBoundingBoxes(data.detections, video);
            const match = data.detections[0]; // Primary detected face

            if (match.is_matched) {
                if (match.attendance_marked) {
                    // GREEN SUCCESS POPUP: ATTENDANCE MARKED DONE
                    alertBanner.className = "scan-alert-banner success";
                    alertIconBox.innerHTML = '<i class="bi bi-check-circle-fill"></i>';
                    alertTitle.textContent = "ATTENDANCE MARKED SUCCESSFUL!";
                    alertSubtext.textContent = `Welcome, ${match.name} (${match.student_id}) - Marked Present`;
                    alertConfidence.textContent = `Matching Confidence: ${match.confidence}`;

                    showToast(`Attendance marked for ${match.name}!`, "success");
                    addRecentActivity(match);
                    loadAttendanceFromBackend();
                } else {
                    // YELLOW POPUP: ALREADY MARKED TODAY
                    alertBanner.className = "scan-alert-banner already-marked";
                    alertIconBox.innerHTML = '<i class="bi bi-exclamation-circle-fill"></i>';
                    alertTitle.textContent = "ATTENDANCE ALREADY MARKED";
                    alertSubtext.textContent = `${match.name} (${match.student_id}) is already present for today.`;
                    alertConfidence.textContent = `Matching Confidence: ${match.confidence}`;
                }
            } else {
                // RED DANGER POPUP: UNAUTHORIZED PERSON / SCAN FAILED
                alertBanner.className = "scan-alert-banner unauthorized";
                alertIconBox.innerHTML = '<i class="bi bi-shield-x"></i>';
                alertTitle.textContent = "UNAUTHORIZED PERSON / SCAN FAILED!";
                alertSubtext.textContent = "Face not recognized in database. Access Denied!";
                alertConfidence.textContent = "Confidence: 0.0%";

                showToast("Unauthorized person detected! Access denied.", "danger");
            }
        } else {
            drawFaceBoundingBoxes([], video);
            // IDLE / SCANNING
            alertBanner.className = "scan-alert-banner idle";
            alertIconBox.innerHTML = '<i class="bi bi-person-bounding-box"></i>';
            alertTitle.textContent = "SCANNING FRAME...";
            alertSubtext.textContent = "Position your face clearly in front of the camera.";
            alertConfidence.textContent = "Confidence: --";
        }

    } catch (err) {
        console.error("AI frame scan error:", err);
    }
}

function addRecentActivity(record) {
    const list = document.getElementById('recentActivityList');
    if (!list) return;

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const item = document.createElement('div');
    item.className = 'recent-item';
    item.style.padding = "10px 0";
    item.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
    item.style.display = "flex";
    item.style.justifyContent = "space-between";
    item.style.alignItems = "center";

    item.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
            <div class="avatar">${record.name.split(' ').map(n=>n[0]).join('')}</div>
            <div>
                <div style="font-weight:600; font-size:13px;">${record.name}</div>
                <div style="font-size:11px; color:var(--text-muted);">${record.student_id}</div>
            </div>
        </div>
        <div style="text-align:right;">
            <span class="status-badge success" style="font-size:10px; padding:3px 8px;">${nowTime}</span>
        </div>
    `;
    list.prepend(item);
    if (list.children.length > 5) list.removeChild(list.lastChild);
}

// --- 5. Real Student Enrollment with AI Embedding Generation ---
function initStudentRegistration() {
    const btnOpenModal = document.getElementById('btnOpenEnrollModal');
    const btnCloseModal = document.getElementById('btnCloseModal');
    const modal = document.getElementById('enrollModal');
    const form = document.getElementById('enrollForm');
    const btnCapturePhoto = document.getElementById('btnCapturePhoto');
    const snapshotCanvas = document.getElementById('snapshotCanvas');
    const snapshotPreview = document.getElementById('snapshotPreview');

    if (btnOpenModal) {
        btnOpenModal.addEventListener('click', () => {
            modal.classList.add('open');
            startCamera('regWebcamFeed');
        });
    }

    if (btnCloseModal) {
        btnCloseModal.addEventListener('click', () => {
            modal.classList.remove('open');
        });
    }

    if (btnCapturePhoto) {
        btnCapturePhoto.addEventListener('click', () => {
            const regVideo = document.getElementById('regWebcamFeed');
            if (regVideo && regVideo.srcObject) {
                const context = snapshotCanvas.getContext('2d');
                snapshotCanvas.width = regVideo.videoWidth || 640;
                snapshotCanvas.height = regVideo.videoHeight || 480;
                context.drawImage(regVideo, 0, 0, snapshotCanvas.width, snapshotCanvas.height);
                snapshotPreview.src = snapshotCanvas.toDataURL('image/jpeg', 0.9);
                snapshotPreview.style.display = 'block';
                showToast("Sample photo captured!", "success");
            }
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('studentName').value;
            const roll = document.getElementById('studentRoll').value;
            const dept = document.getElementById('studentDept').value;
            const photoSrc = snapshotPreview.src;

            if (!photoSrc || photoSrc.length < 100) {
                showToast("Please capture a photo sample first!", "warning");
                return;
            }

            showToast("Processing 128-d face embedding vector...", "warning");

            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: name,
                        roll_number: roll,
                        department: dept,
                        image: photoSrc
                    })
                });

                const result = await response.json();

                if (result.status === 'success') {
                    showToast(result.message, "success");
                    modal.classList.remove('open');
                    form.reset();
                    snapshotPreview.style.display = 'none';
                    loadStudentsFromBackend();
                } else {
                    showToast(result.message, "danger");
                }
            } catch (err) {
                console.error("Enrolment error:", err);
                showToast("Failed to connect to backend server", "danger");
            }
        });
    }
}

// --- 6. Fetch Real Data from SQLite Backend ---
async function loadStudentsFromBackend() {
    try {
        const res = await fetch('/api/students');
        const data = await res.json();
        if (data.status === 'success') {
            renderStudentList(data.students);
            document.getElementById('totalStudentsCount').textContent = data.students.length;
        }
    } catch (err) {
        console.error("Error loading students:", err);
    }
}

async function loadAttendanceFromBackend() {
    try {
        const res = await fetch('/api/attendance');
        const data = await res.json();
        if (data.status === 'success') {
            renderAttendanceLogs(data.attendance);
            document.getElementById('presentTodayCount').textContent = data.attendance.length;
        }
    } catch (err) {
        console.error("Error loading attendance:", err);
    }
}

function drawFaceBoundingBoxes(detections, video) {
    const canvas = document.getElementById('boundingBoxCanvas');
    if (!canvas || !video) return;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!detections || detections.length === 0) return;

    detections.forEach(det => {
        const { top, right, bottom, left } = det.box;
        const width = right - left;
        const height = bottom - top;

        const color = det.is_matched ? '#10b981' : '#ef4444';

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.strokeRect(left, top, width, height);

        ctx.fillStyle = color;
        ctx.fillRect(left, Math.max(0, top - 28), Math.max(120, width), 28);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
        const label = det.is_matched ? `${det.name}` : 'UNAUTHORIZED';
        ctx.fillText(label, left + 8, Math.max(18, top - 9));
    });
}

async function deleteStudent(studentId, name) {
    showToast(`Deleting student ${name}...`, "warning");

    try {
        const res = await fetch('/api/delete_student', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_id: studentId })
        });
        const data = await res.json();
        if (data.status === 'success') {
            showToast(`Deleted ${name} (${studentId}) successfully`, "success");
            loadStudentsFromBackend();
            loadAttendanceFromBackend();
        } else {
            showToast(data.message, "danger");
        }
    } catch (err) {
        console.error("Error deleting student:", err);
        showToast("Failed to delete student", "danger");
    }
}
window.deleteStudent = deleteStudent;

function renderStudentList(students) {
    const tbody = document.getElementById('studentsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    students.forEach(stu => {
        const tr = document.createElement('tr');
        const avatarText = stu.name.split(' ').map(n=>n[0]).join('').toUpperCase();
        tr.innerHTML = `
            <td>
                <div class="user-avatar-cell">
                    <div class="avatar">${avatarText}</div>
                    <div>
                        <div style="font-weight:600;">${stu.name}</div>
                        <div style="font-size:12px; color:var(--text-muted);">${stu.student_id}</div>
                    </div>
                </div>
            </td>
            <td>${stu.roll_number}</td>
            <td>${stu.department}</td>
            <td>${stu.registered_date}</td>
            <td><span class="status-badge success">Enrolled (128-d Vector)</span></td>
            <td>
                <button class="btn btn-danger" style="padding: 6px 14px; font-size:12px;" onclick="window.deleteStudent('${stu.student_id}', '${stu.name}')">
                    <i class="bi bi-trash-fill"></i> Delete Profile
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderAttendanceLogs(attendance) {
    const tbody = document.getElementById('attendanceTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    attendance.forEach(log => {
        const tr = document.createElement('tr');
        const avatarText = log.name.split(' ').map(n=>n[0]).join('').toUpperCase();
        tr.innerHTML = `
            <td>
                <div class="user-avatar-cell">
                    <div class="avatar">${avatarText}</div>
                    <div>
                        <div style="font-weight:600;">${log.name}</div>
                        <div style="font-size:12px; color:var(--text-muted);">${log.roll_number}</div>
                    </div>
                </div>
            </td>
            <td>${log.department}</td>
            <td>${log.date}</td>
            <td>${log.time}</td>
            <td><span class="status-badge success">${log.status}</span></td>
            <td><span style="color:var(--accent); font-weight:600;">${log.confidence}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function initFilters() {
    const searchInput = document.getElementById('searchAttendanceInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#attendanceTableBody tr');
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(query) ? '' : 'none';
            });
        });
    }

    const exportBtn = document.getElementById('btnExportCSV');
    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            const res = await fetch('/api/attendance');
            const data = await res.json();
            if (data.status === 'success') {
                exportCSV(data.attendance);
            }
        });
    }
}

function exportCSV(attendance) {
    let csv = "Student ID,Name,Roll No,Department,Date,Time,Status,Confidence\n";
    attendance.forEach(a => {
        csv += `${a.student_id},"${a.name}",${a.roll_number},"${a.department}",${a.date},${a.time},${a.status},${a.confidence}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `Attendance_Report_${getTodayDateString()}.csv`);
    a.click();
    showToast("Attendance CSV report exported!", "success");
}

// --- Helpers ---
function getTodayDateString() {
    const today = new Date();
    return today.toISOString().split('T')[0];
}

function showToast(message, type = "success") {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast`;
    if (type === "warning") toast.style.borderLeftColor = "var(--warning)";
    if (type === "danger") toast.style.borderLeftColor = "var(--danger)";

    toast.innerHTML = `
        <i class="bi bi-info-circle-fill" style="color:var(--accent);"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => container.removeChild(toast), 300);
    }, 3500);
}
