import uuid
from datetime import datetime, date, timedelta
from functools import wraps
from flask import Blueprint, request, jsonify, session, send_from_directory, current_app, redirect
from werkzeug.exceptions import HTTPException
from config import Config
from backend.models import db, User, ResetToken, Absensi

# === CLOUDINARY SETUP ===
_cloudinary_configured = False
try:
    import cloudinary
    import cloudinary.uploader
    _cloud_name = Config.CLOUDINARY_CLOUD_NAME
    _api_key = Config.CLOUDINARY_API_KEY
    _api_secret = Config.CLOUDINARY_API_SECRET
    if _cloud_name and _api_key and _api_secret:
        cloudinary.config(
            cloud_name=_cloud_name,
            api_key=_api_key,
            api_secret=_api_secret
        )
        _cloudinary_configured = True
        print('[INFO] Cloudinary berhasil dikonfigurasi.')
    else:
        print('[WARN] Konfigurasi Cloudinary tidak lengkap. Upload foto akan ditolak.')
except Exception as _e:
    print(f'[WARN] Cloudinary tidak tersedia: {_e}. Upload foto akan ditolak.')


def upload_foto(base64_str, folder='absensi'):
    """Upload foto base64 ke Cloudinary. Hanya menggunakan Cloudinary, tanpa fallback lokal."""
    if not _cloudinary_configured:
        print('[ERROR] Cloudinary tidak dikonfigurasi. Upload foto tidak dapat dilakukan.')
        return None
    
    try:
        # Cloudinary menerima base64 data URI langsung
        result = cloudinary.uploader.upload(
            base64_str,
            folder=folder,
            resource_type='image',
            overwrite=False
        )
        return result.get('secure_url')
    except Exception as e:
        print(f'[ERROR] Cloudinary upload gagal: {e}')
        return None

bp = Blueprint('main', __name__)


@bp.app_errorhandler(HTTPException)
def handle_http_exception(error):
    if request.path.startswith('/api/'):
        return jsonify({'error': error.description or error.name}), error.code
    return error


@bp.app_errorhandler(Exception)
def handle_unexpected_exception(error):
    if request.path.startswith('/api/'):
        current_app.logger.exception(error)
        return jsonify({'error': 'Terjadi kesalahan server. Silakan coba lagi.'}), 500
    raise error

# === MIDDLEWARE / DECORATORS ===
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            # API route → selalu kembalikan JSON 401, jangan redirect ke HTML
            if request.path.startswith('/api/'):
                return jsonify({'error': 'Silakan login terlebih dahulu', 'logged_in': False}), 401
            return redirect('/')
        return f(*args, **kwargs)
    return decorated_function

def role_required(role):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user_id' not in session:
                if request.path.startswith('/api/'):
                    return jsonify({'error': 'Silakan login terlebih dahulu', 'logged_in': False}), 401
                return redirect('/')
            if session.get('role') != role:
                if request.path.startswith('/api/'):
                    return jsonify({'error': 'Akses ditolak. Role tidak sesuai.'}), 403
                return redirect('/')
            return f(*args, **kwargs)
        return decorated_function
    return decorator


# === HELPER FUNCTIONS ===
def send_reset_email(email, reset_link):
    api_key = Config.RESEND_API_KEY
    if not api_key:
        print('[ERROR] RESEND_API_KEY belum diatur. Email reset password tidak dikirim.')
        return False

    try:
        import resend

        resend.api_key = api_key
        result = resend.Emails.send({
            "from": Config.EMAIL_FROM,
            "to": [email],
            "subject": "Reset Password - Sistem Absensi",
            "html": f"""
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                <h2 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 10px;">Reset Password</h2>
                <p>Halo,</p>
                <p>Kami menerima permintaan untuk mereset password akun Absensi Anda. Silakan klik tombol di bawah ini:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{reset_link}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">Reset Password</a>
                </div>
                <p>Atau copy link berikut: <a href="{reset_link}">{reset_link}</a></p>
                <p style="color: #6b7280; font-size: 13px;">Link ini hanya berlaku selama 1 jam.</p>
            </div>
            """
        })
        return bool(result.get('id'))
    except Exception as e:
        print(f"Failed to send email via Resend: {e}")
        return False


