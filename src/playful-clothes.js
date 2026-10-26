import { planDropFlight, sampleFlightPath, fitFlightPath } from "./flight-path.js";

const garments = [
  { id: "sneaker", label: "playSneaker" },
  { id: "backpack", label: "playBackpack" },
  { id: "high-top", label: "playHighTop" },
  { id: "sand-pair", label: "playSandPair" },
  { id: "mint-pair", label: "playMintPair" },
];
const collectedGarments = new Set();

export function clothingMarkup(t) {
  return `<div class="playful-clothes" role="group" aria-label="${t("playClothes")}">
    ${garments.map(({ id, label }) => `<button type="button" class="clothing-toy clothing-toy--${id}" data-action="play-clothing" data-garment="${id}" aria-label="${t(label)}" title="${t(label)}" ${collectedGarments.has(id) ? "hidden" : ""}><img src="assets/playful/${id}-v1.png" alt="" width="160" height="160" draggable="false" decoding="async" /></button>`).join("")}
    <p class="clothing-hint" ${collectedGarments.size === garments.length ? "hidden" : ""}>${t("playHint")} <span aria-hidden="true">↗</span></p>
  </div>`;
}

let activeFlight = null;
const waitingButtons = [];

export function syncClothingState() {
  document.querySelector(".hero-basket")?.classList.toggle("is-stowed", collectedGarments.size === garments.length);
}

function restoreFlight(flight) {
  flight.events.abort();
  flight.animations.forEach((animation) => animation.cancel());
  flight.layer.remove();
  flight.button.classList.remove("is-playing");
  delete flight.button.dataset.flightState;
  flight.basket.classList.remove("is-catching");
  syncClothingState();
  if (activeFlight === flight) activeFlight = null;
}

export function cancelClothingAnimations() {
  waitingButtons.splice(0).forEach((button) => {
    delete button.dataset.flightState;
  });
  if (activeFlight) {
    activeFlight.cancelled = true;
    restoreFlight(activeFlight);
  }
}

export function resetClothingAnimations() {
  cancelClothingAnimations();
  collectedGarments.clear();
  document.querySelectorAll(".clothing-toy, .clothing-hint").forEach(element => {
    element.hidden = false;
  });
  syncClothingState();
}

// Collected artwork belongs to this visit, not to saved shop/cart state.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) resetClothingAnimations();
});
window.addEventListener("pageshow", event => {
  if (event.persisted) resetClothingAnimations();
});

function collectGarment(flight) {
  if (flight.cancelled) return;
  const button = flight.button;
  const hadFocus = document.activeElement === button;
  collectedGarments.add(button.dataset.garment);
  button.hidden = true;
  if (hadFocus) {
    const hero = button.closest(".hero");
    (hero.querySelector(".clothing-toy:not([hidden])") || hero.querySelector(".search-form input"))?.focus({preventScroll:true});
  }
  const hint = button.closest(".playful-clothes").querySelector(".clothing-hint");
  hint.hidden = collectedGarments.size === garments.length;
}

// Copies live in the hero's coordinate system, so scrolling the page does not
// require a fixed-position overlay and the real buttons keep keyboard focus.
function flightCopy(image, className, layer, heroBounds) {
  const bounds = image.getBoundingClientRect();
  const copy = image.cloneNode(false);
  copy.className = className;
  copy.alt = "";
  copy.removeAttribute("fetchpriority");
  Object.assign(copy.style, {
    left: `${bounds.left + bounds.width / 2 - heroBounds.left - image.offsetWidth / 2}px`,
    top: `${bounds.top + bounds.height / 2 - heroBounds.top - image.offsetHeight / 2}px`,
    width: `${image.offsetWidth}px`,
    height: `${image.offsetHeight}px`,
  });
  layer.append(copy);
  return copy;
}

function flightScale(route, at, catchDistance) {
  return 1-.985*Math.max(0,1-(route.length-at)/catchDistance);
}

