// REBUILD_TRIGGER: fix greedy parsing bug (Tema/Pemateri missing)
// REBUILD_TRIGGER: revert ingest debug, keep UI date-above-time fix
import { Hono } from 'hono'
import { Bot, InlineKeyboard, webhookCallback } from 'grammy'
import { supabase } from '../lib/supabase.js'
import { parseMessage } from '@kajian-baru/parser'
import type { Kajian } from '@kajian-baru/types'
import { triggerNotificationsForKajian } from './push.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import { safeIngestKajian } from '../lib/ingest.js'

// ---- Config ----
const token = process.env['TELEGRAM_BOT_TOKEN'] ?? ''
const adminChatId = Number(process.env['TELEGRAM_ADMIN_CHAT_ID'] ?? '0')

// ---- In-memory cache for pending parse results (per user message context) ----
const pendingParseResults = new Map<string, Kajian[]>()

// ---- ⚡ ADVANCED: In-memory cache for aggregating split messages (anti-Telegram 4096 limit) ----
type MessageBuffer = {
  textParts: string[]
  timer: NodeJS.Timeout | null
  resolver: ((value: string) => void) | null
}
const userMessageBuffers = new Map<number, MessageBuffer>()

// ---- Bot instance (null jika token belum diset) ----
const bot = token ? new Bot(token) : null

// ---- Helpers ----
type BotUserStatus = 'pending' | 'approved' | 'rejected'

async function getBotUserStatus(telegramId: number): Promise<BotUserStatus | null> {
  const { data } = await supabase
    .from('bot_users')
    .select('status')
    .eq('telegram_id', telegramId)
    .maybeSingle()
  return data ? (data.status as BotUserStatus) : null
}

function isAdminChat(telegramId: number): boolean {
  return adminChatId > 0 && telegramId === adminChatId
}

function formatKajianPreview(list: Kajian[]): string {
  let text = `✅ <b>Berhasil mengekstrak ${String(list.length)} kajian:</b>\n\n`
  for (let i = 0; i < list.length; i++) {
    const k = list[i]
    if (!k) continue
    text += `<b>${String(i + 1)}. ${k.materi || 'Tanpa Judul'}</b>\n`
    
    if (k.pemateri && k.pemateri !== '-') {
      text += `   🎙️ ${k.pemateri}\n`
    }
    
    const wMulai = k.waktu_mulai || ''
    const wSelesai = k.waktu_selesai || ''
    if (wMulai || wSelesai) {
      text += `   🕒 ${wMulai || 'N/A'}${wSelesai ? ` — ${wSelesai}` : ''}\n`
    }
    
    if (k.tempat && k.tempat !== '-') {
      text += `   🕌 ${k.tempat}\n`
    }
    
    if (k.tanggal_masehi && k.tanggal_masehi !== '-') {
      // Percantik tampilan ISO YYYY-MM-DD menjadi DD-MM-YYYY di Telegram
      const parts = k.tanggal_masehi.split('-')
      const formattedDate = (parts.length === 3 && parts[0] && parts[1] && parts[2])
        ? `${parts[2]}-${parts[1]}-${parts[0]}`
        : k.tanggal_masehi
      text += `   📅 ${formattedDate}\n`
    }
    
    text += `\n`
  }
  return text.trim() + '\n'
}