# === PAGE SERVING ROUTES ===
@bp.route('/')
def index():
    if 'user_id' in session:
        if session.get('role') == 'admin':
            return redirect('/admin/dashboard')
        return redirect('/karyawan/absen')
    return send_from_directory(current_app.static_folder, 'index.html')

@bp.route('/admin/dashboard')
@role_required('admin')
def admin_dashboard():
    return send_from_directory(current_app.static_folder, 'admin/dashboard.html')

@bp.route('/admin/data-karyawan')
@role_required('admin')
def admin_data_karyawan():
    return send_from_directory(current_app.static_folder, 'admin/data-karyawan.html')

@bp.route('/karyawan/absen')
@role_required('karyawan')
def karyawan_absen():
    return send_from_directory(current_app.static_folder, 'karyawan/absen.html')

@bp.route('/karyawan/riwayat')
@role_required('karyawan')
def karyawan_riwayat():
    return send_from_directory(current_app.static_folder, 'karyawan/riwayat.html')

@bp.route('/reset-password')
def reset_password_page():
    return send_from_directory(current_app.static_folder, 'reset-password.html')


# === AUTHENTICATION APIS ===
@bp.route('/api/auth/login', methods=['POST'])
def api_login():
    data = request.get_json() or {}
    username_or_email = data.get('username', '').strip()
    password = data.get('password', '')

    if not username_or_email or not password:
        return jsonify({'error': 'Username/Email dan Password wajib diisi'}), 400

    user = User.query.filter(
        (User.username == username_or_email) | (User.email == username_or_email)
    ).first()

    if not user or not user.check_password(password):
        return jsonify({'error': 'Username atau Password salah'}), 401

    session['user_id'] = user.id
    session['username'] = user.username
    session['role'] = user.role
    session['nama_lengkap'] = user.nama_lengkap

    return jsonify({
        'message': 'Login berhasil',
        'user': user.to_dict()
    })

@bp.route('/api/auth/logout', methods=['POST', 'GET'])
def api_logout():
    session.clear()
    return jsonify({'message': 'Logout berhasil'})

@bp.route('/api/auth/me', methods=['GET'])
def api_me():
    if 'user_id' not in session:
        return jsonify({'logged_in': False}), 200
    
    user = User.query.get(session['user_id'])
    if not user:
        session.clear()
        return jsonify({'logged_in': False}), 200

    return jsonify({
        'logged_in': True,
        'user': user.to_dict()
    })

@bp.route('/api/auth/forgot-password', methods=['POST'])
def api_forgot_password():
    data = request.get_json() or {}
    email = data.get('email', '').strip()

    if not email:
        return jsonify({'error': 'Email wajib diisi'}), 400

    user = User.query.filter_by(email=email).first()
    
    if user:
        token = uuid.uuid4().hex
        expires_at = datetime.utcnow() + timedelta(hours=1)
        
        reset_token = ResetToken(user_id=user.id, token=token, expires_at=expires_at)
        db.session.add(reset_token)
        db.session.commit()

        reset_link = f"{Config.FRONTEND_URL.rstrip('/')}/reset-password?token={token}"
        sent = send_reset_email(email, reset_link)
        
        if not sent:
            db.session.delete(reset_token)
            db.session.commit()
            return jsonify({'error': 'Gagal mengirim email reset password. Periksa konfigurasi Resend.'}), 500

    return jsonify({'message': 'Jika email terdaftar, instruksi reset password telah dikirim.'})

