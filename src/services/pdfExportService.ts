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
 * Дожидается полной загрузки всех изображений внутри печатного листа перед запуском html2canvas.
 */
async function ensureImagesLoaded(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll('img'));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const onDone = () => {
            img.removeEventListener('load', onDone);
            img.removeEventListener('error', onDone);
            resolve();
          };
          img.addEventListener('load', onDone);
          img.addEventListener('error', onDone);
        })
    )
  );
}

/**
 * Встраивает изображения внутри клонированного печатного листа как inline PNG dataURL
 * с учетом mix-blend-mode: multiply на белом фоне, чтобы html2canvas мгновенно отрендерил логотип.
 */
function inlineImagesForHtml2Canvas(
  originalContainer: HTMLElement,
  clonedContainer: HTMLElement
): void {
  const origImages = Array.from(originalContainer.querySelectorAll('img'));
  const clonedImages = Array.from(clonedContainer.querySelectorAll('img'));

  origImages.forEach((origImg, idx) => {
    const clonedImg = clonedImages[idx];
    if (!clonedImg || !origImg.complete || origImg.naturalWidth === 0) return;

    try {
      const w = Math.min(origImg.naturalWidth || 256, 384);
      const h = Math.min(origImg.naturalHeight || 256, 384);
      const offscreen = document.createElement('canvas');
      offscreen.width = w;
      offscreen.height = h;
      const ctx = offscreen.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(origImg, 0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';

      clonedImg.src = offscreen.toDataURL('image/png');
    } catch {
      // Оставляем исходный src, если конвертация недоступна
    }
  });
}

/**
 * Быстро очищает таблицы стилей в клонированном документе от функций oklch/oklab/color-mix,
 * не обходя тысячи DOM-узлов вне печатного листа.
 */
function normalizeStylesheetsForHtml2Canvas(clonedDoc: Document): void {
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
      return 'rgb(24, 24, 27)';
    }
  };

  const replaceUnsupportedFunctionsInString = (str: string): string => {
    if (!/(?:oklch|oklab|color-mix|lch|lab|color)\(/i.test(str)) {
      return str;
    }
    let next = str.replace(/(?:oklch|oklab|lch|lab|color)\([^()]+\)/gi, (match) => {
      if (match.includes('var(')) return 'rgb(24, 24, 27)';
      return toRgbString(match);
    });
    next = next.replace(/color-mix\([^;{}]+\)/gi, 'rgba(24, 24, 27, 0.12)');
    return next;
  };

  const styleElements = clonedDoc.querySelectorAll('style');
  styleElements.forEach((styleEl) => {
    if (styleEl.textContent) {
      styleEl.textContent = replaceUnsupportedFunctionsInString(styleEl.textContent);
    }
  });
}

/**
 * Функция 1: Многостраничный экспорт печатного листа А4 в PDF в высоком разрешении (~300 DPI, scale: 2.5).
 * Находит все страницы `.printable-a4-page` внутри `#printable-sheet-area` (или в документе),
 * поочередно рендерит каждый лист А4 через html2canvas и добавляет в документ jsPDF через `pdf.addPage()`.
 */
