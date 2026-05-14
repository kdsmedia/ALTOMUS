# ALTOMUS — Platform Game Live TikTok
### by ALTOMEDIA Karawang

---

## Persyaratan Server (VPS / Lokal)
- **Node.js** v18 atau lebih baru
- **npm** v8+
- Koneksi internet aktif
- Port **5000** tidak diblokir firewall

---

## Cara Menjalankan

### 1. Install dependensi
```bash
cd ALTOMEDIA
npm install
```

### 2. Jalankan server
```bash
node server.js
```
atau gunakan npm:
```bash
npm start
```

### 3. Akses aplikasi
Buka browser → `http://localhost:5000`

---

## Menjalankan di VPS / Production
Gunakan **PM2** agar server tetap berjalan meski terminal ditutup:

```bash
# Install PM2 global
npm install -g pm2

# Jalankan dengan PM2
pm2 start server.js --name altomus

# Auto-start saat reboot
pm2 startup
pm2 save
```

---

## Konfigurasi Firebase
Proyek ini menggunakan Firebase (sudah terkonfigurasi di dalam kode).
- **Project ID:** laci-222f3
- **Auth:** Email/Password
- **Database:** Firestore

### Firestore Security Rules (wajib diset di Firebase Console)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null;
    }
    match /transactions/{id} {
      allow read, write: if request.auth != null;
    }
    match /topups/{id} {
      allow read, write: if request.auth != null;
    }
    match /withdrawals/{id} {
      allow read, write: if request.auth != null;
    }
    match /settings/{id} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

### Authorized Domains (Firebase Console → Authentication → Settings)
Tambahkan domain VPS Anda, contoh:
- `localhost`
- `yourdomain.com`
- `123.456.789.0` (IP VPS)

---

## Akun Admin
- **Nomor HP:** 085813899649
- **Password:** Kdsmedia@123
- **Panel Admin:** http://localhost:5000/admin.html

---

## Struktur Folder
```
ALTOMEDIA/
├── server.js          ← Server utama (Express + WebSocket)
├── package.json
├── README-SETUP.md    ← Panduan ini
└── public/
    ├── index.html     ← Aplikasi utama (user)
    ├── admin.html     ← Panel admin
    ├── bultok.html    ← Game BulTok Live
    ├── bg/            ← Gambar background
    ├── sounds/        ← Efek suara game
    ├── musiklive/     ← Game MusicLive
    └── printok/       ← Game PrintOK
```

---

## Firestore Collections
| Collection     | Fungsi |
|----------------|--------|
| `users`        | Data profil pengguna |
| `transactions` | Pembelian paket |
| `topups`       | Request top up saldo |
| `withdrawals`  | Request tarik saldo |
| `settings/app` | Pengaturan (paket, kontak, referral) |

---

## Port Default
Server berjalan di port **5000**. Untuk mengubah, edit baris di `server.js`:
```js
const PORT = process.env.PORT || 5000;
```

---

*ALTOMUS © 2025 ALTOMEDIA Indonesia*
