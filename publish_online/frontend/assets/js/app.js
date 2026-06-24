// === UTILITY: HELPER apiFetch (semua request pakai ini) ===
// Mengirim cookie session otomatis, menangani error JSON vs HTML
async function apiFetch(url, opts = {}) {
    const method = opts.method || 'GET';
    const headers = opts.headers || {};
    if (opts.body) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
        method,
        credentials: 'same-origin',  // kirim cookie session selalu
        headers,
        body: opts.body
    });

    // Cek apakah server mengembalikan JSON
    const ct = response.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
        // Server mengembalikan HTML (mis: halaman login karena session habis)
        if (response.status === 401 || response.redirected) {
            window.location.href = '/';
            return null;
        }
        throw new Error('Server tidak mengembalikan JSON. Status: ' + response.status);
    }

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || data.message || 'Permintaan gagal (status ' + response.status + ')');
    }

    return data;
}


// === UTILITY: LIVE CLOCK ===
function startLiveClock() {
    const clockEl = document.getElementById('live-clock');
    const largeDateEl = document.getElementById('large-date-string');
    const largeTimeEl = document.getElementById('large-time-string');
    
    if (!clockEl && !largeTimeEl) return;

    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    setInterval(() => {
        const now = new Date();
        const dayName = days[now.getDay()];
        const dayNum = now.getDate();
        const monthName = months[now.getMonth()];
        const year = now.getFullYear();
        
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');

        const dateStr = `${dayName}, ${dayNum} ${monthName} ${year}`;
        const timeStr = `${hours}:${minutes}:${seconds}`;

        if (clockEl) {
            clockEl.innerText = `${dateStr} | ${timeStr}`;
        }
        if (largeDateEl) {
            largeDateEl.innerText = dateStr;
        }
        if (largeTimeEl) {
            largeTimeEl.innerText = timeStr;
        }
    }, 1000);
}

// === UTILITY: SIDEBAR DRAWER ON MOBILE ===
function initMobileSidebar() {
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (!toggleBtn || !sidebar) return;

    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
        if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== toggleBtn) {
            sidebar.classList.remove('open');
        }
    });
}

// === UTILITY: PHOTO VIEWER MODAL ===
function initPhotoViewer() {
    const modal = document.getElementById('photo-modal');
    const modalImg = document.getElementById('modal-img-element');
    const modalCaption = document.getElementById('modal-img-caption');
    const closeBtn = document.getElementById('close-photo-modal');

    if (!modal) return;

    document.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('img-thumb')) {
            modalImg.src = e.target.src;
            modalCaption.innerText = e.target.dataset.caption || 'Foto Absen';
            modal.style.display = 'flex';
        }
    });

    const closeModalFunc = () => { modal.style.display = 'none'; };
    closeBtn.addEventListener('click', closeModalFunc);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModalFunc();
    });
}

// === SESSION PROFILE SYNC & LOGOUT ===
async function checkSession() {
    try {
        const data = await apiFetch('/api/auth/me');
        if (!data) return; // redirect sudah dilakukan di apiFetch
        
        if (data.logged_in) {
            const displayNameEls = document.querySelectorAll('#user-display-name');
            const displayRoleEls = document.querySelectorAll('#user-display-role');
            const avatarEls = document.querySelectorAll('.avatar-circle, #karyawan-avatar');
            
            displayNameEls.forEach(el => el.innerText = data.user.nama_lengkap || data.user.username);
            displayRoleEls.forEach(el => el.innerText = data.user.role === 'admin' ? 'Administrator' : 'Karyawan');
            avatarEls.forEach(el => {
                const initial = (data.user.nama_lengkap || data.user.username).charAt(0).toUpperCase();
                el.innerText = initial;
            });
            
            // Redirect jika sudah login dan ada di halaman login
            if (document.body.classList.contains('login-page') && !document.getElementById('reset-password-form')) {
                if (data.user.role === 'admin') {
                    window.location.href = '/admin/dashboard';
                } else {
                    window.location.href = '/karyawan/absen';
                }
            }
        } else {
            // Tidak login & bukan di halaman login atau reset password
            if (!document.body.classList.contains('login-page')) {
                window.location.href = '/';
            }
        }
    } catch (err) {
        console.error('Session check failed:', err);
    }
}