@bp.route('/api/auth/reset-password', methods=['POST'])
def api_reset_password():
    data = request.get_json() or {}
    token = data.get('token', '').strip()
    new_password = data.get('password', '')

    if not token or not new_password:
        return jsonify({'error': 'Token dan Password baru wajib diisi'}), 400

    reset_token = ResetToken.query.filter_by(token=token).first()
    if not reset_token or not reset_token.is_valid():
        return jsonify({'error': 'Token tidak valid atau telah kedaluwarsa'}), 400

    user = User.query.get(reset_token.user_id)
    if not user:
        return jsonify({'error': 'User tidak ditemukan'}), 404

    user.set_password(new_password)
    reset_token.used = True
    db.session.commit()

    return jsonify({'message': 'Password berhasil diperbarui. Silakan login kembali.'})


# === KARYAWAN ATTENDANCE APIS ===
@bp.route('/api/karyawan/status', methods=['GET'])
@role_required('karyawan')
def karyawan_status():
    user_id = session['user_id']
    today = date.today()

    absensi = Absensi.query.filter_by(user_id=user_id, tanggal=today).first()
    if not absensi:
        return jsonify({'checked_in': False, 'checked_out': False})

    return jsonify({
        'checked_in': absensi.jam_masuk is not None,
        'checked_out': absensi.jam_keluar is not None,
        'jam_masuk': absensi.jam_masuk.strftime('%H:%M:%S') if absensi.jam_masuk else None,
        'jam_keluar': absensi.jam_keluar.strftime('%H:%M:%S') if absensi.jam_keluar else None,
        'foto_masuk': absensi.foto_masuk,
        'foto_keluar': absensi.foto_keluar,
        'status': absensi.status
    })

@bp.route('/api/karyawan/absen', methods=['POST'])
@role_required('karyawan')
def karyawan_absen_post():
    user_id = session['user_id']
    today = date.today()
    now_time = datetime.now().time()
    
    data = request.get_json() or {}
    absen_type = data.get('type')       # 'masuk' or 'keluar'
    status = data.get('status', 'hadir')
    foto_base64 = data.get('foto')

    if absen_type not in ['masuk', 'keluar']:
        return jsonify({'error': 'Tipe absensi tidak valid'}), 400

    foto_url = None
    if foto_base64 and status == 'hadir':
        foto_url = upload_foto(foto_base64, folder='absensi')
        if not foto_url:
            return jsonify({'error': 'Gagal mengupload foto. Coba lagi.'}), 500
    elif status == 'hadir':
        return jsonify({'error': 'Foto wajah wajib diambil untuk status hadir'}), 400

    absensi = Absensi.query.filter_by(user_id=user_id, tanggal=today).first()

    if absen_type == 'masuk':
        if absensi:
            return jsonify({'error': 'Anda sudah melakukan absensi masuk hari ini'}), 400
        
        absensi = Absensi(
            user_id=user_id,
            tanggal=today,
            status=status
        )
        if status == 'hadir':
            absensi.jam_masuk = now_time
            absensi.foto_masuk = foto_url
        else:
            absensi.jam_masuk = None
            absensi.foto_masuk = None
            
        db.session.add(absensi)
        db.session.commit()
        return jsonify({'message': f'Absen masuk ({status}) berhasil dicatat', 'data': absensi.to_dict(False)})

    else:  # keluar
        if not absensi:
            return jsonify({'error': 'Anda harus melakukan absen masuk terlebih dahulu'}), 400
        if absensi.status != 'hadir':
            return jsonify({'error': 'Status absensi hari ini bukan hadir (sakit/izin)'}), 400
        if absensi.jam_keluar:
            return jsonify({'error': 'Anda sudah melakukan absensi keluar hari ini'}), 400

        absensi.jam_keluar = now_time
        absensi.foto_keluar = foto_url
        db.session.commit()
        return jsonify({'message': 'Absen keluar berhasil dicatat', 'data': absensi.to_dict(False)})

