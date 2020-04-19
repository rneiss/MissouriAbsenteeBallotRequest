var current_fs, next_fs, previous_fs; //fieldsets
var left, opacity, scale; //fieldset properties which we will animate
var animating; //flag to prevent quick multi-click glitches


$('input').keydown( function(e) {
			 var key = e.charCode ? e.charCode : e.keyCode ? e.keyCode : 0;
			 if(key == 13) {
					 e.preventDefault();
			 }
	 });


$(".next").click(function(){
	if(animating) return false;
	animating = true;

	current_fs = $(this).parent();
	next_fs = $(this).parent().next();

	//activate next step on progressbar using the index of next_fs
	$("#progressbar li").eq($("fieldset").index(next_fs)).addClass("active");

	//show the next fieldset
	next_fs.show();
	//hide the current fieldset with style
	current_fs.animate({opacity: 0}, {
		step: function(now, mx) {
			//as the opacity of current_fs reduces to 0 - stored in "now"
			//1. scale current_fs down to 80%
			scale = 1 - (1 - now) * 0.2;
			//2. bring next_fs from the right(50%)
			left = (now * 50)+"%";
			//3. increase opacity of next_fs to 1 as it moves in
			opacity = 1 - now;
			current_fs.css({
        'transform': 'scale('+scale+')',
        'position': 'absolute'
      });
			next_fs.css({'left': left, 'opacity': opacity});
		},
		duration: 800,
		complete: function(){
			current_fs.hide();
			animating = false;
		},
		//this comes from the custom easing plugin
		easing: 'easeInOutBack'
	});
});

$(".previous").click(function(){
	if(animating) return false;
	animating = true;

	current_fs = $(this).parent();
	previous_fs = $(this).parent().prev();

	//de-activate current step on progressbar
	$("#progressbar li").eq($("fieldset").index(current_fs)).removeClass("active");

	signaturePad.clear();

	//show the previous fieldset
	previous_fs.show();
	//hide the current fieldset with style
	current_fs.animate({opacity: 0}, {
		step: function(now, mx) {
			//as the opacity of current_fs reduces to 0 - stored in "now"
			//1. scale previous_fs from 80% to 100%
			scale = 0.8 + (1 - now) * 0.2;
			//2. take current_fs to the right(50%) - from 0%
			left = ((1-now) * 50)+"%";
			//3. increase opacity of previous_fs to 1 as it moves in
			opacity = 1 - now;
			current_fs.css({'left': left});
			previous_fs.css({'transform': 'scale('+scale+')', 'opacity': opacity});
		},
		duration: 800,
		complete: function(){
			current_fs.hide();
			animating = false;
		},
		//this comes from the custom easing plugin
		easing: 'easeInOutBack'
	});
});


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




    async function modifyPdf(submissionData) 		{
				  const ticketTemplateBytes = await fetch(
				    './template.pdf',
				  ).then((res) => res.arrayBuffer());

				  // const imageBytes = await fetch(
				  //   'https://github.com/Hopding/pdf-lib/raw/master/assets/images/cat_riding_unicorn.jpg',
				  // ).then((res) => res.arrayBuffer());

				  const pdfDoc = await PDFDocument.load(ticketTemplateBytes);

				  // Fill Image

				  // const image = await pdfDoc.embedJpg(imageBytes);

				  // const imageButton = findAcroFieldByName(pdfDoc, 'QR');

				  // const rect = imageButton.lookup(PDFName.of('Rect'), PDFArray);
				  // const width =
				  //   rect.lookup(2, PDFNumber).value() - rect.lookup(0, PDFNumber).value();
				  // const height =
				  //   rect.lookup(3, PDFNumber).value() - rect.lookup(1, PDFNumber).value();
					//
				  // const MK = imageButton.lookupMaybe(PDFName.of('MK'), PDFDict);
				  // const R = MK && MK.lookupMaybe(PDFName.of('R'), PDFNumber);
				  // const rotation = R ? R.value() : 0;
					//
				  // const imageAppearanceStreamRef = imageAppearanceStream(
				  //   image,
				  //   rotation,
				  //   width,
				  //   height,
				  // );
					//
				  // imageButton.set(
				  //   PDFName.of('AP'),
				  //   pdfDoc.context.obj({ N: imageAppearanceStreamRef }),
				  // );

				  // Fill Form ---------------------------------------------

				  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

				  const fillInField = (fieldName, text) => {
				    const field = findAcroFieldByName(pdfDoc, fieldName);
				    if (field) fillAcroTextField(field, text, helveticaFont);
				  };

				  const lockField = (acroField) => {
				    const fieldType = acroField.lookup(PDFName.of('FT'));
				    if (fieldType === PDFName.of('Tx')) {
				      acroField.set(PDFName.of('Ff'), PDFNumber.of(1 << 0 /* Read Only */));
				    }
				  };


					//
					//

				  fillInField('do hereby request an absentee ballot for the', `${submissionData[3].value} ${submissionData[4].value}`); //name
					fillInField('Election', `${submissionData[1].value}`); // election date
					fillInField('undefined', `${submissionData[7].value}`); // last 4 ss
					fillInField('undefined_2', ``); // party for primary
					fillInField('Absence on Election Day from the jurisdiction of the election authority in which I am registered', `${submissionData[2].value == 0 ? "X" : ""}`); //reason for absentee
					fillInField('Incapacity or confinement due to illness or physical disability including caring for a person who is incapacitatedor', `${submissionData[2].value == 1 ? "X" : ""}`); //reason for absentee
					fillInField('Religious belief or practice', `${submissionData[2].value == 2 ? "X" : ""}`); //reason for absentee
					fillInField('Employment as an election authority or by an election authority at a location other than my polling place', `${submissionData[2].value == 3 ? "X" : ""}`); //reason for absentee
					fillInField('Incarceration although I have retained all the necessary qualifications for voting', `${submissionData[2].value == 4 ? "X" : ""}`); //reason for absentee
					fillInField('Certified participation in the address confidentiality program established under sections 589660 to 589681', `${submissionData[2].value == 5 ? "X" : ""}`); //reason for absentee

					fillInField('Street Address', `${submissionData[5].value}`); //address 1
					fillInField('City State Zip Code', `${submissionData[5].value}`); //address 2
					fillInField('Street Address or PO Box', `${submissionData[5].value}`); //ballot mailto address 1
					fillInField('City State Zip Code_2', `${submissionData[5].value}`); //ballot mailto address 2
					fillInField('Include Area Code', `${submissionData[6].value}`); //phone
					fillInField('Date', new Date().toLocaleDateString()); //date


          const pngImage = await pdfDoc.embedPng(submissionData[8].value)

					const pngDims = pngImage.scale(0.25)
					const pages = pdfDoc.getPages();
					const page = pages[0]
					page.drawImage(pngImage, {
				    x: 50,
				    y: 150,
				    width: pngDims.width,
				    height: pngDims.height,
				  })

				  const acroFields = getAcroFields(pdfDoc);
				  acroFields.forEach((field) => lockField(field));

				  const pdfBytes = await pdfDoc.save();

					download(pdfBytes, "demo.pdf", "application/pdf");
				};


$('#msform').submit(function() {
  var imageData = signaturePad.toDataURL();
  document.getElementsByName("signature")[0].setAttribute("value", imageData);

	var values = $(this).serializeArray();
	console.log(values)
  modifyPdf(values);

  return false; // returning true submits the form.
 });

var canvas = document.querySelector("canvas");

var signaturePad = new SignaturePad(canvas);

signaturePad.on();
