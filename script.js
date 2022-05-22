const MODEL_FILE_URL = "./model/model.json";
const video = document.getElementById("webcam");
const liveView = document.getElementById("liveView");

// Check if webcam access is supported.
function getUserMediaSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// If webcam supported, add event listener to button for when user
// wants to activate it to call enableCam function which we will
// define in the next step.
if (getUserMediaSupported()) {
  document.getElementById("webcamButton").addEventListener("click", enableCam);
} else {
  console.warn("getUserMedia() is not supported by your browser");
}
//button to activate the webcam
function enableCam() {
  if (!model) {
    return;
  }

  //edit video style and make width 100%
  video.style.width = "100%";

  const contaner = document.querySelectorAll(".container");

  // add hidden to the style of the container.
  contaner[0].style.display = "none";

  // make container visible.
  contaner[1].style.display = "block";

  // getUsermedia parameters to force video but not audio.
  const constraints = {
    facingMode: "environment",
    video: {
      height: {
        min: 315,
        ideal: 360,
        max: 540,
      },
      width: {
        min: 560,
        ideal: 640,
        max: 960,
      },
      frameRate: {
        min: 1,
        ideal: 7,
        max: 60,
      },
    },
  };

  // Activate the webcam stream.
  navigator.mediaDevices
    .getUserMedia(constraints)
    .then(
      function (stream) {
        video.srcObject = stream;
        video.addEventListener("loadeddata", predictWebcam);
      }
      // If the user denies access to the webcam, show a message.
    )
    .catch(function (err) {
      console.log(err.name + ": " + err.message);
      alert("Please allow access to your webcam.");
    });
}

var model = undefined;

// load the model
async function loadModel() {
  const model = await tf.loadGraphModel(MODEL_FILE_URL);

  // Set the model in the global scope so we can use it in the predictWebcam
  window.model = model;

  document.getElementById("invisible").classList.remove("invisible");

  // remove the loader
  document.getElementsByClassName("loader")[0].remove();
}

loadModel();

async function detact(webcamImage) {
  // Run the model on the webcam image.
  const resizedImage = webcamImage.resizeNearestNeighbor([720, 405]);
  const casted = resizedImage.cast("int32");
  const expanded = casted.expandDims(0);
  const obj = await model.executeAsync(expanded);
  return obj;
}

var children = [];

function predictWebcam() {
  // get the frame from the webcam.
  const webcamImage = tf.browser.fromPixels(video);
  // predict the objects in the frame.
  detact(webcamImage).then(function (predictions) {
    // Get the scores, class names, and bounding boxes of the detected objects.
    const classes = predictions[2].dataSync();
    const scores = predictions[4].dataSync();
    const boxes = predictions[1].dataSync();

    // remove predictions from memory.
    predictions = null;

    // score threshold to filter out objects.
    const scoresThreshold =
      Number("0." + document.getElementById("Threshold").value) + 0.3;

    // organize the data into a list of objects.
    const detectionObjects = buildDetectedObjects(
      scores,
      scoresThreshold,
      liveView.clientWidth, // imageWidth
      liveView.clientHeight, // imageHeight
      boxes,
      classes
    );

    // clear the old list of objects.
    for (let i = 0; i < children.length; i++) {
      liveView.removeChild(children[i]);
    }

    children.splice(0);

    //draw the bounding boxes on the image.
    if (detectionObjects.length > 0) {
      for (let i = 0; i < detectionObjects.length; i++) {
        const highlighter = document.createElement("div");

        highlighter.setAttribute("class", "highlighter");

        highlighter.style =
          "left: " +
          detectionObjects[i].bbox[0] +
          "px; top: " +
          // +40 for the margin
         (detectionObjects[i].bbox[1] + 40) +
          "px; width: " +
          detectionObjects[i].bbox[2] +
          "px; height: " +
          detectionObjects[i].bbox[3] +
          "px;";
        highlighter.style.backgroundColor = "rgba(255, 0, 0, 0.5)";

        liveView.appendChild(highlighter);

        children.push(highlighter);
      }

      // get hh and mm and ss and but it in one string.
      const time = new Date().toLocaleTimeString();

      // add to the predictionTable the data.
      const row = document.getElementById("predictionTable").insertRow(1);
      const cell1 = row.insertCell(0);
      const cell2 = row.insertCell(1);
      cell2.classList.add("centd");
      const cell3 = row.insertCell(2);
      cell1.innerHTML = detectionObjects.length;
      cell2.innerHTML = time;
      cell3.innerHTML = detectionObjects[0].score;
    }
  });

  setTimeout(function () {
    window.requestAnimationFrame(predictWebcam);
    //the time that we want to wait between each frame.
  }, 2400 / document.getElementById("speed").value);
}

