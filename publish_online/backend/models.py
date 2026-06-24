from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

try:
    import bcrypt
except ImportError:
    bcrypt = None

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.Enum('admin', 'karyawan'), default='karyawan', nullable=False)
    nama_lengkap = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship to reset tokens and attendances
    reset_tokens = db.relationship('ResetToken', backref='user', cascade='all, delete-orphan', lazy=True)
    attendances = db.relationship('Absensi', backref='user', cascade='all, delete-orphan', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        if not self.password_hash:
            return False

        if self.password_hash.startswith(('$2a$', '$2b$', '$2y$')):
            if bcrypt is None:
                return False
            try:
                return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))
            except (TypeError, ValueError):
                return False

        try:
            return check_password_hash(self.password_hash, password)
        except (TypeError, ValueError):
            return False

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'role': self.role,
            'nama_lengkap': self.nama_lengkap,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None
        }


class ResetToken(db.Model):
    __tablename__ = 'reset_tokens'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    token = db.Column(db.String(100), unique=True, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    used = db.Column(db.Boolean, default=False, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def is_valid(self):
        return not self.used and datetime.utcnow() < self.expires_at


class Absensi(db.Model):
    __tablename__ = 'absensi'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    tanggal = db.Column(db.Date, nullable=False)
    jam_masuk = db.Column(db.Time, nullable=True)
    jam_keluar = db.Column(db.Time, nullable=True)
    foto_masuk = db.Column(db.String(500), nullable=True)
    foto_keluar = db.Column(db.String(500), nullable=True)
    status = db.Column(db.String(20), default='hadir', nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self, include_user=True):
        data = {
            'id': self.id,
            'user_id': self.user_id,
            'tanggal': self.tanggal.strftime('%Y-%m-%d') if self.tanggal else None,
            'jam_masuk': self.jam_masuk.strftime('%H:%M:%S') if self.jam_masuk else None,
            'jam_keluar': self.jam_keluar.strftime('%H:%M:%S') if self.jam_keluar else None,
            'foto_masuk': self.foto_masuk,
            'foto_keluar': self.foto_keluar,
            'status': self.status,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None
        }
        if include_user and self.user:
            data['nama_lengkap'] = self.user.nama_lengkap
            data['username'] = self.user.username
        return data
