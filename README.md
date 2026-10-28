# AKTIVO — Interactive classes & meetings

Platform presentasi interaktif bergaya Mentimeter: polling, kuis berpoin, word cloud, Q&A, skala, ranking, leaderboard, timer, dan laporan PDF.

- **Frontend**: situs statis di **GitHub Pages** (folder ini).
- **Backend**: **Google Apps Script** (folder `apps-script/`) sebagai API JSON. Data tersimpan di Google Sheet Anda.

```
├── index.html          Halaman awal + layar peserta
├── host.html           Dashboard host
├── presenter.html      Layar presenter (proyektor)
├── config.js           ← URL API Apps Script & nomor WhatsApp bantuan
├── assets/
│   ├── css/            Desain (aktivo.css + per halaman)
│   ├── js/             api.js (koneksi ke Apps Script), common.js, qr.js, script per halaman
│   └── img/logo.png
├── apps-script/        Kode backend — TIDAK dipakai GitHub Pages, ditempel ke Apps Script
│   ├── Code.gs
│   ├── Logo.html       (logo untuk laporan PDF)
│   └── appsscript.json (manifest, opsional)
└── .nojekyll
```

---

## 1. Perbarui backend di Apps Script

1. Buka proyek Apps Script AKTIVO (Extensions → Apps Script dari spreadsheet-nya).
2. Ganti seluruh isi **`Code.gs`** dengan `apps-script/Code.gs`. Biarkan **`Logo.html`**.
3. File `Index.html`, `Host.html`, `Presenter.html`, `Common.html`, `Styles.html`, `Admin.html` di Apps Script **tidak dipakai lagi** — boleh dihapus.
4. **Deploy → Manage deployments → ikon pensil (Edit) → Version: _New version_ → Deploy.**
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
   - Dengan cara ini **URL tetap sama**, jadi `config.js` tidak perlu diubah.
   - ⚠️ Jangan pilih "New deployment" — itu membuat URL baru.
5. Tes: buka `https://script.google.com/macros/s/…/exec?ping` di browser. Harus muncul
   `{"ok":true,"app":"AKTIVO","version":"3.1",…}`.

> Proyek baru (belum pernah dipasang)? Jalankan sekali fungsi **`setupAktivo`** dari editor (Run) sebelum deploy.

## 2. Publikasikan di GitHub Pages

1. Buat repository baru di GitHub, misalnya `aktivo` (Public — GitHub Pages gratis untuk repo publik).
2. **Add file → Upload files**, lalu unggah **seluruh isi folder ini** (index.html, host.html, presenter.html, config.js, folder `assets`, folder `apps-script`, README.md). Klik **Commit changes**.
3. **Settings → Pages → Build and deployment → Source: _Deploy from a branch_ → Branch: `main` / `(root)` → Save.**
4. Tunggu 1–2 menit. Situs aktif di `https://<username>.github.io/aktivo/`.

| Untuk | Alamat |
|---|---|
| Halaman awal & peserta | `https://<username>.github.io/aktivo/` |
| Link langsung peserta | `https://<username>.github.io/aktivo/?code=12345678` |
| Dashboard host | `https://<username>.github.io/aktivo/host.html` |
| Presenter | tombol **Present** di dashboard |

Semua link (QR code, link undangan, tombol Present) dibuat otomatis dari alamat situs, jadi tetap benar walau nama repo atau domain berubah.

## 3. Opsional

**Arahkan link lama ke situs baru.** Di Apps Script: *Project Settings → Script Properties → Add property*
`AKTIVO_SITE_URL` = `https://<username>.github.io/aktivo/`
Link lama seperti `…/exec?code=12345678` atau `…/exec?view=host` akan membuka situs GitHub.

**Batasi pendaftaran host.** Tambahkan Script Property `AKTIVO_INVITE_CODE` = kode rahasia. Form pendaftaran otomatis meminta kode undangan.

**Nomor WhatsApp bantuan.** Ubah `SUPPORT_WHATSAPP` di `config.js` (kosongkan untuk menyembunyikan tombol).

**Domain sendiri.** Settings → Pages → Custom domain. Tidak perlu mengubah kode.

## Memperbarui di kemudian hari

- **Tampilan/fitur frontend** → edit file di GitHub dan commit. Perubahan tampil dalam ±1–10 menit (tekan Ctrl+F5 jika masih versi lama).
- **Backend** → tempel `Code.gs` baru di Apps Script, lalu *Manage deployments → Edit → New version*.
- **URL Apps Script berubah** (misalnya karena membuat deployment baru) → perbarui `API_URL` di `config.js`.

## Mengatasi masalah

| Pesan / gejala | Penyebab & solusi |
|---|---|
| *The server did not return JSON* | Deployment tidak diatur ke **Anyone**, atau `API_URL` salah. Periksa dengan `…/exec?ping`. |
| *Cannot reach the server* | Koneksi internet, atau jaringan sekolah/kantor memblokir `script.google.com`. |
| *API_URL in config.js is missing…* | `config.js` belum diisi URL `/exec` yang benar. |
| Perubahan backend tidak terasa | Lupa membuat **New version** saat deploy. |
| Halaman masih versi lama | Cache browser/GitHub Pages — tunggu beberapa menit lalu Ctrl+F5. |

## Keamanan

- Hanya fungsi yang terdaftar di `apiTable_()` (Code.gs) yang bisa dipanggil dari internet; fungsi internal dan `setupAktivo` tidak bisa.
- Password host di-hash (salt + pepper + iterasi SHA-256); login dibatasi setelah 5 kali gagal.
- Setiap permintaan diperiksa tokennya dan kepemilikan sesi; kunci jawaban kuis tidak dikirim sebelum waktunya.
- Error internal tidak dikirim ke browser (dicatat di *Executions* Apps Script).
- Halaman memakai *Content-Security-Policy* ketat: skrip hanya dari situs sendiri, koneksi API hanya ke Google Apps Script. QR code dibuat di browser tanpa CDN pihak ketiga.
- Dashboard & presenter menolak ditampilkan di dalam iframe situs lain (anti-clickjacking).
- `config.js` berisi URL API yang memang publik (peserta membutuhkannya). Tidak ada rahasia di repo ini; pepper & kode undangan disimpan di Script Properties.

## Kuota

Apps Script berjalan dengan akun Anda, jadi semua peserta memakai kuota akun tersebut. Dengan cache dan refresh adaptif, 50–100 peserta per sesi berjalan lancar. Untuk 200–300 peserta, gunakan akun Google Workspace.