function initLogout() {
    const logoutLinks = document.querySelectorAll('.logout-link');
    logoutLinks.forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            if (confirm('Apakah Anda yakin ingin keluar?')) {
                try {
                    await apiFetch('/api/auth/logout', { method: 'POST' });
                } catch (err) {
                    console.error('Logout error:', err);
                } finally {
                    window.location.href = '/';
                }
            }
        });
    });
}


// ==========================================
// 1. LOGIN PAGE CONTROLLER
// ==========================================
function initLoginPage() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    const passwordInput = document.getElementById('input-password');
    const togglePassword = document.getElementById('toggle-password');
    if (passwordInput && togglePassword) {
        togglePassword.addEventListener('click', () => {
            const showPassword = passwordInput.type === 'password';
            passwordInput.type = showPassword ? 'text' : 'password';
            togglePassword.setAttribute('aria-pressed', String(showPassword));
            togglePassword.setAttribute('aria-label', showPassword ? 'Sembunyikan password' : 'Tampilkan password');
            togglePassword.innerHTML = showPassword ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
        });
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const usernameInput = document.getElementById('input-username');
        const errorEl = document.getElementById('error-msg');
        const submitBtn = document.getElementById('btn-login');

        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        errorEl.style.display = 'none';
        submitBtn.disabled = true;
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';

        try {
            const data = await apiFetch('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });

            if (data.user.role === 'admin') {
                window.location.href = '/admin/dashboard';
            } else {
                window.location.href = '/karyawan/absen';
            }
        } catch (err) {
            errorEl.innerText = err.message;
            errorEl.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });

    // Forgot Password
    const forgotLink = document.getElementById('link-lupa-password');
    if (forgotLink) {
        forgotLink.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = prompt('Masukkan Email terdaftar Anda untuk mengirim link reset password:');
            if (email === null) return;
            if (!email.trim()) {
                alert('Email tidak boleh kosong!');
                return;
            }

            try {
                const data = await apiFetch('/api/auth/forgot-password', {
                    method: 'POST',
                    body: JSON.stringify({ email: email.trim() })
                });
                alert(data.message);
            } catch (err) {
                alert('Gagal mengirimkan permintaan reset password: ' + err.message);
            }
        });
    }
}


// ==========================================
// 2. RESET PASSWORD PAGE CONTROLLER
// ==========================================
function initResetPasswordPage() {
    const form = document.getElementById('reset-password-form');
    if (!form) return;

    const token = new URLSearchParams(window.location.search).get('token');
    const errorEl = document.getElementById('error-msg');
    const successEl = document.getElementById('success-msg');
    const submitBtn = document.getElementById('btn-reset-password');

    if (!token) {
        errorEl.innerText = 'Token reset password tidak ditemukan / tidak valid.';
        errorEl.style.display = 'block';
        submitBtn.disabled = true;
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const newPass = document.getElementById('input-new-password').value;
        const confirmPass = document.getElementById('input-confirm-password').value;

        if (newPass !== confirmPass) {
            errorEl.innerText = 'Password dan konfirmasi password tidak cocok!';
            errorEl.style.display = 'block';
            return;
        }

        errorEl.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';

        try {
            const data = await apiFetch('/api/auth/reset-password', {
                method: 'POST',
                body: JSON.stringify({ token, password: newPass })
            });

            successEl.style.display = 'block';
            form.style.display = 'none';
            setTimeout(() => {
                window.location.href = '/';
            }, 3000);
        } catch (err) {
            errorEl.innerText = err.message;
            errorEl.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.innerText = 'Simpan Password Baru';
        }
    });
}


// ==========================================
// 3. ADMIN DASHBOARD CONTROLLER
// ==========================================
async function loadAdminStats() {
    try {
        const data = await apiFetch('/api/admin/stats');
        if (!data) return;
        
        document.getElementById('stat-total-karyawan').innerText = data.total_karyawan;
        document.getElementById('stat-hadir').innerText = data.hadir;
        document.getElementById('stat-sakit').innerText = data.sakit;
        document.getElementById('stat-izin').innerText = data.izin;
        document.getElementById('stat-alfa').innerText = data.alfa;
    } catch (err) {
        console.error('Gagal memuat statistik:', err);
    }
}