function flightFrames(route, start, initialRotation, basketWidth, catchDistance) {
  const loop = route.loop && {from:route.lengths[route.loop.start], to:route.lengths[route.loop.end], turn:route.loop.turn};
  return Array.from({length:241}, (_, index) => {
    const progress = index/240, at = progress*route.length;
    const point = sampleFlightPath(route, at);
    const dropStart = route.length-catchDistance;
    const launch = Math.min(1, progress/.12);
    const dive = Math.max(0, (at-dropStart)/(route.length-dropStart));
    const scale = flightScale(route,at,catchDistance);
    const tilt = Math.max(-16, Math.min(16, Math.cos(point.angle*Math.PI/180)*16));
    // The artwork turns once with the loop, like a plane, and is upright again after it.
    const spin = loop ? loop.turn*360*Math.max(0, Math.min(1, (at-loop.from)/(loop.to-loop.from))) : 0;
    return {
      offset:progress, translate:`${point.x-start.x}px ${point.y-start.y}px`,
      scale, rotate:`${initialRotation*(1-launch)+tilt*launch*(1-dive)+spin}deg`,
      opacity:Math.min(1, (route.length-at)/Math.max(1,basketWidth*.18)),
    };
  });
}

function cometAnimations(route, layer, animate, options, image, catchDistance) {
  const size = Math.min(image.offsetWidth,image.offsetHeight);
  const length = size*.65, baseWidth = size*.6;
  const samples = route.loop ? 240 : 160;
  return Array.from({length:9}, (_, index) => {
    const segment = document.createElement("span");
    segment.className = "clothing-comet-segment";
    const lag = (index+1)*length/9, width = length/9*2.6;
    const height = baseWidth*Math.pow(1-index/9,1.25);
    Object.assign(segment.style, {width:`${width}px`, height:`${height}px`, boxShadow:`0 0 ${size*.07}px #3185ff65`});
    layer.prepend(segment);
    let angle = 0;
    const frames = Array.from({length:samples+1}, (_, frame) => {
      const progress = frame/samples, head = progress*route.length;
      const scale = flightScale(route,head,catchDistance);
      // Attach the broad base just behind the artwork, then follow its turns.
      const point = sampleFlightPath(route, head-(size*.25+lag)*scale);
      let nextAngle = point.angle;
      while (nextAngle-angle > 180) nextAngle -= 360;
      while (nextAngle-angle < -180) nextAngle += 360;
      angle = nextAngle;
      return {
        offset:progress, translate:`${point.x-width/2}px ${point.y-height/2}px`,
        rotate:`${angle}deg`, scale,
        opacity:head < lag ? 0 : (1-index/10)*.8*Math.min(1,(route.length-head)/20),
      };
    });
    return animate(segment, frames, options);
  });
}

