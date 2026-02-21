const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let processingFrame = false;

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

/* // Camera start
async function startCamera() {
  // STEP 1: ask for camera permission first
  const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });

  // immediately stop this temp stream
  tempStream.getTracks().forEach((track) => track.stop());

  // STEP 2: now labels are visible
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cameras = devices.filter((d) => d.kind === "videoinput");

  console.log("Available cameras:", cameras);

  // STEP 3: lock to FaceTime camera
  const selectedCamera =
    cameras.find((cam) => cam.label.includes("FaceTime")) || cameras[0];

  console.log("Using camera:", selectedCamera.label);

  // STEP 4: start real stream
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      deviceId: { exact: selectedCamera.deviceId },
      width: 640,
      height: 480,
    },
  });

  video.srcObject = stream;
}

startCamera().catch((err) => console.error("Camera error:", err)); */

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
  // ALWAYS draw raw video first (prevents flicker)
  ctx.drawImage(
    video,
    0,
    0,
    video.videoWidth,
    video.videoHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const hasHands =
    results.multiHandLandmarks && results.multiHandLandmarks.length > 0;

  // draw landmarks if present
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
});

// Strat media after the video is ready
const camera = new Camera(video, {
  onFrame: async () => {
    if (processingFrame) return;

    processingFrame = true;

    try {
      await hands.send({ image: video });
    } finally {
      processingFrame = false;
    }
  },
  width: 640,
  height: 480,
});

camera.start();

// ensure canvas size after stream begins
video.onloadedmetadata = () => {
  const w = video.videoWidth;
  const h = video.videoHeight;

  canvas.width = w;
  canvas.height = h;

  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
};

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
