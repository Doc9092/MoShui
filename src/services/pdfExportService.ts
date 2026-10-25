import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export const PRINTABLE_SHEET_ELEMENT_ID = 'printable-sheet-area';

/**
 * Очищает имя файла от недопустимых символов ОС, сохраняя кириллицу, китайские иероглифы, латиницу и цифры.
 */
export function sanitizePdfFilename(rawName: string): string {
  const trimmed = (rawName || '')
    .trim()
    .replace(/\.pdf$/i, '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  return trimmed || 'moshui-worksheet';
}

/**
 * Рассчитывает параметры размещения и постраничной разбивки холста на листе формата А4 (210 x 297 мм).
 */
export function calculateA4Dimensions(
  canvasWidth: number,
  canvasHeight: number,
  marginMm = 0
): {
  pageWidthMm: number;
  pageHeightMm: number;
  printableWidthMm: number;
  printableHeightMm: number;
  renderedImageHeightMm: number;
  pageCount: number;
} {
  const pageWidthMm = 210;
  const pageHeightMm = 297;
  const printableWidthMm = pageWidthMm - marginMm * 2;
  const printableHeightMm = pageHeightMm - marginMm * 2;

  const safeWidth = Math.max(1, canvasWidth);
  const safeHeight = Math.max(1, canvasHeight);
  const renderedImageHeightMm = (safeHeight * printableWidthMm) / safeWidth;
  const pageCount = Math.max(1, Math.ceil(renderedImageHeightMm / printableHeightMm - 0.01));

  return {
    pageWidthMm,
    pageHeightMm,
    printableWidthMm,
    printableHeightMm,
    renderedImageHeightMm,
    pageCount,
  };
}

/**
 * Преобразует любые современные цветовые функции CSS (oklch, oklab, color-mix из Tailwind v4)
 * в стандартный rgb()/rgba() через растеризацию пикселя 1x1 на 2D-холсте.
 * Устраняет ошибку html2canvas "Attempting to parse an unsupported color function oklch"
 * как в таблицах стилей, так и в инлайн-стилях SVG-элементов.
 */
function normalizeModernCssColorsForHtml2Canvas(clonedDoc: Document): void {
  const scratchCanvas = document.createElement('canvas');
  scratchCanvas.width = 1;
  scratchCanvas.height = 1;
  const ctx = scratchCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  const colorCache = new Map<string, string>();

  const toRgbString = (cssColor: string): string => {
    const trimmed = cssColor.trim();
    if (!trimmed || trimmed === 'transparent' || trimmed === 'none' || trimmed === 'inherit') {
      return trimmed;
    }
    const cached = colorCache.get(trimmed);
    if (cached) return cached;

    try {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = 'rgba(0, 0, 0, 0)';
      ctx.fillStyle = trimmed;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      const result =
        a === 0
          ? 'rgba(0, 0, 0, 0)'
          : a === 255
          ? `rgb(${r}, ${g}, ${b})`
          : `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
      colorCache.set(trimmed, result);
      return result;
    } catch {
      return 'rgb(15, 23, 42)';
    }
  };

  const replaceUnsupportedFunctionsInString = (str: string): string => {
    if (!/(?:oklch|oklab|color-mix|lch|lab|color)\(/i.test(str)) {
      return str;
    }
    let next = str.replace(/(?:oklch|oklab|lch|lab|color)\([^()]+\)/gi, (match) => {
      if (match.includes('var(')) return 'rgb(15, 23, 42)';
      return toRgbString(match);
    });
    next = next.replace(/color-mix\([^;{}]+\)/gi, 'rgba(15, 23, 42, 0.12)');
    return next;
  };

  const styleElements = clonedDoc.querySelectorAll('style');
  styleElements.forEach((styleEl) => {
    if (styleEl.textContent) {
      styleEl.textContent = replaceUnsupportedFunctionsInString(styleEl.textContent);
    }
  });

  const clonedWin = clonedDoc.defaultView || window;

  const colorProps = [
    'color',
    'background-color',
    'border-top-color',
    'border-right-color',
    'border-bottom-color',
    'border-left-color',
    'outline-color',
    'text-decoration-color',
    '-webkit-text-stroke-color',
    'caret-color',
    'column-rule-color',
    'fill',
    'stroke',
  ] as const;

  const allNodes = [
    clonedDoc.documentElement,
    clonedDoc.body,
    ...Array.from(clonedDoc.querySelectorAll('*')),
  ];

  for (const el of allNodes) {
    if (!(el instanceof HTMLElement || el instanceof SVGElement)) continue;

    if (
      el.style &&
      el.style.cssText &&
      /(?:oklch|oklab|color-mix|lch|lab|color)\(/i.test(el.style.cssText)
    ) {
      el.style.cssText = replaceUnsupportedFunctionsInString(el.style.cssText);
    }

    const computed = clonedWin.getComputedStyle(el);

    for (const prop of colorProps) {
      const val = computed.getPropertyValue(prop);
      if (val && /(?:oklch|oklab|color-mix|lch|lab|color)\(/i.test(val)) {
        el.style.setProperty(prop, toRgbString(val), 'important');
      }
    }

    const boxShadow = computed.getPropertyValue('box-shadow');
    if (boxShadow && /(?:oklch|oklab|color-mix|lch|lab|color)\(/i.test(boxShadow)) {
      el.style.setProperty('box-shadow', 'none', 'important');
    }

    const textShadow = computed.getPropertyValue('text-shadow');
    if (textShadow && /(?:oklch|oklab|color-mix|lch|lab|color)\(/i.test(textShadow)) {
      el.style.setProperty('text-shadow', 'none', 'important');
    }

    const bgImage = computed.getPropertyValue('background-image');
    if (bgImage && /(?:oklch|oklab|color-mix|lch|lab|color)\(/i.test(bgImage)) {
      el.style.setProperty('background-image', 'none', 'important');
    }
  }
}

/**
 * Функция 1: Рендерит печатный лист А4 (#printable-sheet-area) с фиксированной шириной 794px
 * в высоком разрешении (scale: 2) через html2canvas и сохраняет готовый документ PDF через jsPDF.
 */
export async function downloadWorksheetAsPDF(
  elementId: string = PRINTABLE_SHEET_ELEMENT_ID,
  filename: string = 'moshui-worksheet'
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(
      `Не найден печатный лист (#${elementId}). Добавьте хотя бы одно слово в пропись.`
    );
  }

  // Дожидаемся полной загрузки всех веб-шрифтов перед растеризацией
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  const cleanFilename = sanitizePdfFilename(filename);

  const canvas = await html2canvas(element, {
    scale: 2,
    width: 794,
    windowWidth: 794,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    onclone: (clonedDoc, clonedEl) => {
      normalizeModernCssColorsForHtml2Canvas(clonedDoc);
      clonedEl.style.transform = 'none';
      clonedEl.style.transformOrigin = 'top left';
      clonedEl.style.width = '794px';
      clonedEl.style.minHeight = '1123px';
      clonedEl.style.padding = '40px';
      clonedEl.style.margin = '0';
      clonedEl.style.boxSizing = 'border-box';
      clonedEl.style.boxShadow = 'none';
      clonedEl.style.border = 'none';
      clonedEl.style.borderRadius = '0';
      clonedEl.style.backgroundColor = '#ffffff';
    },
  });

  // Поскольку у #printable-sheet-area уже задан внутренний padding: 40px (~10.5мм),
  // размещаем отрендеренный холст 794px на всю ширину листа А4 (210мм).
  const marginMm = 0;
  const { printableWidthMm, printableHeightMm, pageCount } = calculateA4Dimensions(
    canvas.width,
    canvas.height,
    marginMm
  );

  const pdf = new jsPDF('p', 'mm', 'a4');

  if (pageCount <= 1) {
    const imgData = canvas.toDataURL('image/png', 1.0);
    const renderedHeightMm = (canvas.height * printableWidthMm) / canvas.width;
    pdf.addImage(
      imgData,
      'PNG',
      marginMm,
      marginMm,
      printableWidthMm,
      renderedHeightMm,
      undefined,
      'FAST'
    );
  } else {
    const sliceHeightPx = Math.floor((canvas.width * printableHeightMm) / printableWidthMm);

    for (let pageIdx = 0; pageIdx < pageCount; pageIdx++) {
      if (pageIdx > 0) {
        pdf.addPage();
      }

      const sourceY = pageIdx * sliceHeightPx;
      const currentSliceHeightPx = Math.min(sliceHeightPx, canvas.height - sourceY);
      if (currentSliceHeightPx <= 0) break;

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = currentSliceHeightPx;

      const pageCtx = pageCanvas.getContext('2d');
      if (pageCtx) {
        pageCtx.fillStyle = '#ffffff';
        pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        pageCtx.drawImage(
          canvas,
          0,
          sourceY,
          canvas.width,
          currentSliceHeightPx,
          0,
          0,
          canvas.width,
          currentSliceHeightPx
        );
      }

      const sliceDataUrl = pageCanvas.toDataURL('image/png', 1.0);
      const sliceHeightMm = (currentSliceHeightPx * printableWidthMm) / canvas.width;
      pdf.addImage(
        sliceDataUrl,
        'PNG',
        marginMm,
        marginMm,
        printableWidthMm,
        sliceHeightMm,
        undefined,
        'FAST'
      );
    }
  }

  pdf.save(`${cleanFilename}.pdf`);
}

/**
 * Функция 2: Открывает отдельное окно печати вне песочницы iframe,
 * переносит разметку #printable-sheet-area и базовые печатные стили А4,
 * и автоматически вызывает диалог печати браузера.
 */
export function printWorksheetInNewWindow(
  elementId: string = PRINTABLE_SHEET_ELEMENT_ID,
  title: string = 'Учебная пропись MoShui (墨水)'
): void {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(
      `Не найден печатный лист (#${elementId}). Добавьте хотя бы одно слово в пропись.`
    );
  }

  const styleNodes = document.querySelectorAll('style, link[rel="stylesheet"]');
  let collectedStylesHtml = '';
  styleNodes.forEach((node) => {
    collectedStylesHtml += node.outerHTML + '\n';
  });

  const printWin = window.open('', '_blank', 'width=900,height=850');
  if (!printWin) {
    throw new Error(
      'Всплывающее окно для печати было заблокировано браузером. Разрешите всплывающие окна или используйте кнопку «Скачать PDF».'
    );
  }

  const safeTitle = (title || 'Учебная пропись MoShui (墨水)')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const htmlContent = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=Inter:wght@400;500;600;700&family=Lora:wght@500;600;700&family=Ma+Shan+Zheng&family=Noto+Serif+SC:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  ${collectedStylesHtml}
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
    body {
      margin: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      background-color: #ffffff;
      color: #111827;
    }
    *, *::before, *::after {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    #${elementId} {
      border: none !important;
      box-shadow: none !important;
      margin: 0 auto !important;
    }
  </style>
</head>
<body>
  ${element.outerHTML}
  <script>
    window.addEventListener('load', function() {
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function() {
          setTimeout(function() {
            window.focus();
            window.print();
          }, 250);
        });
      } else {
        setTimeout(function() {
          window.focus();
          window.print();
        }, 350);
      }
    });
  </script>
</body>
</html>`;

  printWin.document.open();
  printWin.document.write(htmlContent);
  printWin.document.close();
}
