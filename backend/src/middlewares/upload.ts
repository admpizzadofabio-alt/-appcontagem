import multer from 'multer'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import { Request, Response, NextFunction } from 'express'

// Magic bytes por tipo de imagem — detecta o conteúdo real, independente do Content-Type
const MAGIC: Array<{ bytes: number[]; webpCheck?: boolean }> = [
  { bytes: [0xFF, 0xD8, 0xFF] },                // JPEG
  { bytes: [0x89, 0x50, 0x4E, 0x47] },          // PNG
  { bytes: [0x52, 0x49, 0x46, 0x46], webpCheck: true }, // RIFF....WEBP
]

function ehImagemValida(filePath: string): boolean {
  let fd: number | null = null
  try {
    fd = fs.openSync(filePath, 'r')
    const buf = Buffer.allocUnsafe(12)
    const n = fs.readSync(fd, buf, 0, 12, 0)
    if (n < 4) return false
    for (const m of MAGIC) {
      if (!m.bytes.every((b, i) => buf[i] === b)) continue
      if (m.webpCheck && buf.toString('ascii', 8, 12) !== 'WEBP') continue
      return true
    }
    return false
  } catch {
    return false
  } finally {
    if (fd !== null) try { fs.closeSync(fd) } catch { /* ignore */ }
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, 'uploads/'),
  filename: (_req, file, cb) => {
    const extByMime: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }
    const ext = extByMime[file.mimetype] ?? '.bin'
    cb(null, `${uuidv4()}${ext}`)
  },
})

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.mimetype)) return cb(new Error('Apenas imagens JPEG, PNG e WebP são permitidas'))
    cb(null, true)
    // Magic bytes validados APÓS salvar — usar validarMagicBytes() na rota após upload.single()
  },
})

// Middleware pós-multer: lê magic bytes do arquivo salvo no disco.
// Remover arquivo e retornar 415 se o conteúdo não for uma imagem real.
// Uso: router.post('/', upload.single('foto'), validarMagicBytes, handler)
export function validarMagicBytes(req: Request, res: Response, next: NextFunction): void {
  const files = req.file ? [req.file] : ((req.files as Express.Multer.File[]) ?? [])
  const invalidos = files.filter((f) => !ehImagemValida(f.path))
  if (invalidos.length > 0) {
    for (const f of invalidos) fs.unlink(f.path, () => { /* best-effort cleanup */ })
    res.status(415).json({ code: 'INVALID_FILE', message: 'Arquivo não reconhecido como imagem válida' })
    return
  }
  next()
}
