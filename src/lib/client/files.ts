export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024

export function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      const result = reader.result

      if (typeof result !== 'string') {
        reject(new Error('Kunde inte läsa filinnehållet.'))
        return
      }

      const base64 = result.split(',')[1]

      if (!base64) {
        reject(new Error('Ogiltig Base64-sträng.'))
        return
      }

      resolve(base64)
    }

    reader.onerror = () => {
      reject(new Error('Fel vid läsning av fil.'))
    }

    reader.readAsDataURL(file)
  })
}
