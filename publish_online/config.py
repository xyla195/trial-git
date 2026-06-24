import os
from dotenv import load_dotenv
from urllib.parse import urlparse

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-key-ganti-nanti')
    
    # 1. Ambil URL Database (Raw string untuk parsing manual di backend)
    DATABASE_URL = os.environ.get('DATABASE_URL')
    
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL wajib diisi di .env")
    _database_url = urlparse(DATABASE_URL)
    if _database_url.scheme.startswith('sqlite') or _database_url.hostname in {'localhost', '127.0.0.1'}:
        raise ValueError("DATABASE_URL harus mengarah ke database online, bukan database lokal")

    # Konfigurasi Cloudinary. Bisa pakai CLOUDINARY_URL atau variabel terpisah.
    CLOUDINARY_URL = os.environ.get('CLOUDINARY_URL')
    _cloudinary_url = urlparse(CLOUDINARY_URL) if CLOUDINARY_URL else None
    CLOUDINARY_CLOUD_NAME = os.environ.get(
        'CLOUDINARY_CLOUD_NAME',
        _cloudinary_url.hostname if _cloudinary_url else None
    )
    CLOUDINARY_API_KEY = os.environ.get(
        'CLOUDINARY_API_KEY',
        _cloudinary_url.username if _cloudinary_url else None
    )
    CLOUDINARY_API_SECRET = os.environ.get(
        'CLOUDINARY_API_SECRET',
        _cloudinary_url.password if _cloudinary_url else None
    )
    RESEND_API_KEY = os.environ.get('RESEND_API_KEY')
    EMAIL_FROM = os.environ.get('EMAIL_FROM', 'Absensi Kantor <onboarding@resend.dev>')
    FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:5000')

    if RESEND_API_KEY and not RESEND_API_KEY.startswith('re_'):
        raise ValueError("RESEND_API_KEY tidak valid. API key Resend biasanya diawali dengan 're_'")
