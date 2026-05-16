import { supabase } from './supabase.js'
import type { Kajian } from '@kajian-baru/types'
import { generateFollowKey } from '@kajian-baru/parser'

/**
 * Mencegah redundancy secara cerdas (Deduplication) saat menyisipkan data Kajian baru ke database.
 * - Mendeteksi konflik berdasarkan gabungan Tanggal + Nama Tempat + Waktu Mulai.
 * - Jika konflik & incoming berstatus 'is_cancelled: true', maka mengupdate data DB menjadi batal/libur.
 * - Jika konflik tapi data identik biasa, abaikan (skip) untuk menghentikan spam duplicate.
 * - Jika data baru, disisipkan dengan status is_published yang ditentukan.
 * 
 * @param kajianList - Daftar kajian mentah hasil parsing.
 * @param forcePublished - Set true jika dari dashboard admin (langsung tayang), false jika dari bot (draft butuh review).
 */
export async function safeIngestKajian(
  kajianList: Kajian[], 
  forcePublished = true
): Promise<{ saved: Kajian[]; skipped: number; updated: number }> {
  
  if (!kajianList || kajianList.length === 0) {
    return { saved: [], skipped: 0, updated: 0 }
  }

  // 1. Cari rentang tanggal yang relevan untuk optimasi load bulk
  const uniqueDates = Array.from(new Set(kajianList.map(k => k.tanggal_masehi).filter(Boolean)))
  
  if (uniqueDates.length === 0) {
    // Fallback aman: insert biasa jika tidak memiliki metadata tanggal valid sama sekali
    const { data } = await supabase
      .from('kajian')
      .insert(kajianList.map(k => ({ ...k, is_published: forcePublished })))
      .select()
    return { saved: (data ?? []) as Kajian[], skipped: 0, updated: 0 }
  }

  // 2. Tarik arsip kajian yang sudah eksis di database untuk rentang tanggal tersebut (Cegah N+1 Query)
  const { data: existingData } = await supabase
    .from('kajian')
    .select('*')
    .in('tanggal_masehi', uniqueDates)

  const existing = (existingData ?? []) as Kajian[]

  // 🛡️ Helper Key Maker Premium: Menggunakan generateFollowKey dari parser agar kebal total terhadap variasi kurung, spasi, & ornamen!
  const makeCompositeKey = (k: Kajian) => {
    const tempatNorm = generateFollowKey('MASJID', k.tempat, k.kota)
    const waktuNorm = (k.waktu_mulai ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').trim()
    return `${k.tanggal_masehi}::${tempatNorm}::${waktuNorm}`
  }

  // Bentuk map lookup super cepat O(1)
  const existingMap = new Map<string, Kajian>()
  for (const item of existing) {
    existingMap.set(makeCompositeKey(item), item)
  }

  const toInsert: Partial<Kajian>[] = []
  let skippedCount = 0
  let updatedCount = 0
  let insertIndex = 0 // Digunakan untuk mensimulasikan jeda waktu
  const finalSaved: Kajian[] = []
  
  // Buat satu batch UUID untuk seluruh items baru yang masuk dalam run ini
  const currentBatchId = crypto.randomUUID()

  // 3. Loop Rekonsiliasi & Resolusi Konflik secara ksatria!
  for (const incoming of kajianList) {
    const key = makeCompositeKey(incoming)
    const matched = existingMap.get(key)

    if (matched) {
      // 🔥 TERDETEKSI DATA DUPLIKAT / KONFLIK!
      
      // Aturan Bisnis A: "kalo udah ada datanya di update jadi libur"
      if (incoming.is_cancelled && !matched.is_cancelled) {
        console.log(`[Ingest] Mendeteksi pembatalan kajian terdaftar di "${matched.tempat}". Mengupdate flag libur...`)
        const { data: updatedRecord } = await supabase
          .from('kajian')
          .update({ is_cancelled: true })
          .eq('id', matched.id)
          .select()
          .single()

        if (updatedRecord) {
          finalSaved.push(updatedRecord as Kajian)
          updatedCount++
        }
      } else {
        // Aturan Bisnis B: Sama persis dan tidak ada pembaruan status batal. Skip total!
        skippedCount++
      }
    } else {
      // ✨ DATA BARU BERSIH!
      // Omit id jika ada (mencegah tabrakan primary key UUID) dan paksa setup status publish!
      const { id, batch_id: existingBatch, ...insertPayload } = incoming
      toInsert.push({
        ...insertPayload,
        is_published: forcePublished,
        batch_id: existingBatch || currentBatchId,
        // 🔥 STAGGERING HACK: Kurangi 1 detik per elemen agar urutan Sesi 1, 2, 3 tetap terjaga murni
        // saat di-query dari frontend menggunakan ORDER BY created_at DESC!
        created_at: new Date(Date.now() - (insertIndex++) * 1000).toISOString()
      })
    }
  }

  // 4. Batch Insert entitas baru yang bersih sekaligus
  if (toInsert.length > 0) {
    console.log(`[Ingest] Menyisipkan ${toInsert.length} data kajian baru ke DB.`)
    const { data: inserted, error } = await supabase
      .from('kajian')
      .insert(toInsert)
      .select()
    
    if (error) {
      console.error('❌ [Ingest] Error batch insert data baru:', error.message)
      throw error
    }

    if (inserted) {
      finalSaved.push(...(inserted as Kajian[]))
    }
  }

  return {
    saved: finalSaved,
    skipped: skippedCount,
    updated: updatedCount
  }
}
