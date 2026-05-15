import { Hono } from 'hono'
import { Bot, InlineKeyboard, webhookCallback } from 'grammy'
import { supabase } from '../lib/supabase.js'
import { parseMessage } from '@kajian-baru/parser'
import type { Kajian } from '@kajian-baru/types'
import { triggerNotificationsForKajian } from './push.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'

// ---- Config ----
const token = process.env['TELEGRAM_BOT_TOKEN'] ?? ''
const adminChatId = Number(process.env['TELEGRAM_ADMIN_CHAT_ID'] ?? '0')

// ---- In-memory cache for pending parse results (per chat) ----
const pendingParseResults = new Map<number, Kajian[]>()

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
    text += `   🎙 ${k.pemateri || '-'}\n`
    text += `   🕐 ${k.waktu_mulai || '-'} — ${k.waktu_selesai || '-'}\n`
    text += `   🕌 ${k.tempat || '-'}\n`
    text += `   📅 ${k.tanggal_masehi || '-'}\n\n`
  }
  return text
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
      '📋 <b>Format Template Jadwal Kajian</b>\n\n' +
      'Salin dan sesuaikan template berikut:\n\n' +
      '<pre>' +
      '📆 Jadwal Kajian Islam\n' +
      'daerah Tangerang dan sekitarnya\n' +
      '14 Mei 2026 / 17 Dzulqa\'dah 1447 Hijriyah\n\n' +
      '📚 Materi: Kitab Riyadhush Shalihin\n' +
      '🎙️ Pemateri: Ustadz Fulan hafizhahullah\n' +
      '🕰️ Waktu: 08.00 s/d Selesai\n' +
      '🕌 Tempat: Masjid Al-Ikhlas\n' +
      '📞 Info: 0812xxxx (UMUM)\n' +
      '</pre>\n\n' +
      '💡 <b>Tips:</b>\n' +
      '• Pisahkan beberapa kajian dengan tanda <code>~</code>\n' +
      '• Audience: <code>(UMUM)</code>, <code>(AKHWAT)</code>, atau <code>(IKHWAN)</code>\n' +
      '• Bisa langsung copas dari grup WhatsApp/Telegram!',
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
      const chatId = ctx.callbackQuery.message?.chat.id ?? 0
      const kajianList = pendingParseResults.get(chatId)

      if (!kajianList || kajianList.length === 0) {
        await ctx.answerCallbackQuery({ text: '⚠️ Data sudah kadaluarsa. Kirim ulang teks.' })
        return
      }

      const { data: saved, error } = await supabase
        .from('kajian')
        .insert(kajianList)
        .select()

      if (error) {
        await ctx.editMessageText(`❌ Gagal menyimpan: ${error.message}`)
        await ctx.answerCallbackQuery()
        return
      }

      pendingParseResults.delete(chatId)

      // Trigger push notifications (background, non-blocking)
      if (saved && saved.length > 0) {
        void triggerNotificationsForKajian(saved as Kajian[])
      }

      await ctx.editMessageText(
        `💾 <b>Berhasil menyimpan ${String(saved?.length ?? 0)} kajian ke website!</b>\n\n` +
        '🔔 Notifikasi push telah dikirim ke subscriber.',
        { parse_mode: 'HTML' }
      )
      await ctx.answerCallbackQuery({ text: '✅ Tersimpan!' })
      return
    }

    // --- Discard parsed result ---
    if (data.startsWith('discard:')) {
      const chatId = ctx.callbackQuery.message?.chat.id ?? 0
      pendingParseResults.delete(chatId)
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

    // Parse teks kajian
    const result = parseMessage(ctx.message.text)

    if (!result.success || result.kajian_list.length === 0) {
      await ctx.reply(
        '❌ Gagal mengekstrak data kajian dari teks.\n\n' +
        'Ketik /template untuk melihat contoh format yang benar.'
      )
      return
    }

    // Simpan ke cache sementara
    pendingParseResults.set(ctx.chat.id, result.kajian_list)

    // Tampilkan preview + tombol aksi
    const keyboard = new InlineKeyboard()
      .text('💾 Simpan ke Website', `save:${String(Date.now())}`)
      .text('🗑️ Buang', `discard:${String(Date.now())}`)

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