async function loadAdminLogs(dateStr = '') {
    const tbody = document.querySelector('#table-logs tbody');
    if (!tbody) return;

    try {
        let url = '/api/admin/logs';
        if (dateStr) url += `?tanggal=${dateStr}`;

        const logs = await apiFetch(url);
        if (!logs) return;

        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-light">Tidak ada log absensi untuk tanggal ini.</td></tr>';
            return;
        }

        tbody.innerHTML = logs.map(log => {
            const photoMasukHtml = log.foto_masuk 
                ? `<img src="${log.foto_masuk}" class="img-thumb" data-caption="Foto Masuk: ${log.nama_lengkap}" alt="Masuk">` 
                : '<span class="text-light">-</span>';
                
            const photoKeluarHtml = log.foto_keluar 
                ? `<img src="${log.foto_keluar}" class="img-thumb" data-caption="Foto Keluar: ${log.nama_lengkap}" alt="Keluar">` 
                : '<span class="text-light">-</span>';
                
            const jamMasuk = log.jam_masuk || '-';
            const jamKeluar = log.jam_keluar || '-';
            
            return `
                <tr>
                    <td data-label="Nama Lengkap"><strong>${log.nama_lengkap}</strong><br><span class="text-light">@${log.username}</span></td>
                    <td data-label="Status"><span class="badge badge-${log.status}">${log.status}</span></td>
                    <td data-label="Jam Masuk">${jamMasuk}</td>
                    <td data-label="Foto Masuk">${photoMasukHtml}</td>
                    <td data-label="Jam Keluar">${jamKeluar}</td>
                    <td data-label="Foto Keluar">${photoKeluarHtml}</td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-red">Error: ${err.message}</td></tr>`;
    }
}

function initAdminDashboard() {
    if (!document.body.classList.contains('admin-dashboard')) return;

    const dateInput = document.getElementById('filter-date');
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;

    loadAdminStats();
    loadAdminLogs(today);

    dateInput.addEventListener('change', () => {
        loadAdminLogs(dateInput.value);
    });
}


// ==========================================
// 4. ADMIN DATA KARYAWAN (CRUD) CONTROLLER
// ==========================================
let allEmployees = [];

async function loadEmployees() {
    const tbody = document.querySelector('#table-karyawan tbody');
    if (!tbody) return;

    try {
        const data = await apiFetch('/api/admin/karyawan');
        if (!data) return;
        allEmployees = data;

        if (allEmployees.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-light">Belum ada karyawan terdaftar.</td></tr>';
            return;
        }

        tbody.innerHTML = allEmployees.map(emp => {
            const initial = emp.nama_lengkap.charAt(0).toUpperCase();
            return `
                <tr>
                    <td data-label="Nama Lengkap" class="avatar-cell">
                        <div class="avatar-init">${initial}</div>
                        <div>
                            <strong>${emp.nama_lengkap}</strong>
                        </div>
                    </td>
                    <td data-label="Username">@${emp.username}</td>
                    <td data-label="Email">${emp.email}</td>
                    <td data-label="Aksi" class="td-actions">
                        <button class="btn btn-outline btn-xs btn-edit" data-id="${emp.id}">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-danger btn-xs btn-delete" data-id="${emp.id}">
                            <i class="fas fa-trash"></i> Hapus
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-red">Error: ${err.message}</td></tr>`;
    }
}

function initAdminKaryawanCRUD() {
    if (!document.body.classList.contains('admin-karyawan')) return;

    loadEmployees();

    const modal = document.getElementById('karyawan-modal');
    const form = document.getElementById('karyawan-form');
    const modalTitle = document.getElementById('modal-title');
    const closeBtn = document.getElementById('close-karyawan-modal');
    const cancelBtn = document.getElementById('btn-cancel-modal');
    const openAddModalBtn = document.getElementById('btn-open-add-modal');
    
    const inputId = document.getElementById('karyawan-id');
    const inputNama = document.getElementById('karyawan-nama');
    const inputUsername = document.getElementById('karyawan-username');
    const inputEmail = document.getElementById('karyawan-email');
    const inputPassword = document.getElementById('karyawan-password');
    const labelPassword = document.getElementById('label-password');
    const helpPassword = document.getElementById('help-password');
    const modalError = document.getElementById('modal-error-msg');

    const openModal = (editMode = false, emp = null) => {
        modalError.style.display = 'none';
        form.reset();
        
        if (editMode && emp) {
            modalTitle.innerText = 'Edit Karyawan';
            inputId.value = emp.id;
            inputNama.value = emp.nama_lengkap;
            inputUsername.value = emp.username;
            inputEmail.value = emp.email;
            labelPassword.innerText = 'Password Baru (Opsional)';
            helpPassword.style.display = 'block';
            inputPassword.required = false;
        } else {
            modalTitle.innerText = 'Tambah Karyawan';
            inputId.value = '';
            labelPassword.innerText = 'Password';
            helpPassword.style.display = 'none';
            inputPassword.required = true;
        }
        
        modal.style.display = 'flex';
    };

    const closeModal = () => { modal.style.display = 'none'; };

    openAddModalBtn.addEventListener('click', () => openModal(false));
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        modalError.style.display = 'none';

        const id = inputId.value;
        const payload = {
            nama_lengkap: inputNama.value.trim(),
            username: inputUsername.value.trim().toLowerCase(),
            email: inputEmail.value.trim().toLowerCase(),
            password: inputPassword.value
        };

        const isEdit = id !== '';
        const url = isEdit ? `/api/admin/karyawan/${id}` : '/api/admin/karyawan';
        const method = isEdit ? 'PUT' : 'POST';

        try {
            await apiFetch(url, { method, body: JSON.stringify(payload) });
            closeModal();
            loadEmployees();
        } catch (err) {
            modalError.innerText = err.message;
            modalError.style.display = 'block';
        }
    });

    document.addEventListener('click', async (e) => {
        const btnEdit = e.target.closest('.btn-edit');
        const btnDelete = e.target.closest('.btn-delete');

        if (btnEdit) {
            const empId = parseInt(btnEdit.dataset.id);
            const employee = allEmployees.find(emp => emp.id === empId);
            if (employee) openModal(true, employee);
        }

        if (btnDelete) {
            const empId = parseInt(btnDelete.dataset.id);
            if (confirm('Apakah Anda yakin ingin menghapus karyawan ini? Seluruh riwayat absensi juga akan dihapus.')) {
                try {
                    await apiFetch(`/api/admin/karyawan/${empId}`, { method: 'DELETE' });
                    loadEmployees();
                } catch (err) {
                    alert(err.message);
                }
            }
        }
    });
}


// ==========================================
// 5. KARYAWAN ABSEN PORTAL CONTROLLER
// ==========================================
let activeStream = null;
let currentAbsenType = 'masuk';

async function checkKaryawanStatus() {
    if (!document.body.classList.contains('karyawan-absen')) return;

    const badge = document.getElementById('status-badge-today');
    const rowMasuk = document.getElementById('row-log-masuk');
    const timeMasuk = document.getElementById('time-masuk');
    const btnViewMasuk = document.getElementById('btn-view-masuk');

    const rowKeluar = document.getElementById('row-log-keluar');
    const timeKeluar = document.getElementById('time-keluar');
    const btnViewKeluar = document.getElementById('btn-view-keluar');

    const statusSelector = document.getElementById('checkin-status-selector');
    const btnMasuk = document.getElementById('btn-submit-masuk');
    const btnKeluar = document.getElementById('btn-submit-keluar');
    const completeAlert = document.getElementById('msg-absen-complete');

    rowMasuk.style.display = 'none';
    rowKeluar.style.display = 'none';
    btnViewMasuk.style.display = 'none';
    btnViewKeluar.style.display = 'none';
    statusSelector.style.display = 'none';
    btnMasuk.style.display = 'none';
    btnKeluar.style.display = 'none';
    completeAlert.style.display = 'none';

    try {
        const status = await apiFetch('/api/karyawan/status');
        if (!status) return;

        if (!status.checked_in) {
            badge.innerText = 'Belum Absen';
            badge.className = 'status-badge badge-neutral';
            statusSelector.style.display = 'block';
            btnMasuk.style.display = 'block';
            currentAbsenType = 'masuk';
        }
        else if (status.checked_in && !status.checked_out) {
            if (status.status !== 'hadir') {
                badge.innerText = status.status;
                badge.className = `status-badge badge-${status.status}`;
                completeAlert.style.display = 'block';
            } else {
                badge.innerText = 'Sudah Masuk';
                badge.className = 'status-badge badge-hadir';
                
                rowMasuk.style.display = 'flex';
                timeMasuk.innerText = status.jam_masuk;
                if (status.foto_masuk) {
                    btnViewMasuk.style.display = 'inline-block';
                    btnViewMasuk.onclick = () => {
                        const modal = document.getElementById('photo-modal');
                        document.getElementById('modal-img-element').src = status.foto_masuk;
                        document.getElementById('modal-img-caption').innerText = `Foto Masuk Anda (${status.jam_masuk})`;
                        modal.style.display = 'flex';
                    };
                }
                
                btnKeluar.style.display = 'block';
                currentAbsenType = 'keluar';
            }
        }
        else {
            badge.innerText = 'Absensi Lengkap';
            badge.className = 'status-badge badge-hadir';

            rowMasuk.style.display = 'flex';
            timeMasuk.innerText = status.jam_masuk;
            if (status.foto_masuk) {
                btnViewMasuk.style.display = 'inline-block';
                btnViewMasuk.onclick = () => {
                    const modal = document.getElementById('photo-modal');
                    document.getElementById('modal-img-element').src = status.foto_masuk;
                    document.getElementById('modal-img-caption').innerText = `Foto Masuk Anda (${status.jam_masuk})`;
                    modal.style.display = 'flex';
                };
            }

            rowKeluar.style.display = 'flex';
            timeKeluar.innerText = status.jam_keluar;
            if (status.foto_keluar) {
                btnViewKeluar.style.display = 'inline-block';
                btnViewKeluar.onclick = () => {
                    const modal = document.getElementById('photo-modal');
                    document.getElementById('modal-img-element').src = status.foto_keluar;
                    document.getElementById('modal-img-caption').innerText = `Foto Keluar Anda (${status.jam_keluar})`;
                    modal.style.display = 'flex';
                };
            }

            completeAlert.style.display = 'block';
        }
    } catch (err) {
        console.error('Gagal cek status absensi:', err);
    }
}

function initWebcamAttendance() {
    if (!document.body.classList.contains('karyawan-absen')) return;

    const btnMasuk = document.getElementById('btn-submit-masuk');
    const btnKeluar = document.getElementById('btn-submit-keluar');
    const selectStatus = document.getElementById('select-status');

    const cameraModal = document.getElementById('camera-modal');
    const closeCamBtn = document.getElementById('close-camera-modal');
    const video = document.getElementById('webcam-stream');
    const canvas = document.getElementById('photo-canvas');
    const previewImg = document.getElementById('captured-preview');
    const camLoading = document.getElementById('camera-loading');

    const btnCapture = document.getElementById('btn-capture-photo');
    const btnRetake = document.getElementById('btn-retake-photo');
    const btnConfirm = document.getElementById('btn-confirm-photo');

    let capturedBase64 = null;

    const stopWebcam = () => {
        if (activeStream) {
            activeStream.getTracks().forEach(track => track.stop());
            activeStream = null;
        }
        video.srcObject = null;
    };

    const startWebcam = async () => {
        camLoading.style.display = 'flex';
        video.style.display = 'none';
        previewImg.style.display = 'none';
        
        btnCapture.style.display = 'inline-flex';
        btnRetake.style.display = 'none';
        btnConfirm.style.display = 'none';

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
                audio: false
            });
            activeStream = stream;
            video.srcObject = stream;
            video.onloadedmetadata = () => {
                camLoading.style.display = 'none';
                video.style.display = 'block';
            };
        } catch (err) {
            alert('Gagal mengakses kamera. Pastikan izin kamera sudah diberikan!');
            closeCameraModalFunc();
        }
    };

    const closeCameraModalFunc = () => {
        stopWebcam();
        cameraModal.style.display = 'none';
        capturedBase64 = null;
    };

    const handleAbsenMasukTrigger = async () => {
        const attendanceStatus = selectStatus.value;
        if (attendanceStatus === 'hadir') {
            cameraModal.style.display = 'flex';
            startWebcam();
        } else {
            if (confirm(`Apakah Anda yakin ingin mengajukan absen dengan status: ${attendanceStatus.toUpperCase()}?`)) {
                try {
                    btnMasuk.disabled = true;
                    btnMasuk.innerText = 'Mengirim...';
                    
                    const data = await apiFetch('/api/karyawan/absen', {
                        method: 'POST',
                        body: JSON.stringify({ type: 'masuk', status: attendanceStatus, foto: null })
                    });
                    alert(data.message);
                    checkKaryawanStatus();
                } catch (err) {
                    alert(err.message);
                } finally {
                    btnMasuk.disabled = false;
                    btnMasuk.innerText = 'Absen Masuk';
                }
            }
        }
    };

    btnMasuk.addEventListener('click', handleAbsenMasukTrigger);
    btnKeluar.addEventListener('click', () => {
        cameraModal.style.display = 'flex';
        startWebcam();
    });

    closeCamBtn.addEventListener('click', closeCameraModalFunc);

    btnCapture.addEventListener('click', () => {
        if (!activeStream) return;
        
        const ctx = canvas.getContext('2d');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        capturedBase64 = canvas.toDataURL('image/jpeg', 0.85);
        
        stopWebcam();

        previewImg.src = capturedBase64;
        video.style.display = 'none';
        previewImg.style.display = 'block';

        btnCapture.style.display = 'none';
        btnRetake.style.display = 'inline-flex';
        btnConfirm.style.display = 'inline-flex';
    });

    btnRetake.addEventListener('click', () => { startWebcam(); });

    btnConfirm.addEventListener('click', async () => {
        if (!capturedBase64) return;
        
        btnConfirm.disabled = true;
        btnConfirm.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengirim...';

        try {
            const data = await apiFetch('/api/karyawan/absen', {
                method: 'POST',
                body: JSON.stringify({
                    type: currentAbsenType,
                    status: currentAbsenType === 'masuk' ? selectStatus.value : 'hadir',
                    foto: capturedBase64
                })
            });
            alert(data.message);
            closeCameraModalFunc();
            checkKaryawanStatus();
        } catch (err) {
            alert(err.message);
        } finally {
            btnConfirm.disabled = false;
            btnConfirm.innerText = 'Konfirmasi & Kirim';
        }
    });
}