async function flyToBasket(button) {
  const hero = button.closest(".hero");
  const image = button.querySelector("img");
  const basket = hero?.querySelector(".hero-basket");
  if (!image || !basket || !button.isConnected) return;

  const heroBounds = hero.getBoundingClientRect();
  const sourceBounds = image.getBoundingClientRect();
  const basketBounds = basket.getBoundingClientRect();
  const layer = document.createElement("div");
  layer.className = "clothing-flight-layer";
  layer.setAttribute("aria-hidden", "true");
  hero.append(layer);
  const itemCopy = flightCopy(image, "clothing-flight-item", layer, heroBounds);
  const basketCopy = flightCopy(basket, "clothing-flight-basket", layer, heroBounds);
  const rotation = getComputedStyle(button).rotate;
  const initialRotation = rotation === "none" ? "0deg" : rotation;
  itemCopy.style.rotate = initialRotation;

  const flight = {
    button, basket, layer, animations: [], events: new AbortController(),
    cancelled: false,
  };
  activeFlight = flight;
  button.dataset.flightState = "active";
  button.classList.add("is-playing");
  basket.classList.add("is-catching");
  const signal = flight.events.signal;
  // Layout changes invalidate the measured destination. Restore everything
  // immediately instead of leaving an item hidden or flying to stale coordinates.
  window.addEventListener("resize", cancelClothingAnimations, { signal });
  window.addEventListener("scroll", cancelClothingAnimations, {
    signal, capture: true, passive: true,
  });
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  motionPreference.addEventListener("change", cancelClothingAnimations, { signal });

  const animate = (element, frames, options) => {
    const animation = element.animate(frames, { fill: "both", ...options });
    flight.animations.push(animation);
    return animation;
  };

  try {
    if (motionPreference.matches) {
      // Preserve the shared feedback without travel, shrinking or rotation.
      const frames = [{ opacity: 1 }, { opacity: 0.4 }, { opacity: 1 }];
      await Promise.all([
        animate(itemCopy, [{opacity:1},{opacity:0}], { duration: 240 }).finished,
        animate(basketCopy, frames, { duration: 240 }).finished,
      ]);
      collectGarment(flight);
    } else {
      const start = {x:sourceBounds.left+sourceBounds.width/2-heroBounds.left, y:sourceBounds.top+sourceBounds.height/2-heroBounds.top};
      const basketCentre = {x:basketBounds.left+basketBounds.width/2-heroBounds.left, y:basketBounds.top+basketBounds.height/2-heroBounds.top};
      const diameter = Math.hypot(image.offsetWidth,image.offsetHeight);
      const catchDistance = Math.max(basketBounds.width*.76,diameter*.7);
      // The basket stays upright; every item drops into its opening from above.
      // Items starting below the basket fly a loop first, sized to fit the hero.
      const planned = planDropFlight({
        start, basket:{x:basketCentre.x, y:basketCentre.y, width:basketBounds.width},
        width:heroBounds.width, height:heroBounds.height, pad:diameter/2+1,
        catchDistance, loopRadius:Math.max(diameter*.75, basketBounds.width),
      });
      // Include the maximum flight tilt in the footprint, without changing scale.
      const angle = Math.max(16,Math.abs(parseFloat(initialRotation)||0))*Math.PI/180;
      const halfWidth = (image.offsetWidth*Math.cos(angle)+image.offsetHeight*Math.sin(angle))/2;
      const halfHeight = (image.offsetHeight*Math.cos(angle)+image.offsetWidth*Math.sin(angle))/2;
      const route = fitFlightPath(planned,{width:heroBounds.width,height:heroBounds.height,halfWidth,halfHeight,catchDistance});
      // Every item reaches the basket in the same time, whatever its route length.
      const duration = 1500;
      const delay = 0, landing = duration;
      const glowEnd = landing+300, total = glowEnd;
      // Highlight the existing rim pixels rather than lighting the whole basket.
      const rimCopy = flightCopy(basket,"clothing-flight-rim",layer,heroBounds);
      const rimLight = animate(rimCopy,[
        {opacity:0,offset:0},
        {opacity:0,offset:Math.max(0,landing-80)/total},
        {opacity:.85,offset:(landing+30)/total},
        {opacity:0,offset:1},
      ],{duration:total,easing:"linear"});
      const options = {delay, duration, easing:"linear"};
      const itemAnimation = animate(itemCopy, flightFrames(route,start,parseFloat(initialRotation)||0,basketBounds.width,catchDistance), options);
      const tail = cometAnimations(route,layer,animate,options,image,catchDistance);
      await Promise.all([
        itemAnimation.finished.then(() => collectGarment(flight)),
        ...[rimLight,...tail].map(animation => animation.finished),
      ]);
    }
    if (!flight.cancelled && collectedGarments.size === garments.length) {
      // Return to the actual logo image so the letter B can occlude the basket.
      layer.dataset.phase = "stowing";
      basketCopy.hidden = true;
      layer.querySelector(".clothing-flight-rim")?.setAttribute("hidden", "");
      basket.classList.remove("is-catching");
      const frames = motionPreference.matches
        ? [{opacity:1},{opacity:0}]
        : [
          // The artwork is rotated upright, so its local bottom edge faces the B.
          {translate:"0px 0px",clipPath:"inset(0 0 0% 0)"},
          {translate:`${basketBounds.width*1.2}px 0px`,clipPath:"inset(0 0 100% 0)"},
        ];
      await animate(basket,frames,{
        duration:motionPreference.matches ? 180 : 900,
        easing:"cubic-bezier(.4,0,.2,1)",
      }).finished;
    }
  } catch (error) {
    // Cancellation rejects Animation.finished; other errors still reach the
    // console after the finally block has restored the real artwork.
    if (error.name !== "AbortError") console.error(error);
  } finally {
    if (!flight.cancelled) {
      restoreFlight(flight);
      const next = waitingButtons.shift();
      if (next) void flyToBasket(next);
    }
  }
}

export function animateClothing(button) {
  if (!garments.some(({ id }) => id === button.dataset.garment)
    || button.hidden || collectedGarments.has(button.dataset.garment) || button.dataset.flightState) return;
  if (activeFlight) {
    button.dataset.flightState = "queued";
    waitingButtons.push(button);
  } else {
    void flyToBasket(button);
  }
}
