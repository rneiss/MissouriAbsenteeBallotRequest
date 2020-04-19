const {
  asPDFName,
  degrees,
  drawImage,
  drawText,
  PDFArray,
  PDFContentStream,
  PDFDict,
  PDFDocument,
  PDFFont,
  PDFHexString,
  PDFImage,
  PDFName,
  PDFNumber,
  PDFOperator,
  PDFOperatorNames,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  rotateDegrees,
  StandardFonts,
  translate,
  PDFBool,
} = PDFLib

const getAcroForm = (pdfDoc) =>
  pdfDoc.catalog.lookup(PDFName.of('AcroForm'), PDFDict);

const getAcroFields = (pdfDoc) => {
  const acroForm = getAcroForm(pdfDoc);
  acroForm.set(PDFName.of('NeedAppearances'), PDFBool.True);
  if (!acroForm) return [];

  const fieldRefs = acroForm.lookupMaybe(PDFName.of('Fields'), PDFArray);
  if (!fieldRefs) return [];

  const fields = new Array(fieldRefs.size());
  for (let idx = 0, len = fieldRefs.size(); idx < len; idx++) {
    fields[idx] = fieldRefs.lookup(idx);
  }
  return fields;
};

const findAcroFieldByName = (pdfDoc, name) => {
  const acroFields = getAcroFields(pdfDoc);
  return acroFields.find((acroField) => {
    const fieldName = acroField.get(PDFName.of('T'));
    return !!fieldName && fieldName.value === name;
  });
};

const imageAppearanceStream = (
  image,
  rotation,
  width,
  height,
) => {
  const dict = image.doc.context.obj({
    Type: 'XObject',
    Subtype: 'Form',
    FormType: 1,
    BBox: [0, 0, width, height],
    Resources: { XObject: { Image: image.ref } },
  });

  const operators = [
    rotateDegrees(rotation),
    translate(0, rotation % 90 === 0 ? -width : 0),
    ...drawImage('Image', {
      x: 0,
      y: 0,
      width: height,
      height: width,
      rotate: degrees(0),
      xSkew: degrees(0),
      ySkew: degrees(0),
    }),
  ];

  const stream = PDFContentStream.of(dict, operators, false);

  return image.doc.context.register(stream);
};

const fillAcroTextField = (acroField, text, font) => {
  const rect = acroField.lookup(PDFName.of('Rect'), PDFArray);
  const width =
    rect.lookup(2, PDFNumber).value() - rect.lookup(0, PDFNumber).value();
  const height =
    rect.lookup(3, PDFNumber).value() - rect.lookup(1, PDFNumber).value();

  const MK = acroField.lookupMaybe(PDFName.of('MK'), PDFDict);
  const R = MK && MK.lookupMaybe(PDFName.of('R'), PDFNumber);
  const rotation = R ? R.value() : 0;

  const N = singleLineAppearanceStream(font, text, rotation, width, height);

  acroField.set(PDFName.of('AP'), acroField.context.obj({ N }));
  acroField.set(PDFName.of('Ff'), PDFNumber.of(1 /* Read Only */));
  acroField.set(PDFName.of('V'), PDFHexString.fromText(text));
};

const beginMarkedContent = (tag) =>
  PDFOperator.of(PDFOperatorNames.BeginMarkedContent, [asPDFName(tag)]);

const endMarkedContent = () => PDFOperator.of(PDFOperatorNames.EndMarkedContent);

const singleLineAppearanceStream = (
  font,
  text,
  rotation,
  width,
  height,
) => {
  const rotationCorrectedHeight = rotation % 90 === 0 ? width : height;

  const size = font.sizeAtHeight(rotationCorrectedHeight - 8);
  const encodedText = font.encodeText(text);
  const x = 0;
  const y = rotationCorrectedHeight - size;

  return textFieldAppearanceStream(
    font,
    size,
    encodedText,
    rotation,
    x,
    y,
    width,
    height,
  );
};

const textFieldAppearanceStream = (
  font,
  size,
  encodedText,
  rotation,
  x,
  y,
  width,
  height,
) => {
  const dict = font.doc.context.obj({
    Type: 'XObject',
    Subtype: 'Form',
    FormType: 1,
    BBox: [0, 0, width, height],
    Resources: { Font: { F0: font.ref } },
  });

  const operators = [
    rotateDegrees(rotation),
    translate(0, rotation % 90 === 0 ? -width : 0),
    beginMarkedContent('Tx'),
    pushGraphicsState(),
    ...drawText(encodedText, {
      color: rgb(0, 0, 0),
      font: 'F0',
      size,
      rotate: degrees(0),
      xSkew: degrees(0),
      ySkew: degrees(0),
      x,
      y,
    }),
    popGraphicsState(),
    endMarkedContent(),
  ];

  const stream = PDFContentStream.of(dict, operators);

  return font.doc.context.register(stream);
};