function buildDetectedObjects(
  scores,
  threshold,
  imageWidth,
  imageHeight,
  boxes,
  classes
) {
  const detectionObjects = [];
  scores.forEach((score, i) => {
    if (score > threshold && classes[i] == "3") {
      const bbox = [];
      const minY = boxes[i * 4] * imageHeight;
      const minX = boxes[i * 4 + 1] * imageWidth;
      const maxY = boxes[i * 4 + 2] * imageHeight;
      const maxX = boxes[i * 4 + 3] * imageWidth;
      bbox[0] = minX;
      bbox[1] = minY;
      bbox[2] = maxX - minX;
      bbox[3] = maxY - minY;

      detectionObjects.push({
        class: classes[i],
        score: score.toFixed(4),
        bbox: bbox,
      });
    }
  });

  return detectionObjects;
}

// change videoinput to the next one from mediaDevices.
function chngcam() {
  const videoInputs = [];
  navigator.mediaDevices.enumerateDevices().then(function (devices) {
    devices.forEach(function (device) {
      if (device.kind === "videoinput") {
        videoInputs.push(device);
      }
    });

    const currentCamId = video.srcObject.getTracks()[0].getSettings().deviceId;
    console.log(currentCamId);

    // make array of the deviceIds.
    const camIds = videoInputs.map(function (cam) {
      return cam.deviceId;
    });

    // find the index of the currentCamId.
    const currentCamIndex = camIds.indexOf(currentCamId);

    if (currentCamIndex < videoInputs.length - 1) {
      video.srcObject.getTracks().forEach(function (track) {
        track.stop();
      });

      navigator.mediaDevices
        .getUserMedia({
          video: {
            deviceId: {
              exact: videoInputs[currentCamIndex + 1].deviceId,
            },
            height: {
              min: 315,
              ideal: 360,
              max: 540,
            },
            width: {
              min: 560,
              ideal: 640,
              max: 960,
            },
            frameRate: {
              min: 1,
              ideal: 7,
              max: 60,
            },
          },
        })
        .then(function (stream) {
          video.srcObject = stream;
          video.addEventListener("loadeddata", predictWebcam);
        })
        .catch(function (err) {
          console.log(err.name + ": " + err.message);
          alert("Please allow access to your webcam.");
        });
    } else {
      video.srcObject.getTracks().forEach(function (track) {
        track.stop();
      });

      navigator.mediaDevices
        .getUserMedia({
          video: {
            deviceId: {
              exact: videoInputs[0].deviceId,
            },
            height: {
              min: 315,
              ideal: 360,
              max: 540,
            },
            width: {
              min: 560,
              ideal: 640,
              max: 960,
            },
            frameRate: {
              min: 1,
              ideal: 7,
              max: 60,
            },
          },
        })
        .then(function (stream) {
          video.srcObject = stream;
          video.addEventListener("loadeddata", predictWebcam);
        })
        .catch(function (err) {
          console.log(err.name + ": " + err.message);
          alert("Please allow access to your webcam.");
        });
    }
  });
}
