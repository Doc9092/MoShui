import HanziWriter from 'hanzi-writer';

export interface CharacterStrokeData {
  strokes: string[];
  medians?: number[][][];
}

const strokeCache = new Map<string, CharacterStrokeData | null>();

/**
 * Проверяет, может ли символ быть китайским иероглифом или ключом,
 * чтобы не отправлять заведомо ошибочные сетевые запросы для латиницы и пунктуации.
 */
export function isLikelyHanziCharacter(char: string): boolean {
  if (!char) return false;
  const first = Array.from(char.trim())[0];
  if (!first) return false;
  return /[\u2e80-\u2eff\u2f00-\u2fdf\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u.test(first);
}

/**
 * Безопасно загружает векторные контуры черт иероглифа через HanziWriter.loadCharacterData(char)
 * с кэшированием в памяти и перехватом любых ошибок (латиница, пунктуация, редкие знаки, 404).
 */
export async function loadHanziStrokes(char: string): Promise<CharacterStrokeData | null> {
  const codePoints = Array.from((char || '').trim());
  const target = codePoints[0] || '';
  if (!target) return null;

  if (strokeCache.has(target)) {
    return strokeCache.get(target) ?? null;
  }

  // Если введена латиница, цифры или знаки пунктуации — сразу возвращаем null без сетевой ошибки
  if (!isLikelyHanziCharacter(target)) {
    strokeCache.set(target, null);
    return null;
  }

  try {
    const data = await new Promise<CharacterStrokeData | null>((resolve) => {
      let settled = false;
      const finish = (val: CharacterStrokeData | null) => {
        if (!settled) {
          settled = true;
          resolve(val);
        }
      };

      try {
        const maybePromise = HanziWriter.loadCharacterData(target, {
          onLoadCharDataSuccess: (loadedData: CharacterStrokeData) => {
            if (loadedData && Array.isArray(loadedData.strokes) && loadedData.strokes.length > 0) {
              finish({
                strokes: loadedData.strokes,
                medians: loadedData.medians,
              });
            } else {
              finish(null);
            }
          },
          onLoadCharDataError: () => {
            finish(null);
          },
        });

        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise
            .then((loadedData) => {
              if (
                loadedData &&
                Array.isArray(loadedData.strokes) &&
                loadedData.strokes.length > 0
              ) {
                finish({
                  strokes: loadedData.strokes,
                  medians: loadedData.medians,
                });
              } else {
                finish(null);
              }
            })
            .catch(() => {
              finish(null);
            });
        }
      } catch {
        finish(null);
      }
    });

    strokeCache.set(target, data);
    return data;
  } catch {
    strokeCache.set(target, null);
    return null;
  }
}
