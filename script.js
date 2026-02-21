const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let lastFrame = null;
let photoTaken = false;
let lastPinchState = false;
let isAdjustingFrame = true;
let countdown = null;

// These must already exist in your project
// let frameBox = { x: 100, y: 100, width: 200, height: 200 };
// function detectGestures() {}
// function drawFrame() {}
// function savePhoto() {}

// Camera start
navigator.mediaDevices
  .getUserMedia({
    video: { width: 640, height: 480 },
  })
  .then((stream) => {
    video.srcObject = stream;
  })
  .catch((err) => console.error("Camera error:", err));

// Hands setup
const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 0,
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.6,
});

hands.onResults((results) => {
  const hasHands =
    results.multiHandLandmarks && results.multiHandLandmarks.length > 0;

  ctx.save();

  // store last valid frame to prevent flicker
  if (results.image) {
    lastFrame = results.image;
  }

  // draw frame if available
  if (lastFrame) {
    ctx.drawImage(lastFrame, 0, 0, canvas.width, canvas.height);
  }

  // draw landmarks + detect gestures
  if (!photoTaken && hasHands) {
    for (const landmarks of results.multiHandLandmarks) {
      drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
        color: "#00FF00",
        lineWidth: 1,
      });

      drawLandmarks(ctx, landmarks, {
        color: "#FF0000",
        lineWidth: 1,
        radius: 3,
      });
    }

    if (typeof detectGestures === "function") {
      detectGestures(results.multiHandLandmarks);
    }
  } else if (!hasHands) {
    lastPinchState = false;
  }

  if (typeof drawFrame === "function") {
    drawFrame();
  }

  ctx.restore();
});

// Strat media after the video is ready
video.addEventListener("loadeddata", () => {
  // lock canvas size ONCE
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;

  const camera = new Camera(video, {
    onFrame: async () => {
      await hands.send({ image: video });
    },
    width: canvas.width,
    height: canvas.height,
  });

  camera.start();
});

// photo fucntion
function takePhoto() {
  photoTaken = true;

  const photoCanvas = document.createElement("canvas");
  photoCanvas.width = frameBox.width;
  photoCanvas.height = frameBox.height;

  const photoCtx = photoCanvas.getContext("2d");

  photoCtx.drawImage(
    video,
    frameBox.x,
    frameBox.y,
    frameBox.width,
    frameBox.height,
    0,
    0,
    frameBox.width,
    frameBox.height,
  );

  const photoDataUrl = photoCanvas.toDataURL("image/png");

  if (typeof savePhoto === "function") {
    savePhoto(photoDataUrl);
  }

  setTimeout(() => {
    isAdjustingFrame = true;
    countdown = null;
    photoTaken = false;
  }, 3000);
}
