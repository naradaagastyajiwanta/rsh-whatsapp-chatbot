# RSH WhatsApp Chatbot Admin Dashboard

Admin dashboard untuk memantau interaksi pengguna dengan chatbot WhatsApp RSH Satu Bumi. Dashboard ini memungkinkan admin untuk melihat riwayat percakapan, mencari pesan berdasarkan kata kunci, dan melihat statistik penggunaan.

## Fitur

- **Live Chat Viewer / Log Viewer**: Menampilkan daftar semua interaksi dalam bentuk tabel
- **Search & Filter**: Pencarian berdasarkan nomor WhatsApp atau kata kunci dalam pesan
- **Chat Detail View**: Tampilan detail percakapan lengkap per nomor WhatsApp
- **Statistik**: Jumlah pertanyaan, pengguna aktif, dan waktu respons rata-rata

## Teknologi

- **Frontend**: Next.js dengan TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Headless UI
- **Icons**: Heroicons
- **Date Formatting**: date-fns
- **API Client**: Axios

## Struktur Proyek

```
chatbot-admin-dashboard/
├── src/
│   ├── app/              # Next.js App Router
│   ├── components/       # React components
│   │   ├── ChatTable.tsx
│   │   ├── ChatDetailModal.tsx
│   │   ├── SearchBar.tsx
│   │   ├── StatsCards.tsx
│   │   └── Sidebar.tsx
│   ├── services/         # API services
│   │   └── api.ts
│   └── types/            # TypeScript type definitions
│       └── chat.ts
├── public/               # Static assets
├── .env.example          # Environment variables template
├── tailwind.config.js    # Tailwind CSS configuration
├── package.json          # Project dependencies
└── README.md             # Project documentation
```

## Cara Menjalankan

### Prasyarat

- Node.js versi 18.0.0 atau lebih baru
- npm atau yarn

### Instalasi

1. Clone repositori ini
   ```bash
   git clone <repository-url>
   cd chatbot-admin-dashboard
   ```

2. Install dependensi
   ```bash
   npm install
   # atau
   yarn install
   ```

3. Salin file `.env.example` menjadi `.env.local` dan sesuaikan konfigurasi
   ```bash
   cp .env.example .env.local
   ```

4. Jalankan server pengembangan
   ```bash
   npm run dev
   # atau
   yarn dev
   ```

5. Buka [http://localhost:3000](http://localhost:3000) di browser Anda

## Integrasi dengan Backend

Dashboard ini dirancang untuk terhubung dengan backend Flask yang menyediakan API untuk mengakses data chat WhatsApp. Endpoint API yang digunakan:

- `GET /chats`: Mendapatkan daftar semua chat
- `GET /chats/:id`: Mendapatkan detail chat berdasarkan ID
- `GET /chats/search?q=query`: Mencari chat berdasarkan kata kunci
- `GET /stats`: Mendapatkan statistik chat

Untuk saat ini, dashboard menggunakan data dummy yang disediakan dalam file `src/services/api.ts`. Untuk mengintegrasikan dengan backend nyata, perbarui URL API di file `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

## Deployment

Untuk men-deploy aplikasi ke production:

1. Build aplikasi
   ```bash
   npm run build
   # atau
   yarn build
   ```

2. Jalankan aplikasi production
   ```bash
   npm start
   # atau
   yarn start
   ```

Atau deploy ke platform seperti Vercel:

```bash
vercel
```

## Pengembangan Selanjutnya

Beberapa fitur yang dapat ditambahkan di masa depan:

- Autentikasi admin
- Fitur export data ke CSV/Excel
- Notifikasi real-time untuk pesan baru
- Dashboard analitik yang lebih detail
- Integrasi dengan sistem manajemen pengguna

## Lisensi

Hak Cipta © 2025 RSH Satu Bumi. Semua hak dilindungi undang-undang.
