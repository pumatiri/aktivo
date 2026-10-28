# AKTIVO — Interactive classes & meetings

Platform presentasi interaktif bergaya Mentimeter: polling, kuis berpoin, word cloud, Q&A, skala, ranking, leaderboard, timer, dan laporan PDF.

- **Frontend**: situs statis di **GitHub Pages** (semua file di repository ini, dalam **satu folder**).
- **Backend**: **Google Apps Script** (`Code.gs`, dipasang terpisah di Apps Script — tidak diunggah ke GitHub). Data tersimpan di Google Sheet Anda.

## Isi repository (semua di folder utama, tanpa subfolder)

| File | Fungsi |
|---|---|
| `index.html`, `host.html`, `presenter.html` | Halaman awal & peserta, dashboard host, layar presenter |
| `config.js` | **URL backend Apps Script** dan nomor WhatsApp bantuan |
| `api.js` | Penghubung ke Apps Script + pemeriksaan otomatis jika ada yang salah pasang |
| `common.js`, `qr.js`, `theme.js`, `index.js`, `host.js`, `presenter.js` | Logika halaman |
| `aktivo.css`, `index.css`, `host.css`, `presenter.css` | Tampilan |
| `logo.png` | Logo |
| `.gitattributes` | Membuat GitHub menampilkan bahasa repo sebagai **HTML** |
| `.nojekyll` | Agar GitHub Pages menyajikan file apa adanya |

Total **20 file** (termasuk README.md dan THIRD_PARTY_NOTICES.md).

---

## 1. Backend (Apps Script)

1. Buka proyek Apps Script AKTIVO (dari spreadsheet: **Extensions → Apps Script**).
2. Ganti seluruh isi **`Code.gs`** dengan file `Code.gs` yang baru. Biarkan **`Logo.html`** (dipakai untuk logo di PDF).
3. File `Index`, `Host`, `Presenter`, `Common`, `Styles`, `Admin` di Apps Script **tidak dipakai lagi** — boleh dihapus.
4. **Deploy → Manage deployments → ikon pensil (Edit) → Version: _New version_ → Deploy.**
   *Execute as*: **Me** · *Who has access*: **Anyone**.
   ⚠️ Jangan "New deployment" — itu membuat URL baru.
5. **Tes:** buka `…/exec?ping` di browser → harus muncul `{"ok":true,"app":"AKTIVO","version":"3.1",…}`.
   Kalau yang muncul halaman AKTIVO lama atau pesan error, langkah 2–4 belum berhasil.

## 2. GitHub Pages

1. Di repository, klik **Add file → Upload files**.
2. Buka folder hasil ekstrak zip, tekan **Ctrl+A** (pilih semua file), lalu **seret** ke halaman upload. File lama dengan nama sama akan tertimpa.
3. Klik **Commit changes**.
4. **Settings → Pages → Source: _Deploy from a branch_ → Branch: `main` / `(root)` → Save** (cukup sekali).
5. Tunggu 1–2 menit, buka `https://<username>.github.io/<repo>/` lalu tekan **Ctrl+F5**.

> File yang namanya diawali titik (`.gitattributes`, `.nojekyll`) kadang tersembunyi di Windows/Mac.
> Jika tidak ikut terunggah: **Add file → Create new file**, beri nama `.gitattributes`, tempel isinya, Commit.

### Pemeriksaan otomatis
Jika ada yang salah pasang, halaman menampilkan **kotak peringatan oranye** di bagian bawah yang menyebutkan masalahnya, misalnya:
- *File "aktivo.css" tidak ditemukan* → ada file yang belum terunggah.
- *Backend Apps Script belum versi terbaru* → ulangi langkah backend no. 2–4.
- *Tidak dapat menghubungi backend* → internet, atau deployment belum "Anyone"/"New version".

## Alamat

| Untuk | Alamat |
|---|---|
| Halaman awal & peserta | `https://<username>.github.io/<repo>/` |
| Link langsung peserta | `https://<username>.github.io/<repo>/?code=12345678` |
| Dashboard host | `https://<username>.github.io/<repo>/host.html` |
| Presenter | tombol **Present** di dashboard |

## Opsional

- **Arahkan link lama ke situs baru:** Apps Script → *Project Settings → Script Properties* → `AKTIVO_SITE_URL` = `https://<username>.github.io/<repo>/`.
- **Batasi pendaftaran host:** Script Property `AKTIVO_INVITE_CODE` = kode rahasia.
- **WhatsApp bantuan:** ubah `SUPPORT_WHATSAPP` di `config.js` (kosongkan untuk menyembunyikan tombol).
- **URL Apps Script berubah:** perbarui `API_URL` di `config.js`.

## Keamanan

- Hanya fungsi yang terdaftar di `apiTable_()` (Code.gs) yang bisa dipanggil dari internet.
- Password host di-hash (salt + pepper + iterasi SHA-256); login dibatasi setelah 5 kali gagal.
- Setiap permintaan diperiksa token & kepemilikan sesi; kunci jawaban kuis tidak dikirim sebelum waktunya.
- *Content-Security-Policy* ketat: skrip hanya dari situs sendiri, koneksi hanya ke Google Apps Script; QR code dibuat di browser.
- Tidak ada rahasia di repository ini; pepper & kode undangan disimpan di Script Properties Apps Script.
