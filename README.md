# Gesture Photo Booth

A photo booth you operate with your hands. No buttons, no timer to set. Hold up an open
palm and the camera counts you down and takes the shot. Hold up two index fingers and you
can drag out a frame of any size, then open your palms to capture exactly that crop.

Everything runs in the browser. No server, no upload, no account, and the video never leaves
your machine.


## Contents

- [What it does](#what-it-does)
- [How it's implemented](#how-its-implemented)
  - [Hand tracking](#hand-tracking)
  - [Gestures](#gestures)
  - [The frame](#the-frame)
  - [Capturing a clean photo](#capturing-a-clean-photo)
- [Files](#files)
- [Running it](#running-it)
- [Known issues and limitations](#known-issues-and-limitations)
- [Possible extensions](#possible-extensions)
- [Credits](#credits)


## What it does

| gesture | result |
|---|---|
| one open palm | countdown, then shoot the frame currently on screen |
| two index fingers | drag out a custom frame between your fingertips |
| two open palms | countdown, then shoot the custom frame you just made |
| a closed hand | clears the custom frame, back to the default |

Once a gesture is recognised, a three second countdown appears, the hand tracking overlay
disappears so it can't end up in the shot, and the capture fires with a white flash and a
shutter sound. You then get a full-screen preview with **Save** and **Retake**.


## How it's implemented

### Hand tracking

Uses [MediaPipe Hands](https://developers.google.com/mediapipe), loaded from a CDN. It
finds **21 landmarks per hand** — knuckles, joints and fingertips — on up to two hands, at
roughly 30 frames a second. Every landmark comes back as a normalised x/y coordinate, so
nothing depends on the camera's resolution.

`modelComplexity` is set to `0`, the lighter of the two models. Accuracy drops slightly;
the frame rate stays smooth, which matters far more for something you interact with live.

The camera is drawn to a `<canvas>` rather than shown directly, because the canvas is what
lets the app overlay a frame, a countdown and a flash, then crop out a photo. The raw
`<video>` element is hidden with CSS — it exists only as a source for the canvas.

Everything is drawn **mirrored**, so moving your hand right moves it right on screen. The
landmark coordinates get mirrored to match (`x: 1 - p.x`).

### Gestures

`isOpenPalm()` is deliberately simple: for each of the four fingertips, check whether it
sits higher on screen than the joint two landmarks down. Three or more extended means an
open palm. One extended means pointing.

That's a heuristic, not a classifier — no gesture model, no training data. It works because
the gestures were chosen to be far apart from each other.

### The frame

A white rectangle is always on screen, and it is exactly what gets saved. Two modes:

- **Default** — a centered box at 50% of the camera width
- **Custom** — the midpoint and gap between your two index fingertips become the centre and
  size of the box, so moving your hands apart widens the shot

`clampFrame()` keeps it inside the canvas, otherwise cropping past the edge would put black
bars in the photo.

### Capturing a clean photo

The visible canvas has the hand skeleton, the frame outline and the countdown painted onto
it. Cropping the photo from that canvas would bake all of it into the image.

So `takePhoto()` builds a second, throwaway canvas, re-renders the camera frame onto it with
the same mirroring and scaling, and crops from there. The result is just the photo.

The landmarks are also hidden on screen as soon as the countdown starts, so the last three
seconds before the shot look clean too.


## Files

| file | role |
|---|---|
| `index.html` | Markup: the video, the canvas, the intro screen and the gesture guide |
| `script.js` | Everything — tracking, gestures, framing, capture, preview, intro logic |
| `style.css` | All styling |
| `freesound_community-iphone-camera-capture-6448.mp3` | Shutter sound |

No build step, no dependencies to install. MediaPipe loads from a CDN at runtime.


## Running it

**It needs HTTPS or localhost.** Browsers refuse camera access on plain `http://`, so
double-clicking the HTML file won't work.

**Locally** — with the Live Server extension in VS Code, or:

```bash
python3 -m http.server 5500
```

then open `http://localhost:5500`.

**Hosted** — GitHub Pages serves over HTTPS, so enabling it on this repo gives a working
public demo.

The browser asks for camera permission on the first visit. After you allow it once, Chrome
remembers and stops asking — reset it via the camera icon in the address bar if you want to
see the prompt again.


## Known issues and limitations

**Palm detection is a heuristic.** `isOpenPalm()` compares fingertip height against the
joint below it, which assumes a roughly upright hand. Tilt your hand sideways and it
misreads.

**A single palm can fire while you're framing.** Three of four fingers extended counts as a
palm, so if one hand drops out of view mid-frame the other can trigger a countdown you
didn't mean. A short hold-to-confirm would fix it.

**No hold requirement.** The countdown starts the instant a gesture is recognised, with no
grace period.

**The preview is upscaled.** The default frame captures about 640×540 real pixels but
displays much larger, so it looks slightly soft. Raising the default frame size in
`setDefaultFrame()` improves this at the cost of a wider crop.

**Requires an internet connection** even though nothing is uploaded — MediaPipe's model
files come from a CDN at page load.

**Lighting matters a lot.** Hand tracking degrades badly in dim rooms. Busy backgrounds hurt
too.

**Desktop-oriented.** It works on mobile but the layout and the two-handed framing gesture
assume a larger screen and a fixed camera.


## Possible extensions

- Hold-to-confirm before the countdown, to stop accidental triggers
- More gestures — a peace sign for burst mode, a thumbs up to save without the preview
- Filters applied to the capture canvas
- A strip of several shots, like a real photo booth
- Remember the last custom frame between sessions
- Download the MediaPipe model files locally so it works offline


## Credits

Built by Mariia Palamarchuk.

Hand tracking by [MediaPipe Hands](https://developers.google.com/mediapipe). Shutter sound
from [Freesound](https://freesound.org). 
