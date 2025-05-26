# WhatsApp API Service

WhatsApp API Service menggunakan Node.js dan Baileys untuk menghubungkan WhatsApp dengan backend Flask (RAG chatbot).

## Fitur

- Menerima pesan dari WhatsApp dan meneruskannya ke backend Flask
- Mengirim balasan dari Flask kembali ke pengguna WhatsApp
- Autentikasi WhatsApp dengan QR code
- REST API dengan Express.js
- Logging dengan Morgan dan Pino

## Persyaratan

- Node.js (versi 14 atau lebih baru)
- npm (Node Package Manager)
- Backend Flask yang berjalan di http://localhost:5000/ask (atau URL yang dikonfigurasi)

## Instalasi

1. Clone atau download repository ini
2. Masuk ke direktori project:
   ```
   cd whatsapp-service
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Salin file `.env.example` menjadi `.env` dan sesuaikan konfigurasi:
   ```
   cp .env.example .env
   ```
5. Edit file `.env` sesuai kebutuhan

## Menjalankan Aplikasi

### Mode Development (dengan auto-reload)

```
npm run dev
```

### Mode Production

```
npm start
```

## Autentikasi WhatsApp

Saat pertama kali dijalankan, aplikasi akan menampilkan QR code di terminal. Scan QR code tersebut dengan WhatsApp di smartphone Anda untuk mengautentikasi.

## Endpoint API

### 1. Menerima Pesan dari Baileys Webhook

- **URL**: `/incoming`
- **Method**: POST
- **Body**:
  ```json
  {
    "messages": [
      {
        "key": {
          "remoteJid": "6281234567890@s.whatsapp.net",
          "fromMe": false
        },
        "pushName": "User Name",
        "message": {
          "conversation": "Pesan dari pengguna"
        }
      }
    ]
  }
  ```

### 2. Mengirim Pesan ke WhatsApp

- **URL**: `/send`
- **Method**: POST
- **Body**:
  ```json
  {
    "to": "6281234567890",
    "message": "Pesan yang akan dikirim"
  }
  ```

### 3. Health Check

- **URL**: `/health`
- **Method**: GET
- **Response**:
  ```json
  {
    "status": "ok",
    "timestamp": "2025-05-25T01:39:00.000Z"
  }
  ```

## Struktur Project

```
whatsapp-service/
├── index.js                 # Entry point aplikasi
├── controllers/
│   └── messageController.js # Controller untuk menangani pesan
├── services/
│   └── baileysClient.js     # Service untuk koneksi WhatsApp dengan Baileys
├── .env.example             # Template konfigurasi environment
├── README.md                # Dokumentasi
```

## Integrasi dengan Flask Backend

Pastikan backend Flask Anda memiliki endpoint `/ask` yang menerima request dengan format:

```json
{
  "sender": "6281234567890@s.whatsapp.net",
  "message": "Pesan dari pengguna",
  "sender_name": "User Name"
}
```

Dan mengembalikan response dengan format:

```json
{
  "response": "Balasan dari chatbot"
}
```

## Troubleshooting

### Masalah Koneksi WhatsApp

Jika koneksi WhatsApp terputus, aplikasi akan mencoba untuk terhubung kembali secara otomatis. Jika masih gagal, coba hapus folder `auth_info_baileys` dan restart aplikasi untuk mendapatkan QR code baru.

### Masalah dengan Backend Flask

Pastikan backend Flask berjalan dan dapat diakses dari aplikasi ini. Periksa URL yang dikonfigurasi di file `.env` (FLASK_BACKEND_URL).

## Menjalankan di EC2 atau Laptop Lokal

Aplikasi ini dirancang untuk dapat dijalankan langsung di EC2 atau laptop lokal tanpa memerlukan Docker. Pastikan Node.js terinstal di mesin target.
