import { AppError } from './errors.js'

const MAX_BYTES = 1_200_000 // ~900KB imagem real

export function validarBase64Imagem(base64: string, campo = 'foto'): void {
  const match = base64.match(/^data:(image\/(?:jpeg|jpg|png));base64,(.+)$/)
  if (!match) {
    throw new AppError(`${campo}: formato inválido. Envie JPEG ou PNG em base64.`, 400)
  }

  let buffer: Buffer
  try {
    buffer = Buffer.from(match[2], 'base64')
  } catch {
    throw new AppError(`${campo}: base64 inválido.`, 400)
  }

  if (buffer.length > MAX_BYTES) {
    throw new AppError(`${campo}: imagem muito grande (máx. 900KB).`, 400)
  }

  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  const isPng  = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47

  if (!isJpeg && !isPng) {
    throw new AppError(`${campo}: o conteúdo do arquivo não é uma imagem válida.`, 400)
  }
}
