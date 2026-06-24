CREATE DATABASE Absens;
use Absensi;

CREATE TABLE `absensi` (
    `id` int NOT NULL AUTO_INCREMENT,
    `user_id` int NOT NULL,
    `tanggal` date NOT NULL,
    `jam_masuk` time DEFAULT NULL,
    `jam_keluar` time DEFAULT NULL,
    `foto_masuk` varchar(500) DEFAULT NULL,
    `foto_keluar` varchar(500) DEFAULT NULL,
    `status` varchar(20) DEFAULT 'hadir',
    `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
    KEY `fk_absensi_user` (`user_id`),
    KEY `idx_absensi_tanggal` (`tanggal`),
    KEY `idx_absensi_user` (`user_id`),
    CONSTRAINT `fk_absensi_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_bin AUTO_INCREMENT = 120001

CREATE TABLE `reset_tokens` (
    `id` int NOT NULL AUTO_INCREMENT,
    `user_id` int NOT NULL,
    `token` varchar(100) NOT NULL,
    `expires_at` datetime NOT NULL,
    `used` tinyint(1) DEFAULT '0',
    `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
    UNIQUE KEY `token` (`token`),
    KEY `fk_reset_token_user` (`user_id`),
    KEY `idx_reset_token_token` (`token`),
    CONSTRAINT `fk_reset_token_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_bin AUTO_INCREMENT = 30001

CREATE TABLE `users` (
    `id` int NOT NULL AUTO_INCREMENT,
    `username` varchar(100) NOT NULL,
    `email` varchar(120) NOT NULL,
    `password_hash` varchar(256) NOT NULL,
    `role` enum('admin', 'karyawan') DEFAULT 'karyawan',
    `nama_lengkap` varchar(100) DEFAULT NULL,
    `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
    UNIQUE KEY `username` (`username`),
    UNIQUE KEY `email` (`email`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_bin AUTO_INCREMENT = 30001

INSERT INTO users (
    username,
    email,
    password_hash,
    role,
    nama_lengkap
) VALUES (
    'admin',
    'admin@gmail.com',
    'scrypt:32768:8:1$zETZSFKq0u1xfZt7$851351c43cf026313c409672d5a96673af6cd6fdfc81fc6cb9e0c5019d582a4bc8c0d09b45d13f2160abdad54d0b03e14995770c4a698ca9527df7e76b04bfa5',
    'admin',
    'Administrator'
);