@bp.route('/api/karyawan/history', methods=['GET'])
@role_required('karyawan')
def karyawan_history():
    user_id = session['user_id']
    bulan = request.args.get('bulan', type=int)
    tahun = request.args.get('tahun', type=int)

    query = Absensi.query.filter_by(user_id=user_id)

    if bulan and tahun:
        start_date = date(tahun, bulan, 1)
        if bulan == 12:
            end_date = date(tahun + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(tahun, bulan + 1, 1) - timedelta(days=1)
        query = query.filter(Absensi.tanggal.between(start_date, end_date))

    history = query.order_by(Absensi.tanggal.desc()).all()
    return jsonify([item.to_dict(False) for item in history])


# === ADMIN APIS ===
@bp.route('/api/admin/stats', methods=['GET'])
@role_required('admin')
def admin_stats():
    today = date.today()
    
    total_karyawan = User.query.filter_by(role='karyawan').count()
    today_absensi = Absensi.query.filter_by(tanggal=today).all()
    
    hadir_count = sum(1 for a in today_absensi if a.status == 'hadir')
    sakit_count = sum(1 for a in today_absensi if a.status == 'sakit')
    izin_count = sum(1 for a in today_absensi if a.status == 'izin')
    alfa_count = max(0, total_karyawan - (hadir_count + sakit_count + izin_count))

    return jsonify({
        'total_karyawan': total_karyawan,
        'hadir': hadir_count,
        'sakit': sakit_count,
        'izin': izin_count,
        'alfa': alfa_count
    })

@bp.route('/api/admin/logs', methods=['GET'])
@role_required('admin')
def admin_logs():
    tanggal_str = request.args.get('tanggal')
    if tanggal_str:
        try:
            tanggal = datetime.strptime(tanggal_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Format tanggal tidak valid (harus YYYY-MM-DD)'}), 400
    else:
        tanggal = date.today()

    logs = Absensi.query.filter_by(tanggal=tanggal).all()
    logs_sorted = sorted(logs, key=lambda x: x.created_at, reverse=True)
    return jsonify([log.to_dict(include_user=True) for log in logs_sorted])

@bp.route('/api/admin/karyawan', methods=['GET', 'POST'])
@role_required('admin')
def admin_karyawan_list_create():
    if request.method == 'GET':
        karyawans = User.query.filter_by(role='karyawan').order_by(User.id.desc()).all()
        return jsonify([k.to_dict() for k in karyawans])
    
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')
    nama_lengkap = data.get('nama_lengkap', '').strip()

    if not username or not email or not password or not nama_lengkap:
        return jsonify({'error': 'Semua field wajib diisi'}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username sudah digunakan'}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email sudah digunakan'}), 400

    new_user = User(username=username, email=email, nama_lengkap=nama_lengkap, role='karyawan')
    new_user.set_password(password)
    
    db.session.add(new_user)
    db.session.commit()

    return jsonify({
        'message': 'Karyawan berhasil ditambahkan',
        'user': new_user.to_dict()
    }), 201

@bp.route('/api/admin/karyawan/<int:user_id>', methods=['PUT', 'DELETE'])
@role_required('admin')
def admin_karyawan_update_delete(user_id):
    user = User.query.get(user_id)
    if not user or user.role != 'karyawan':
        return jsonify({'error': 'Karyawan tidak ditemukan'}), 404

    if request.method == 'PUT':
        data = request.get_json() or {}
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        nama_lengkap = data.get('nama_lengkap', '').strip()
        password = data.get('password', '')

        if not username or not email or not nama_lengkap:
            return jsonify({'error': 'Username, email, dan nama lengkap wajib diisi'}), 400

        if username != user.username and User.query.filter_by(username=username).first():
            return jsonify({'error': 'Username sudah digunakan'}), 400
        if email != user.email and User.query.filter_by(email=email).first():
            return jsonify({'error': 'Email sudah digunakan'}), 400

        user.username = username
        user.email = email
        user.nama_lengkap = nama_lengkap
        if password:
            user.set_password(password)

        db.session.commit()
        return jsonify({'message': 'Karyawan berhasil diperbarui', 'user': user.to_dict()})

    # DELETE
    db.session.delete(user)
    db.session.commit()
    return jsonify({'message': 'Karyawan berhasil dihapus'})
