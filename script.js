const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// State
let processingFrame = false;
let photoTaken = false;
let captureDelay = false;
let frameLocked = false;
let countdownActive = false;
let countdownStart = 0;
const countdownTime = 3000;
let usingCustomFrame = false; // true while two hands are sizing the frame
let flashAlpha = 0;
let videoTransform = {
  vw: 0,
  vh: 0,
  drawWidth: 0,
  drawHeight: 0,
  offsetX: 0,
  offsetY: 0,
};

// added the audio
const shutterSound = new Audio(
  "freesound_community-iphone-camera-capture-6448.mp3",
);

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
  if (!vw || !vh) return;

  if (canvas.width !== vw || canvas.height !== vh) {
    canvas.width = vw;
    canvas.height = vh;
    setDefaultFrame();
  }

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

  videoTransform = { vw, vh, drawWidth, drawHeight, offsetX, offsetY };

  // mirrored camera, centered with correct audio
  ctx.save();
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(
    video,
    0,
    0,
    vw,
    vh,
    canvas.width - offsetX - drawWidth,
    offsetY,
    drawWidth,
    drawHeight,
  );

  ctx.restore();

  const hasHands =
    results.multiHandLandmarks && results.multiHandLandmarks.length > 0;

  // hands headen once the countdown starts, so the shot starts clean
  if (!photoTaken && hasHands && !countdownActive) {
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(drawWidth / canvas.width, drawHeight / canvas.height);

    for (const landmarks of results.multiHandLandmarks) {
      const mirrored = landmarks.map((p) => ({
        x: 1 - p.x,
        y: p.y,
        z: p.z,
      }));

      drawConnectors(ctx, mirrored, HAND_CONNECTIONS, {
        color: "#00FF00",
        lineWidth: 2,
      });

      drawLandmarks(ctx, mirrored, {
        color: "#FF0000",
        radius: 2,
      });
    }

    ctx.restore();
  }

  if (!photoTaken && hasHands) {
    detectGestures(results.multiHandLandmarks);
  } else if (!hasHands && !countdownActive) {
    usingCustomFrame = false;
    setDefaultFrame();
  }

  drawFrame();

  // countdown number
  if (countdownActive) {
    const elapsed = Date.now() - countdownStart;
    const seconds = Math.ceil((countdownTime - elapsed) / 1000);

    ctx.fillStyle = "white";
    ctx.font = "bold 100px Arial";
    ctx.textAlign = "center";

    if (seconds > 0) {
      ctx.fillText(seconds, canvas.width / 2, canvas.height / 2);
    }

    if (elapsed >= countdownTime && !captureDelay) {
      captureDelay = true;
      flashAlpha = 1;

      shutterSound.currentTime = 0;
      shutterSound.play();

      setTimeout(() => {
        takePhoto();
        countdownActive = false;
        frameLocked = false;
        captureDelay = false;
      }, 120);
    }
  }

  if (flashAlpha > 0) {
    ctx.fillStyle = `rgba(255,255,255, ${flashAlpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    flashAlpha = Math.max(0, flashAlpha - 0.08);
  }
});

// Start camera
function startCamera() {
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
        setDefaultFrame(); // a frame exists from a very first moment

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
}

// the frame
let frameBox = { x: 0, y: 0, width: 0, height: 0 };

function setDefaultFrame() {
  const w = canvas.width * 0.5;
  const h = w * 0.75;
  frameBox = {
    width: w,
    height: h,
    x: (canvas.width - w) / 2,
    y: (canvas.height - h) / 2,
  };
}

function clampFrame() {
  frameBox.width = Math.min(frameBox.width, canvas.width);
  frameBox.height = Math.min(frameBox.height, canvas.height);
  frameBox.x = Math.max(0, Math.min(frameBox.x, canvas.width - frameBox.width));
  frameBox.y = Math.max(
    0,
    Math.min(frameBox.y, canvas.height - frameBox.height),
  );
}

function drawFrame() {
  if (frameBox.width < 20 || frameBox.height < 20) return;
  if (!usingCustomFrame && !countdownActive) return;

  ctx.save();
  ctx.strokeStyle = "white";
  ctx.lineWidth = 3;
  ctx.strokeRect(frameBox.x, frameBox.y, frameBox.width, frameBox.height);
  ctx.restore();
}

// gestures
function detectGestures(handsList) {
  if (countdownActive) return;

  // one hand
  if (handsList.length === 1) {
    if (isOpenPalm(handsList[0])) {
      // open palm on its own, shoot the frame currently on screen
      startCountdown();
    } else {
      // any other single-hand pose clears a custom frame
      usingCustomFrame = false;
      setDefaultFrame();
    }
    return;
  }

  // two hands
  const palm1 = isOpenPalm(handsList[0]);
  const palm2 = isOpenPalm(handsList[1]);

  if (palm1 || palm2) {
    startCountdown();
    return;
  }

  // both hands pointing, size the frame between the index fingertips
  const p1 = handsList[0][8];
  const p2 = handsList[1][8];

  const x1 = (1 - p1.x) * canvas.width;
  const y1 = p1.y * canvas.height;
  const x2 = (1 - p2.x) * canvas.width;
  const y2 = p2.y * canvas.height;

  const width = Math.max(80, Math.abs(x1 - x2) * 1.4);
  const height = Math.max(80, Math.abs(y1 - y2) * 1.2);

  frameBox.width = width;
  frameBox.height = height;
  frameBox.x = (x1 + x2) / 2 - width / 2;
  frameBox.y = (y1 + y2) / 2 - height / 2;

  clampFrame();
  usingCustomFrame = true;
}

function startCountdown() {
  if (countdownActive) return;
  clampFrame();
  frameLocked = true;
  countdownActive = true;
  countdownStart = Date.now();
}

function isOpenPalm(hand) {
  const tips = [8, 12, 16, 20];
  let extended = 0;
  for (const tip of tips) {
    if (hand[tip].y < hand[tip - 2].y) extended++;
  }
  return extended >= 3;
}

// capture
function takePhoto() {
  photoTaken = true;

  const clean = document.createElement("canvas");
  clean.width = canvas.width;
  clean.height = canvas.height;
  const cctx = clean.getContext("2d");

  cctx.save();
  cctx.translate(clean.width, 0);
  cctx.scale(-1, 1);
  cctx.drawImage(
    video,
    0,
    0,
    videoTransform.vw,
    videoTransform.vh,
    clean.width - videoTransform.offsetX - videoTransform.drawWidth,
    videoTransform.offsetY,
    videoTransform.drawWidth,
    videoTransform.drawHeight,
  );
  cctx.restore();

  const photoCanvas = document.createElement("canvas");
  photoCanvas.width = Math.round(frameBox.width);
  photoCanvas.height = Math.round(frameBox.height);

  photoCanvas
    .getContext("2d")
    .drawImage(
      clean,
      frameBox.x,
      frameBox.y,
      frameBox.width,
      frameBox.height,
      0,
      0,
      photoCanvas.width,
      photoCanvas.height,
    );

  showPreview(photoCanvas.toDataURL("image/png"));
}

function showPreview(dataUrl) {
  const overlay = document.createElement("div");
  overlay.className = "preview-overlay";

  const img = document.createElement("img");
  img.src = dataUrl;

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Save Photo";
  saveBtn.onclick = () => {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "photobooth.png";
    link.click();
  };

  const retakeBtn = document.createElement("button");
  retakeBtn.textContent = "Retake";
  retakeBtn.onclick = () => {
    overlay.remove();
    photoTaken = false;
    frameLocked = false;
    countdownActive = false;
    captureDelay = false;
    usingCustomFrame = false;
    setDefaultFrame();
  };

  const row = document.createElement("div");
  row.className = "preview-buttons";
  row.appendChild(saveBtn);
  row.appendChild(retakeBtn);

  overlay.appendChild(img);
  overlay.appendChild(row);
  document.body.appendChild(overlay);
}

//into screen

const intro = document.getElementById("intro");
const startBtn = document.getElementById("startBtn");
const helpBtn = document.getElementById("helpBtn");
const permissionNote = document.getElementById("permissionNote");

let cameraStarted = false;

startBtn.addEventListener("click", () => {
  intro.classList.add("hidden");

  if (!cameraStarted) {
    cameraStarted = true;
    startCamera();
    canvas.classList.add("live");
    startBtn.textContent = "Back to the camera";
  }
});

helpBtn.addEventListener("click", () => {
  intro.classList.remove("hidden");
});
