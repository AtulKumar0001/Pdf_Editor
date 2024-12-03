import { readAsArrayBuffer } from './asyncReader.js';
import { fetchFont, getAsset } from './prepareAssets';
import { noop } from './helper.js';

export async function save(pdfFile, objects, name) {
  const PDFLib = await getAsset('PDFLib');
  const download = await getAsset('download');
  let pdfDoc;
  
  try {
    console.log('Starting PDF save process...');
    pdfDoc = await PDFLib.PDFDocument.load(await readAsArrayBuffer(pdfFile));
    
    const pagesProcesses = pdfDoc.getPages().map(async (page, pageIndex) => {
      console.log(`Processing page ${pageIndex + 1}...`);
      const pageObjects = objects[pageIndex];
      const pageHeight = page.getHeight();
      
      const embedProcesses = pageObjects.map(async (object) => {
        console.log(`Processing object type: ${object.type}`);
        if (object.type === 'image') {
          let { file, x, y, width, height } = object;
          let img;
          try {
            if (file.type === 'image/jpeg') {
              img = await pdfDoc.embedJpg(await readAsArrayBuffer(file));
            } else {
              img = await pdfDoc.embedPng(await readAsArrayBuffer(file));
            }
            return () =>
              page.drawImage(img, {
                x,
                y: pageHeight - y - height,
                width,
                height,
              });
          } catch (e) {
            console.log('Failed to embed image.', e);
            return noop;
          }
        } else if (object.type === 'text') {
          let { x, y, lines, lineHeight, size, fontFamily, width } = object;
          const height = size * lineHeight * lines.length;
          const font = await fetchFont(fontFamily);
          const [textPage] = await pdfDoc.embedPdf(
            await makeTextPDF({
              lines,
              fontSize: size,
              lineHeight,
              width,
              height,
              font: font.buffer || fontFamily, // built-in font family
              dy: font.correction(size, lineHeight),
            }),
          );
          return () =>
            page.drawPage(textPage, {
              width,
              height,
              x,
              y: pageHeight - y - height,
            });
        } else if (object.type === 'drawing') {
          let { x, y, path, scale } = object;
          const {
            pushGraphicsState,
            setLineCap,
            popGraphicsState,
            setLineJoin,
            LineCapStyle,
            LineJoinStyle,
          } = PDFLib;
          return () => {
            page.pushOperators(
              pushGraphicsState(),
              setLineCap(LineCapStyle.Round),
              setLineJoin(LineJoinStyle.Round),
            );
            page.drawSvgPath(path, {
              borderWidth: 5,
              scale,
              x,
              y: pageHeight - y,
            });
            page.pushOperators(popGraphicsState());
          };
        } else if (object.type === 'blur' || object.type === 'erase') {
          let { x, y, width, height } = object;
          return () => {
            try {
              if (object.type === 'erase') {
                page.drawRectangle({
                  x,
                  y: pageHeight - y - height,
                  width,
                  height,
                  color: PDFLib.rgb(1, 1, 1),
                  opacity: 1,
                  borderWidth: 0
                });
              } else {
                const pixelSize = 10;
                for (let px = 0; px < width; px += pixelSize) {
                  for (let py = 0; py < height; py += pixelSize) {
                    page.drawRectangle({
                      x: x + px,
                      y: pageHeight - (y + py) - pixelSize,
                      width: pixelSize,
                      height: pixelSize,
                      color: PDFLib.rgb(0.9, 0.9, 0.9),
                      opacity: 0.7,
                    });
                  }
                }
                page.drawRectangle({
                  x,
                  y: pageHeight - y - height,
                  width,
                  height,
                  color: PDFLib.rgb(0.95, 0.95, 0.95),
                  opacity: 0.3,
                });
              }
            } catch (e) {
              console.error('Error processing erase/blur:', e);
              return () => {};
            }
          };
        }
      });
      
      const drawProcesses = await Promise.all(embedProcesses);
      drawProcesses.forEach((p) => p());
    });
    
    await Promise.all(pagesProcesses);
    console.log('All pages processed, generating PDF bytes...');
    
    const pdfBytes = await pdfDoc.save();
    console.log('PDF bytes generated, initiating download...');
    download(pdfBytes, name, 'application/pdf');
    console.log('Download initiated.');
  } catch (e) {
    console.error('Error in PDF save process:', e);
    throw e;
  }
}
