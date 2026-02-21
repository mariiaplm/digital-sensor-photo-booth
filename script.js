const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// State
let processingFrame = false;
let photoTaken = false;
let lastPinchState = false;
let isAdjustingFrame = true;
let countdown = null;

// Hands setup
const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 0, // keep light for smooth performance
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.6,
});

// Draw loop
hands.onResults((results) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const vw = video.videoWidth;
  const vh = video.videoHeight;

  const canvasRatio = canvas.width / canvas.height;
  const videoRatio = vw / vh;

  let drawWidth, drawHeight, offsetX, offsetY;

  if (videoRatio > canvasRatio) {
    drawWidth = canvas.width;
    drawHeight = canvas.width / videoRatio;
    offsetX = 0;
    offsetY = (canvas.height - drawHeight) / 2;
  } else {
    drawHeight = canvas.height;
    drawWidth = canvas.height * videoRatio;
    offsetY = 0;
    offsetX = (canvas.width - drawWidth) / 2;
  }

  // raw camera centered with correct ratio
  ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);

  // align landmarks to same transform as video
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(drawWidth / canvas.width, drawHeight / canvas.height);

  const hasHands =
    results.multiHandLandmarks && results.multiHandLandmarks.length > 0;

  if (!photoTaken && hasHands) {
    for (const landmarks of results.multiHandLandmarks) {
      // ignore ghost frames when hand leaves
      if (!landmarks || landmarks.length !== 21) continue;

      drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
        color: "#00FF00",
        lineWidth: 2,
      });

      drawLandmarks(ctx, landmarks, {
        color: "#FF0000",
        radius: 2,
      });
    }

    if (typeof detectGestures === "function") {
      detectGestures(results.multiHandLandmarks);
    }
  } else {
    lastPinchState = false;
  }

  ctx.restore(); // 🔴 MUST restore after scaling

  if (typeof drawFrame === "function") {
    drawFrame();
  }
});

// Start camera
navigator.mediaDevices
  .getUserMedia({
    video: {
      facingMode: "user",
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  })
  .then((stream) => {
    video.srcObject = stream;

    video.onloadedmetadata = () => {
      // make canvas exactly to match video resolution
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

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
      });

      camera.start();
    };
  })
  .catch((err) => console.error(err));

video.onloadedmetadata = () => {
  const videoRatio = video.videoWidth / video.videoHeight;

  const maxWidth = window.innerWidth;
  const maxHeight = window.innerHeight;

  let drawWidth = maxWidth;
  let drawHeight = drawWidth / videoRatio;

  if (drawHeight > maxHeight) {
    drawHeight = maxHeight;
    drawWidth = drawHeight * videoRatio;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  canvas.style.width = drawWidth + "px";
  canvas.style.height = drawHeight + "px";
};

// photo function
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

/////// up to this point everything functions
// when go live asks for the permission of the camera, camera frame pops up in hd quality
// gesture detection works
