import multer from 'multer'
import { v4 as uuidv4 } from 'uuid'

// Magic bytes das extensões permitidas — não confia apenas no Content-Type do cliente
const MAGIC: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: 'image/jpeg', bytes: [0xFF, 0xD8, 0xFF] },
  { mime: 'image/png',  bytes: [0x89, 0x50, 0x4E, 0x47] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF....WEBP
]

function detectarMimeReal(buf: Buffer): string | null {
  for (const m of MAGIC) {
    const off = m.offset ?? 0
    if (buf.length < off + m.bytes.length) continue
    if (m.bytes.every((b, i) => buf[off + i] === b)) {
      // WebP: bytes 8-11 devem ser 'WEBP'
      if (m.mime === 'image/webp' && buf.toString('ascii', 8, 12) !== 'WEBP') continue
      return m.mime
    }
  }
  return null
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
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Apenas imagens JPEG, PNG e WebP são permitidas'))
    }

    // Coleta os primeiros 12 bytes para verificação de magic bytes
    const chunks: Buffer[] = []
    let total = 0
    const onData = (chunk: Buffer) => {
      chunks.push(chunk)
      total += chunk.length
      if (total >= 12) {
        file.stream.removeListener('data', onData)
        file.stream.removeListener('error', onError)
        const header = Buffer.concat(chunks).subarray(0, 12)
        const mimeReal = detectarMimeReal(header)
        if (!mimeReal) return cb(new Error('Arquivo não reconhecido como imagem válida'))
        // Repõe os chunks no stream para o multer continuar lendo
        file.stream.unshift(Buffer.concat(chunks))
        cb(null, true)
      }
    }
    const onError = (err: Error) => cb(err)
    file.stream.on('data', onData)
    file.stream.once('error', onError)
  },
})