export async function downloadWorksheetAsPDF(
  elementId: string = PRINTABLE_SHEET_ELEMENT_ID,
  filename: string = 'moshui-worksheet'
): Promise<void> {
  const rootElement = document.getElementById(elementId);
  if (!rootElement) {
    throw new Error(
      `Не найден печатный лист (#${elementId}). Добавьте хотя бы одно слово в пропись.`
    );
  }

  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }
  await ensureImagesLoaded(rootElement);

  const cleanFilename = sanitizePdfFilename(filename);

  const pageNodeList = rootElement.querySelectorAll<HTMLElement>('.printable-a4-page');
  const pagesToRender: HTMLElement[] =
    pageNodeList.length > 0 ? Array.from(pageNodeList) : [rootElement];

  const pdf = new jsPDF('p', 'mm', 'a4');

  for (let i = 0; i < pagesToRender.length; i++) {
    const pageEl = pagesToRender[i];
    if (i > 0) {
      await new Promise((r) => setTimeout(r, 80));
      pdf.addPage();
    }

    pageEl.style.setProperty('-webkit-font-smoothing', 'antialiased');
    pageEl.style.setProperty('text-rendering', 'geometricPrecision');

    const canvas = await html2canvas(pageEl, {
      scale: 2.5,
      width: 794,
      windowWidth: 794,
      backgroundColor: '#FFFFFF',
      useCORS: true,
      allowTaint: true,
      logging: false,
      imageTimeout: 0,
      removeContainer: true,
      onclone: (clonedDoc, clonedPageEl) => {
        normalizeStylesheetsForHtml2Canvas(clonedDoc);
        inlineImagesForHtml2Canvas(pageEl, clonedPageEl);

        clonedDoc.body.innerHTML = '';
        clonedDoc.body.style.margin = '0';
        clonedDoc.body.style.padding = '0';
        clonedDoc.body.style.backgroundColor = '#FFFFFF';
        clonedDoc.body.style.setProperty('-webkit-font-smoothing', 'antialiased');
        clonedDoc.body.style.setProperty('text-rendering', 'geometricPrecision');
        clonedDoc.body.appendChild(clonedPageEl);

        clonedPageEl.style.transform = 'none';
        clonedPageEl.style.transformOrigin = 'top left';
        clonedPageEl.style.width = '794px';
        clonedPageEl.style.minHeight = '1123px';
        clonedPageEl.style.padding = '40px';
        clonedPageEl.style.margin = '0';
        clonedPageEl.style.boxSizing = 'border-box';
        clonedPageEl.style.boxShadow = 'none';
        clonedPageEl.style.border = 'none';
        clonedPageEl.style.borderRadius = '0';
        clonedPageEl.style.backgroundColor = '#FFFFFF';
        clonedPageEl.style.setProperty('-webkit-font-smoothing', 'antialiased');
        clonedPageEl.style.setProperty('text-rendering', 'geometricPrecision');
      },
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  }

  pdf.save(`${cleanFilename}.pdf`);
}

/**
 * Функция 2: Мгновенная системная печать — открывает окно печати с поддержкой многостраничных
 * листов `.printable-a4-page` и вызывает диалог печати/сохранения в PDF браузера.
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

  // Клонируем узел печатного листа и встраиваем логотип как Data URL (или абсолютный URL),
  // чтобы в новом окне печати (about:blank) картинка гарантированно отображалась без потерь
  const clonedElement = element.cloneNode(true) as HTMLElement;
  inlineImagesForHtml2Canvas(element, clonedElement);

  const origImages = Array.from(element.querySelectorAll('img'));
  const clonedImages = Array.from(clonedElement.querySelectorAll('img'));
  clonedImages.forEach((img, idx) => {
    const origImg = origImages[idx];
    const currentSrc = img.getAttribute('src') || '';
    if (!currentSrc.startsWith('data:') && origImg?.src) {
      img.setAttribute('src', origImg.src);
    } else if (currentSrc.startsWith('/') && typeof window !== 'undefined') {
      img.setAttribute('src', `${window.location.origin}${currentSrc}`);
    }
    img.style.mixBlendMode = 'normal';
    img.style.setProperty('print-color-adjust', 'exact');
    img.style.setProperty('-webkit-print-color-adjust', 'exact');
  });

  const styleNodes = document.querySelectorAll('style, link[rel="stylesheet"]');
  let collectedStylesHtml = '';
  styleNodes.forEach((node) => {
    if (node.tagName.toLowerCase() === 'link') {
      const linkEl = node as HTMLLinkElement;
      const clonedLink = linkEl.cloneNode(true) as HTMLLinkElement;
      if (linkEl.href) {
        clonedLink.setAttribute('href', linkEl.href);
      }
      collectedStylesHtml += clonedLink.outerHTML + '\n';
    } else {
      collectedStylesHtml += node.outerHTML + '\n';
    }
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
      margin: 0;
    }
    body {
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      background-color: #ffffff;
      color: #111827;
    }
    *, *::before, *::after {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    img {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      mix-blend-mode: normal !important;
    }
    #${elementId} {
      border: none !important;
      box-shadow: none !important;
      margin: 0 auto !important;
      padding: 0 !important;
    }
    .printable-a4-page {
      page-break-after: always;
      break-after: page;
      margin: 0 auto !important;
      box-shadow: none !important;
      border: none !important;
      border-radius: 0 !important;
    }
    .printable-a4-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    @media print {
      img {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        mix-blend-mode: normal !important;
      }
      .printable-a4-page {
        page-break-after: always;
        break-after: page;
        margin: 0 !important;
        box-shadow: none !important;
        border: none !important;
      }
      .printable-a4-page:last-child {
        page-break-after: auto;
        break-after: auto;
      }
    }
  </style>
</head>
<body>
  ${clonedElement.outerHTML}
  <script>
    (function() {
      var hasPrinted = false;
      function triggerPrintWhenReady() {
        if (hasPrinted) return;
        hasPrinted = true;
        var images = Array.from(document.images || []);
        var imagePromises = images.map(function(img) {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise(function(resolve) {
            img.onload = resolve;
            img.onerror = resolve;
          });
        });
        var fontsPromise = (document.fonts && document.fonts.ready)
          ? document.fonts.ready
          : Promise.resolve();

        Promise.all(imagePromises)
          .then(function() { return fontsPromise; })
          .then(function() {
            setTimeout(function() {
              window.focus();
              window.print();
            }, 250);
          });
      }

      if (document.readyState === 'complete') {
        triggerPrintWhenReady();
      } else {
        window.addEventListener('load', triggerPrintWhenReady);
      }
    })();
  </script>
</body>
</html>`;

  printWin.document.open();
  printWin.document.write(htmlContent);
  printWin.document.close();
}
