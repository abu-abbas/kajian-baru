import { parseMessage } from './packages/parser/src/index';

const text = `*🕋REKAPAN KAJIAN SUNNAH INDONESIA🕋*
*☪️Untuk Wilayah DKI Jakarta & sekitarnya☪️*
\`✍🏻Creative by : Tim Jadwal Kajian Kaskus\`
*▶️Sabtu, 16 Mei 2026*
_Pekan Ketiga_
.
---------
> *⛔️Dilarang Mengubah (Menambahkan / Mengurangi) Isi Seluruh Rakapan ini Tanpa se-Izin Dari Tim Jadwal Kajian Kaskus⛔️*
.
📱 WA Channel / Saluran (Rekapan Kajian & Kajian OnLine) : https://whatsapp.com/channel/0029VamBns5KLaHl0a7jma1t
.
📱 (Poster/Flyer - OffLine/Tatap Muka) :
- Telegram : https://t.me/jadwal_kajian_kaskus
- Instagram : Jadwal Kajian Kaskus
.
.
《《 DKI Jakarta & sekitarnya 》》
.
*○●JAK-TIM●○*
.
🕌 Masjid Soleh Hawa
Jl. Raya Ceger No.3, RT.5/RW.1, Ceger, Kec. Cipayung, Kota Jakarta Timur
🌏 G-maps : https://maps.app.goo.gl/6dSvjLiXdJTJiqY69
- SESI 1
》Pemateri : Ustadz Nizar Saad Jabal, Lc., M.Pd
》Tema : Pondasi Utama Kebahagiaan
》Waktu : 08.00 – 09.30 WIB
- SESI 2
》Pemateri : Ustadz Nizar Saad Jabal, Lc., M.Pd
》Tema : Dakmpak Buruk Kemaksiatan Pada Keharmonisan
》Waktu : 10.00 – 11.30 WIB
- SESI 3
》Pemateri : Ustadz Farhan Abu Furaihan
》Tema : Sabar
》Waktu : Ba'da Maghrib – selesai
》CP : 0852-1235-0060 🚹🚺
***
.
*○●JAK-SEL●○*
.
🕌 Masjid Baiturrahman
Jl. Buana Raya, Pondok Pinang, Kec. Kby. Lama, Kota Jakarta Selatan
🌏 G-maps : https://maps.app.goo.gl/dju1jqyGkBQy84bx5
》Waktu : 13.30 WIB – selesai
》CP : – 🚹/🚺
》KAJIAN DIBATALKAN
***
`;

const res = parseMessage(text);
console.log("Kajian count:", res.kajian_list.length);
for (const k of res.kajian_list) {
  console.log(\`\${k.materi} | \${k.is_cancelled ? 'CANCELLED' : 'ACTIVE'}\`);
}
