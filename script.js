const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// State
let processingFrame = false;
let photoTaken = false;
let lastPinchState = false;
let isAdjustingFrame = true;
let countdown = null;

// new variable
let captureDelay = false;

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
  ctx.save();

  ctx.translate(canvas.width, 0);

  // mirror horizontally
  ctx.scale(-1, 1);

  // draw mirrored video
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

  // align landmarks to same transform as video
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(drawWidth / canvas.width, drawHeight / canvas.height);

  const hasHands =
    results.multiHandLandmarks && results.multiHandLandmarks.length > 0;

  if (!photoTaken && hasHands) {
    for (const landmarks of results.multiHandLandmarks) {
      const mirrored = landmarks.map((p) => ({
        x: 1 - p.x,
        y: p.y,
        z: p.z,
      }));
      // ignore ghost frames when hand leaves
      //if (!landmarks || landmarks.length !== 21) continue;

      drawConnectors(ctx, mirrored, HAND_CONNECTIONS, {
        color: "#00FF00",
        lineWidth: 2,
      });

      drawLandmarks(ctx, mirrored, {
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

  ctx.restore();

  if (typeof drawFrame === "function") {
    drawFrame();
  }

  if (countdownActive) {
    const elapsed = Date.now() - countdownStart;
    const seconds = Math.ceil((countdownTime - elapsed) / 1000);

    ctx.fillStyle = "white";
    ctx.font = "bold 100px Arial";
    ctx.textAlign = "center";

    if (seconds > 0) {
      ctx.fillText(seconds, canvas.width / 2, canvas.height / 2);
    } else {
      ctx.save();

      // mirror same as video
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);

      // flash ONLY over the video area
      ctx.fillStyle = "white";
      ctx.globalAlpha = 0.85;
      ctx.fillRect(offsetX, offsetY, drawWidth, drawHeight);
      ctx.globalAlpha = 1;

      ctx.restore();
    }

    if (elapsed >= countdownTime && !captureDelay) {
      captureDelay = true;

      setTimeout(() => {
        takePhoto();

        countdownActive = false;
        frameLocked = false;
        captureDelay = false;
      }, 600); // give flash time to show
    }
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

/* video.onloadedmetadata = () => {
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
}; */

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

  showPreview(photoDataUrl); // added

  /*   if (typeof savePhoto === "function") {
    savePhoto(photoDataUrl);
  }

  setTimeout(() => {
    isAdjustingFrame = true;
    countdown = null;
    photoTaken = false;
  }, 3000); */
}

// preview function

function showPreview(dataUrl) {
  // overlay container
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.background = "rgba(0,0,0,0.9)";
  overlay.style.display = "flex";
  overlay.style.flexDirection = "column";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = 9999;

  // image preview
  const img = document.createElement("img");
  img.src = dataUrl;
  img.style.maxWidth = "80%";
  img.style.maxHeight = "70%";
  img.style.border = "4px solid white";
  img.style.marginBottom = "20px";

  // save button
  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Save Photo";
  saveBtn.style.fontSize = "18px";
  saveBtn.style.margin = "10px";

  saveBtn.onclick = () => {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "photobooth.png";
    link.click();
  };

  // retake button
  const retakeBtn = document.createElement("button");
  retakeBtn.textContent = "Retake";
  retakeBtn.style.fontSize = "18px";
  retakeBtn.style.margin = "10px";

  retakeBtn.onclick = () => {
    overlay.remove();
    photoTaken = false;
    frameLocked = false;
    countdownActive = false;
    captureDelay = false;
  };

  overlay.appendChild(img);
  overlay.appendChild(saveBtn);
  overlay.appendChild(retakeBtn);

  document.body.appendChild(overlay);
}

/////// up to this point everything functions
// when go live asks for the permission of the camera, camera frame pops up in hd quality
// gesture detection works

//starting on ddetecting the frame

//initialize a white rectangle
let frameBox = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
};

function drawFrame() {
  if (frameBox.width < 20 || frameBox.height < 20) return;

  ctx.strokeStyle = "white";
  ctx.lineWidth = 3;
  ctx.strokeRect(frameBox.x, frameBox.y, frameBox.width, frameBox.height);
}

// new detectGestures(hands) function
function detectGestures(hands) {
  if (!hands || hands.length < 2) {
    if (!countdownActive) {
      frameLocked = false;
      frameBox.width = 0;
      frameBox.height = 0;
    }
    return;
  }

  const palm1 = isOpenPalm(hands[0]);
  const palm2 = isOpenPalm(hands[1]);

  if (!frameLocked && (palm1 || palm2) && !countdownActive) {
    frameLocked = true;
    countdownActive = true;
    countdownStart = Date.now();
    return;
  }

  if (frameLocked) return;

  const p1 = hands[0][8];
  const p2 = hands[1][8];

  const x1 = (1 - p1.x) * canvas.width;
  const y1 = p1.y * canvas.height;

  const x2 = (1 - p2.x) * canvas.width;
  const y2 = p2.y * canvas.height;

  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;

  const distX = Math.abs(x1 - x2);
  const distY = Math.abs(y1 - y2);

  const width = Math.max(80, distX * 1.4);
  const height = Math.max(80, distY * 1.2);

  frameBox.width = width;
  frameBox.height = height;
  frameBox.x = centerX - width / 2;
  frameBox.y = centerY - height / 2;
}

/// up to this point eveyrhting works
// the frame works and is only visible when you use two of your hands
// you can adjust the frame by dragging your fingers

let frameLocked = false;
let countdownActive = false;
let countdownStart = 0;
const countdownTime = 3000;

function isOpenPalm(hand) {
  const tips = [8, 12, 16, 20];
  let extended = 0;

  for (let tip of tips) {
    if (hand[tip].y < hand[tip - 2].y) extended++;
  }

  return extended >= 3;
}