// ---- Register bot commands ----
if (bot) {
  // /start — Daftar & minta akses
  bot.command('start', async (ctx) => {
    const userId = ctx.from?.id
    if (!userId) return

    // Admin langsung dikenali
    if (isAdminChat(userId)) {
      await ctx.reply(
        '🛡️ <b>Assalamu\'alaikum, Admin!</b>\n\n' +
        'Bot siap menerima perintah.\nKirim teks jadwal kajian atau ketik /help.',
        { parse_mode: 'HTML' }
      )
      return
    }

    const status = await getBotUserStatus(userId)

    if (status === 'approved') {
      await ctx.reply('✅ Akun Anda sudah aktif! Silakan kirim teks jadwal kajian.')
      return
    }
    if (status === 'rejected') {
      await ctx.reply('❌ Maaf, permintaan akses Anda telah ditolak oleh Administrator.')
      return
    }
    if (status === 'pending') {
      await ctx.reply('⏳ Permintaan Anda masih menunggu persetujuan. Mohon bersabar.')
      return
    }

    // New user — register as pending
    const fullName = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(' ')
    const { error: insertError } = await supabase.from('bot_users').insert({
      telegram_id: userId,
      telegram_username: ctx.from?.username ?? null,
      full_name: fullName,
      status: 'pending',
    })

    if (insertError) {
      console.error('❌ [Bot] Gagal insert bot_users:', insertError.message, insertError.details, insertError.hint)
      await ctx.reply(`❌ Gagal mendaftar: ${insertError.message}`)
      return
    }

    await ctx.reply(
      '⏳ Terima kasih! Permintaan akses Anda telah dikirim ke Administrator.\n' +
      'Anda akan diberitahu setelah disetujui.'
    )

    // Notify admin via Telegram (jika admin chat ID tersedia)
    if (adminChatId && bot) {
      const keyboard = new InlineKeyboard()
        .text('✅ Setujui', `approve:${String(userId)}`)
        .text('❌ Tolak', `reject:${String(userId)}`)

      await bot.api.sendMessage(
        adminChatId,
        `🆕 <b>Permintaan Akses Bot Baru!</b>\n\n` +
        `👤 Nama: ${fullName}\n` +
        `🆔 Username: @${ctx.from?.username ?? 'tidak ada'}\n` +
        `🔢 Telegram ID: <code>${String(userId)}</code>\n\n` +
        `Pilih aksi:`,
        { reply_markup: keyboard, parse_mode: 'HTML' }
      )
    }
  })

  // /help — Daftar perintah
  bot.command('help', async (ctx) => {
    await ctx.reply(
      '📖 <b>Daftar Perintah KajianBaru Bot</b>\n\n' +
      '/start — Daftar &amp; minta akses\n' +
      '/help — Tampilkan bantuan ini\n' +
      '/template — Contoh format teks kajian\n' +
      '/myid — Lihat Telegram ID Anda\n\n' +
      '💡 Kirim langsung teks copas jadwal kajian untuk diparsing otomatis!',
      { parse_mode: 'HTML' }
    )
  })

  // /template — Contoh format teks yang bisa diparsing
  bot.command('template', async (ctx) => {
    await ctx.reply(
      '📋 <b>Format Template Jadwal Kajian (Terbaik)</b>\n\n' +
      'Salin & sesuaikan format yang paling disarankan ini:\n\n' +
      '<pre>' +
      '*○●JAKARTA PUSAT●○*\n\n' +
      '🕌 Masjid Al-Ikhlas\n' +
      '(Ruang Utama Lt. 1)\n' +
      'Jl. Sudirman No. 12, Kemayoran, Jakarta Pusat\n' +
      '🌏 G-maps : https://maps.app.goo.gl/placeholder\n' +
      '》Pemateri : Ustadz Fulan hafizhahullah\n' +
      '》Tema : Kitab Riyadhush Shalihin\n' +
      '》Waktu : 09.00 s/d Selesai\n' +
      '》CP : 0812xxxx 🚹🚺\n' +
      '***' +
      '</pre>\n\n' +
      '💡 <b>Tips:</b>\n' +
      '• Pisahkan deretan jadwal menggunakan tiga bintang (<code>***</code>).\n' +
      '• Gender dapat ditentukan via emoji (<code>🚺</code> Akhwat, <code>🚹</code> Ikhwan, <code>🚹🚺</code> Umum).\n' +
      '• Jangan lupa sertakan tag daerah <code>*○●NAMA KOTA●○*</code> di bagian paling atas!',
      { parse_mode: 'HTML' }
    )
  })

  // /myid — Tampilkan Telegram ID (berguna untuk setup admin)
  bot.command('myid', async (ctx) => {
    await ctx.reply(
      `🔢 <b>Telegram ID Anda:</b> <code>${String(ctx.from?.id ?? 0)}</code>`,
      { parse_mode: 'HTML' }
    )
  })

  // ---- Callback Query Handler (Approve/Reject/Save/Discard) ----
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data
    const fromId = ctx.from?.id ?? 0

    // --- Approve/Reject user (admin only) ---
    if (data.startsWith('approve:') || data.startsWith('reject:')) {
      if (!isAdminChat(fromId)) {
        await ctx.answerCallbackQuery({ text: '⛔ Hanya admin!' })
        return
      }

      const targetId = Number(data.split(':')[1])
      const isApprove = data.startsWith('approve:')

      await supabase.from('bot_users')
        .update({
          status: isApprove ? 'approved' : 'rejected',
          ...(isApprove ? { approved_at: new Date().toISOString() } : {}),
        })
        .eq('telegram_id', targetId)

      await ctx.editMessageText(
        isApprove
          ? `✅ User ${String(targetId)} telah DISETUJUI.`
          : `❌ User ${String(targetId)} telah DITOLAK.`
      )

      // Notify the user
      try {
        await bot.api.sendMessage(
          targetId,
          isApprove
            ? '🎉 Akses Anda telah disetujui! Silakan kirim teks kajian atau ketik /template.'
            : '❌ Maaf, permintaan akses Anda ditolak oleh Administrator.'
        )
      } catch { /* user may have blocked bot */ }

      await ctx.answerCallbackQuery()
      return
    }

    // --- Save parsed kajian to DB ---
    if (data.startsWith('save:')) {
      const parseId = data.replace('save:', '')
      const kajianList = pendingParseResults.get(parseId)

      if (!kajianList || kajianList.length === 0) {
        await ctx.answerCallbackQuery({ text: '⚠️ Data sudah kadaluarsa. Kirim ulang teks.' })
        return
      }

      try {
        // 🛡️ JALANKAN DEDUPLIKASI CERDAS & PERTAHANAN SPAM (Set published: false, butuh review admin!)
        const { saved, skipped, updated } = await safeIngestKajian(kajianList, false)

        pendingParseResults.delete(parseId)

        let statusText = `💾 <b>Hasil Proses Ingest:</b>\n\n`
        if (saved.length > 0) statusText += `✨ ${String(saved.length)} data baru tersimpan (Draft / Pending Approval)\n`
        if (updated > 0) statusText += `🛑 ${String(updated)} kajian diperbarui menjadi LIBUR/BATAL\n`
        if (skipped > 0) statusText += `⏭️ ${String(skipped)} data duplikat diabaikan\n`
        
        if (saved.length === 0 && updated === 0) {
          statusText += `\n⚠️ Tidak ada data baru yang masuk (100% redundan/duplikat).`
        } else {
          statusText += `\n💡 Data tersimpan sebagai Draft. Silakan approve di Website Admin!`
        }

        await ctx.editMessageText(statusText, { parse_mode: 'HTML' })
        await ctx.answerCallbackQuery({ text: '✅ Selesai!' })
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Internal error'
        await ctx.editMessageText(`❌ Gagal menyimpan: ${errMsg}`)
        await ctx.answerCallbackQuery()
      }
      return
    }

    // --- Discard parsed result ---
    if (data.startsWith('discard:')) {
      const parseId = data.replace('discard:', '')
      pendingParseResults.delete(parseId)
      await ctx.editMessageText('🗑️ Data parsing dibuang.')
      await ctx.answerCallbackQuery()
      return
    }

    await ctx.answerCallbackQuery()
  })

  // ---- Text message handler (parse kajian) ----
  bot.on('message:text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) return

    const userId = ctx.from?.id ?? 0

    // Cek akses: admin boleh langsung, user biasa harus approved
    if (!isAdminChat(userId)) {
      const status = await getBotUserStatus(userId)
      if (status !== 'approved') {
        await ctx.reply('⏳ Akun Anda belum disetujui. Kirim /start untuk mendaftar.')
        return
      }
    }

    // ⚡ AGGREGATOR INJECTION: Kumpulkan dan satukan text burst yang terpecah oleh Telegram 4096-char limit!
    let rawTextToParse = ctx.message.text
    const DEBOUNCE_MS = 3500

    const existingBuffer = userMessageBuffers.get(userId)
    if (existingBuffer) {
      // 💡 INI ADALAH PESAN LANJUTAN (Part 2, Part 3, dst):
      // Tempelkan ke daftar, reset timernya, lalu tutup request ini instan untuk menghindari duplikasi!
      existingBuffer.textParts.push(ctx.message.text)
      
      if (existingBuffer.timer) clearTimeout(existingBuffer.timer)
      
      existingBuffer.timer = setTimeout(() => {
        const merged = existingBuffer.textParts.join('\n')
        userMessageBuffers.delete(userId)
        if (existingBuffer.resolver) existingBuffer.resolver(merged)
      }, DEBOUNCE_MS)
      
      return
    }

    // 💡 INI ADALAH PESAN PERTAMA (Part 1):
    // Inisialisasi slot antrian, pasang timer, dan gantung eksekusi request ini sampai timer hening berakhir!
    const mergedText = await new Promise<string>((resolve) => {
      const newBuffer: MessageBuffer = {
        textParts: [ctx.message.text],
        timer: null,
        resolver: resolve
      }
      
      newBuffer.timer = setTimeout(() => {
        const merged = newBuffer.textParts.join('\n')
        userMessageBuffers.delete(userId)
        resolve(merged)
      }, DEBOUNCE_MS)
      
      userMessageBuffers.set(userId, newBuffer)
    })

    rawTextToParse = mergedText

    // Parse teks kajian (SEKARANG SUDAH DIJAMIN UTUH, TERSAMBUNG & TIDAK ADA BLOK TERBELAH!)
    const result = parseMessage(rawTextToParse)

    if (!result.success || result.kajian_list.length === 0) {
      await ctx.reply(
        '❌ Gagal mengekstrak data kajian dari teks.\n\n' +
        'Ketik /template untuk melihat contoh format yang benar.'
      )
      return
    }

    // 📅 CERDAS: Jika tanggal masehi kosong, fallback ke tanggal pesan ini dikirim (WIB context)!
    const msgDate = new Date(ctx.message.date * 1000)
    // Konversi timezone server ke GMT+7 (WIB) untuk akurasi kalender lokal
    const wibOffsetMs = 7 * 60 * 60 * 1000
    const utcTimeMs = msgDate.getTime() + (msgDate.getTimezoneOffset() * 60 * 1000)
    const jakartaDate = new Date(utcTimeMs + wibOffsetMs)
    const todayISO = jakartaDate.toISOString().split('T')[0] ?? ''

    for (const kajian of result.kajian_list) {
      if (!kajian.tanggal_masehi || kajian.tanggal_masehi === '-') {
        kajian.tanggal_masehi = todayISO
      }
    }

    // Buat token ID unik untuk menampung payload chat ini secara mandiri (anti-overwrite!)
    const parseId = `p_${String(Date.now())}_${String(userId)}`
    
    // Simpan ke cache sementara
    pendingParseResults.set(parseId, result.kajian_list)

    // Tampilkan preview + tombol aksi
    const keyboard = new InlineKeyboard()
      .text('💾 Simpan ke Website', `save:${parseId}`)
      .text('🗑️ Buang', `discard:${parseId}`)

    await ctx.reply(formatKajianPreview(result.kajian_list), {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    })
  })
}

// ---- Hono Routes ----
export const botRoutes = new Hono()

if (bot) {
  // Webhook endpoint — menerima update dari Telegram
  botRoutes.post('/webhook', webhookCallback(bot, 'hono'))

  // Setup endpoint — sekali panggil untuk mendaftarkan webhook (admin only)
  botRoutes.get('/setup', authMiddleware, adminMiddleware, async (c) => {
    const host = process.env['RAILWAY_PUBLIC_DOMAIN']
      ?? 'kajian-baruapi-production.up.railway.app'
    const webhookUrl = `https://${host}/bot/webhook`

    const res = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`
    )
    const result = await res.json() as Record<string, unknown>
    return c.json({ success: true, webhook_url: webhookUrl, telegram_response: result })
  })

  // Info endpoint — health check bot (admin only)
  botRoutes.get('/info', authMiddleware, adminMiddleware, async (c) => {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`)
    const result = await res.json() as Record<string, unknown>
    return c.json({ success: true, bot_info: result })
  })
} else {
  botRoutes.all('/*', (c) => c.json({ error: 'Bot token not configured' }, 503))
}