// ==========================================
// 6. KARYAWAN HISTORY CONTROLLER
// ==========================================
async function loadKaryawanHistory(bulan, tahun) {
    const tbody = document.querySelector('#table-history tbody');
    if (!tbody) return;

    try {
        const history = await apiFetch(`/api/karyawan/history?bulan=${bulan}&tahun=${tahun}`);
        if (!history) return;

        if (history.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-light">Tidak ada data absensi pada periode ini.</td></tr>';
            return;
        }

        tbody.innerHTML = history.map(item => {
            const photoMasukHtml = item.foto_masuk 
                ? `<img src="${item.foto_masuk}" class="img-thumb" data-caption="Foto Masuk (${item.tanggal})" alt="Masuk">` 
                : '<span class="text-light">-</span>';
                
            const photoKeluarHtml = item.foto_keluar 
                ? `<img src="${item.foto_keluar}" class="img-thumb" data-caption="Foto Keluar (${item.tanggal})" alt="Keluar">` 
                : '<span class="text-light">-</span>';
                
            const jamMasuk = item.jam_masuk || '-';
            const jamKeluar = item.jam_keluar || '-';
            
            return `
                <tr>
                    <td data-label="Tanggal"><strong>${item.tanggal}</strong></td>
                    <td data-label="Status"><span class="badge badge-${item.status}">${item.status}</span></td>
                    <td data-label="Jam Masuk">${jamMasuk}</td>
                    <td data-label="Foto Masuk">${photoMasukHtml}</td>
                    <td data-label="Jam Keluar">${jamKeluar}</td>
                    <td data-label="Foto Keluar">${photoKeluarHtml}</td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-red">Error: ${err.message}</td></tr>`;
    }
}

function initKaryawanHistory() {
    if (!document.body.classList.contains('karyawan-riwayat')) return;

    const selectBulan = document.getElementById('filter-bulan');
    const selectTahun = document.getElementById('filter-tahun');
    const applyBtn = document.getElementById('btn-apply-filters');

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    selectTahun.innerHTML = '';
    for (let yr = currentYear; yr >= currentYear - 5; yr--) {
        const opt = document.createElement('option');
        opt.value = yr;
        opt.innerText = yr;
        selectTahun.appendChild(opt);
    }

    selectBulan.value = currentMonth;
    selectTahun.value = currentYear;

    loadKaryawanHistory(currentMonth, currentYear);

    applyBtn.addEventListener('click', () => {
        loadKaryawanHistory(selectBulan.value, selectTahun.value);
    });
}


// ==========================================
// DOM CONTENT LOADED - APPLICATION ROUTER
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    
    startLiveClock();
    initMobileSidebar();
    initPhotoViewer();
    initLogout();

    initLoginPage();
    initResetPasswordPage();
    initAdminDashboard();
    initAdminKaryawanCRUD();
    checkKaryawanStatus();
    initWebcamAttendance();
    initKaryawanHistory();
});
