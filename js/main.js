//Set JS for animation triggering, and pagination of Form
var left, opacity, scale; //fieldset properties which we will animate
var animating; //flag to prevent quick multi-click glitches

function animate_fs(current_fs, target_fs, direction) {

  if (animating) return false;
  animating = true;

  //activate or deactivate step on progressbar
  if (direction == "next") {
    $("#progressbar li").eq($("fieldset").index(target_fs)).addClass("active");
  }
  else {
    $("#progressbar li").eq($("fieldset").index(current_fs)).removeClass("active");
  }

  //show the target fieldset
  target_fs.show();

  //hide the current fieldset with style
  current_fs.animate({
    opacity: 0
  }, {
    step: function(now, mx) {
      opacity = 1 - now;

      if (direction == "next") {
        scale = 1 - (1 - now) * 0.2;
        left = (now * 50) + "%";
        current_fs.css({
          'transform': 'scale(' + scale + ')',
          'position': 'absolute'
        });
        target_fs.css({
          'left': left,
          'opacity': opacity
        });
      }
      else {
        scale = 0.8 + (1 - now) * 0.2;
        left = ((1 - now) * 50) + "%";
        current_fs.css({
          'left': left
        });
        target_fs.css({
          'transform': 'scale(' + scale + ')',
          'opacity': opacity
        });

      }
    },
    duration: 800,
    complete: function() {
      current_fs.hide();
      animating = false;
    },
    //this comes from the custom easing plugin
    easing: 'easeInOutBack'
  });

}

$(".next").click(function() {
  animate_fs($(this).parent(), $(this).parent().next(), 'next')
});

$(".previous").click(function() {
	signaturePad.clear();
	animate_fs($(this).parent(), $(this).parent().prev(), 'prev')
});

$("#zipButton").click(function(e) {
  const countyData = (zipcode_to_county[$("#zipcode").val()]);
  if (!countyData) {
    alert("That zipcode won't work. Sorry.")
    location.reload();
   }
  $("#sendFormTo").html(countyData)
});

// enter advances slide instead of submit form
$('*').keydown(function(e) {
  var key = e.charCode ? e.charCode : e.keyCode ? e.keyCode : 0;
  if (key == 13) {
    e.preventDefault();
    // if ($('.next:visible').length > 0) {
    //   animate_fs($('fieldset:visible'), $('fieldset:visible').next(), 'next')
    // }
    // else {
    //   $('.submit').click();
    // }
  }
});


// handle submit
$('#msform').submit(function() {
  var imageData = signaturePad.toDataURL();
  document.getElementsByName("signature")[0].setAttribute("value", imageData);

  var values = {};

  $.each($(this).serializeArray(), function() {
      values[this.name] = this.value;
  });

  console.log(values)
  modifyPdf(values);

  return false; // returning true submits the form.
});


//initialize signature pad:
var canvas = document.querySelector("canvas");
var signaturePad = new SignaturePad(canvas);
signaturePad.on();


// modify pdf
async function modifyPdf(submissionData) {
	//load template
  const ticketTemplateBytes = await fetch(
    './template.pdf',
  ).then((res) => res.arrayBuffer());

  const pdfDoc = await PDFDocument.load(ticketTemplateBytes);
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const fillInField = (fieldName, text) => {
    const field = findAcroFieldByName(pdfDoc, fieldName);
    if (field) fillAcroTextField(field, text, helveticaFont);
  };

  const lockField = (acroField) => {
    const fieldType = acroField.lookup(PDFName.of('FT'));
    if (fieldType === PDFName.of('Tx')) {
      acroField.set(PDFName.of('Ff'), PDFNumber.of(1 << 0 /* Read Only */ ));
    }
  };

	//the field names here are not super descriptive, but they match the form template downloaded from MO SoS website.
  fillInField('do hereby request an absentee ballot for the', `${submissionData['fname']} ${submissionData['lname']}`); //name
  fillInField('Election', `June 2, 2020`); // election date
  fillInField('undefined', `${submissionData['last4ss']}`); // last 4 ss
  fillInField('undefined_2', ``); // party for primary
  fillInField('Absence on Election Day from the jurisdiction of the election authority in which I am registered', `${submissionData['reason'] == 0 ? "X" : ""}`); //reason for absentee
  fillInField('Incapacity or confinement due to illness or physical disability including caring for a person who is incapacitatedor', `${submissionData['reason'] == 1 ? "X" : ""}`); //reason for absentee
  fillInField('Religious belief or practice', `${submissionData['reason'] == 2 ? "X" : ""}`); //reason for absentee
  fillInField('Employment as an election authority or by an election authority at a location other than my polling place', `${submissionData['reason'] == 3 ? "X" : ""}`); //reason for absentee
  fillInField('Incarceration although I have retained all the necessary qualifications for voting', `${submissionData['reason'] == 4 ? "X" : ""}`); //reason for absentee
  fillInField('Certified participation in the address confidentiality program established under sections 589660 to 589681', `${submissionData['reason'] == 5 ? "X" : ""}`); //reason for absentee

  fillInField('Street Address', `${submissionData['address']}`); //address 1
  fillInField('City State Zip Code', `${submissionData['address']}`); //address 2
  fillInField('Street Address or PO Box', `${submissionData['address']}`); //ballot mailto address 1
  fillInField('City State Zip Code_2', `${submissionData['address']}`); //ballot mailto address 2
  fillInField('Include Area Code', `${submissionData['address']}`); //phone
  fillInField('Date', new Date().toLocaleDateString()); //date

	//get image from signaturePad and embed in pdf
	const pngImage = await pdfDoc.embedPng(submissionData['signature'])
  const pngDims = pngImage.scale(0.25)
  const pages = pdfDoc.getPages();
  const page = pages[0]
  page.drawImage(pngImage, {
    x: 50,
    y: 150,
    width: pngDims.width,
    height: pngDims.height,
  })
  

	//lock fields to prevent further editting
  const acroFields = getAcroFields(pdfDoc);
  acroFields.forEach((field) => lockField(field));

	//save and load for user
  const pdfBytes = await pdfDoc.save();
  download(pdfBytes, "absentee_application.pdf", "application/pdf");
};
