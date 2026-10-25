import * as React from "react"
import { Link } from "react-router-dom"
import { ArrowRight } from "./icons"

/*
 * Aperture Carousel — a full-bleed image carousel where the next picture opens
 * through a circular iris that grows from wherever you click, with a hairline
 * ring riding its edge. Titles rise out of a mask, a hairline fills toward the
 * next slide, and the cursor becomes a small "Next / Prev" lens.
 *
 * Click the right half for next, the left half for previous, swipe, or use the
 * arrow keys. Slides without an `image` get a painted landscape, so it works
 * with no assets at all.
 */

export type LandPalette = "dawn" | "alpine" | "dusk" | "mist"

export type Slide = {
  image?: string
  /** Small box above the title, e.g. the destination. */
  eyebrow?: string
  title?: string
  caption?: string
  /** Rounded boxes under the title, e.g. duration and price. */
  meta?: string[]
  cta?: { label: string; href: string }
  alt?: string
  /** Palette and seed of the painted landscape used when `image` is empty. */
  palette?: LandPalette
  seed?: number
}

export type ApertureCarouselProps = {
  slides?: Slide[]
  /** Any CSS length. Default 100svh. */
  height?: number | string
  /** ms between advances, iris included; 0 turns autoplay off. */
  autoplay?: number
  /** ms for the iris to open. */
  duration?: number
  /** Colour of the ring, counter, cursor lens and text. */
  ink?: string
  /** Hide the custom "Next / Prev" cursor lens. */
  plainCursor?: boolean
  /** Clear a fixed bottom navigation dock on small screens. */
  reserveMobileDock?: boolean
  onChange?: (index: number) => void
  className?: string
  style?: React.CSSProperties
  ariaLabel?: string
}

// #region logic
/** Radius that covers a w×h box from (x, y): the distance to the farthest corner. */
export function coverRadius(x: number, y: number, w: number, h: number): number {
  return Math.hypot(Math.max(x, w - x), Math.max(y, h - y))
}

export function wrap(i: number, n: number): number {
  return n ? ((i % n) + n) % n : 0
}

/** +1 for the right half, -1 for the left. */
export function sideOf(x: number, w: number): 1 | -1 {
  return x >= w / 2 ? 1 : -1
}
// #endregion logic

/* ------------------------------------------------------- painted images */

const PALETTES: Record<LandPalette, { top: string; bottom: string; sun: string; far: string; near: string; mist: string }> = {
  dawn: { top: "#e7b7a5", bottom: "#f8e8d6", sun: "#fff4df", far: "#d2b2bb", near: "#3a2a3b", mist: "255,240,232" },
  alpine: { top: "#7ea5c8", bottom: "#e3ecf2", sun: "#ffffff", far: "#a9bfd0", near: "#1c3044", mist: "236,244,250" },
  dusk: { top: "#2a2450", bottom: "#ef8d60", sun: "#ffd9a6", far: "#93607c", near: "#18121f", mist: "255,196,160" },
  mist: { top: "#c4d0cb", bottom: "#eef1ec", sun: "#ffffff", far: "#aebcb5", near: "#2c3a33", mist: "246,248,245" },
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hexRgb(h: string): [number, number, number] {
  const v = parseInt(h.replace("#", ""), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}
function mixRgb(a: string, b: string, t: number): string {
  const A = hexRgb(a)
  const B = hexRgb(b)
  return "rgb(" + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",") + ")"
}

// A layered-ridge landscape: sky, a low sun, five ridges fading into haze with
// mist between them, a tree line on the nearest, film grain. Painted once.
function paintLandscape(seed: number, palette: LandPalette, w = 1600, h = 1000): string {
  if (typeof document === "undefined") return ""
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  const g = c.getContext("2d")
  if (!g) return ""
  const P = PALETTES[palette] ?? PALETTES.dawn
  const r = mulberry32(seed * 104729 + 7)

  const sky = g.createLinearGradient(0, 0, 0, h * 0.72)
  sky.addColorStop(0, P.top)
  sky.addColorStop(1, P.bottom)
  g.fillStyle = sky
  g.fillRect(0, 0, w, h)
  const sx = w * (0.22 + r() * 0.56)
  const sy = h * (0.26 + r() * 0.16)
  const halo = g.createRadialGradient(sx, sy, 0, sx, sy, w * 0.45)
  halo.addColorStop(0, "rgba(" + hexRgb(P.sun).join(",") + ",.85)")
  halo.addColorStop(0.08, "rgba(" + hexRgb(P.sun).join(",") + ",.55)")
  halo.addColorStop(1, "rgba(" + hexRgb(P.sun).join(",") + ",0)")
  g.fillStyle = halo
  g.fillRect(0, 0, w, h)
  g.fillStyle = P.sun
  g.beginPath()
  g.arc(sx, sy, h * 0.045, 0, Math.PI * 2)
  g.fill()

  const layers = 5
  for (let L = 0; L < layers; L++) {
    const k = L / (layers - 1)
    const base = h * (0.42 + k * 0.4)
    const amp = h * (0.07 + k * 0.1)
    const ph = [r(), r(), r(), r()].map((v) => v * Math.PI * 2)
    const fr = [1.3 + r(), 3.1 + r() * 2, 7 + r() * 4, 17 + r() * 8]
    const ridge = (x: number) => {
      const u = x / w
      return (
        base -
        amp *
          (0.55 * Math.sin(u * fr[0] + ph[0]) +
            0.28 * Math.sin(u * fr[1] + ph[1]) +
            0.12 * Math.abs(Math.sin(u * fr[2] + ph[2])) +
            0.05 * Math.sin(u * fr[3] + ph[3]))
      )
    }
    const mist = g.createLinearGradient(0, base - amp * 1.4, 0, base + amp * 0.4)
    mist.addColorStop(0, "rgba(" + P.mist + ",0)")
    mist.addColorStop(1, "rgba(" + P.mist + "," + (0.55 - k * 0.35).toFixed(2) + ")")
    g.fillStyle = mist
    g.fillRect(0, base - amp * 1.4, w, amp * 1.8)
    const body = g.createLinearGradient(0, base - amp, 0, h)
    body.addColorStop(0, mixRgb(P.far, P.near, Math.pow(k, 1.3)))
    body.addColorStop(1, mixRgb(P.far, P.near, Math.min(1, Math.pow(k, 1.3) + 0.18)))
    g.fillStyle = body
    g.beginPath()
    g.moveTo(0, h)
    for (let x = 0; x <= w; x += 6) g.lineTo(x, ridge(x))
    g.lineTo(w, h)
    g.closePath()
    g.fill()
    if (L >= layers - 2) {
      g.fillStyle = mixRgb(P.far, P.near, Math.min(1, Math.pow(k, 1.3) + 0.08))
      for (let x = 0; x < w; x += 7 + r() * 9) {
        if (r() < 0.35) continue
        const y = ridge(x) + 2
        const th = h * (0.025 + r() * 0.035) * (0.6 + k)
        const tw = th * 0.32
        g.beginPath()
        g.moveTo(x, y - th)
        g.lineTo(x + tw, y)
        g.lineTo(x - tw, y)
        g.closePath()
        g.fill()
      }
    }
  }

  const vig = g.createRadialGradient(w / 2, h * 0.45, h * 0.3, w / 2, h / 2, w * 0.78)
  vig.addColorStop(0, "rgba(0,0,0,0)")
  vig.addColorStop(1, "rgba(0,0,0,.32)")
  g.fillStyle = vig
  g.fillRect(0, 0, w, h)
  const grain = g.getImageData(0, 0, w, h)
  const d = grain.data
  for (let i = 0; i < d.length; i += 4) {
    const v = (r() - 0.5) * 14
    d[i] += v
    d[i + 1] += v
    d[i + 2] += v
  }
  g.putImageData(grain, 0, 0)
  return c.toDataURL("image/jpeg", 0.88)
}

const DEFAULT_SLIDES: Slide[] = [
  { title: "First Light", caption: "Haze lifting off the eastern ridges.", palette: "dawn", seed: 3 },
  { title: "High Pass", caption: "Cold air, clear to the far range.", palette: "alpine", seed: 8 },
  { title: "Ember Hour", caption: "The last of the sun on the valley floor.", palette: "dusk", seed: 14 },
  { title: "Still Valley", caption: "Morning mist that never quite lifts.", palette: "mist", seed: 21 },
  { title: "Rose Ridge", caption: "Five ridges, one long exhale.", palette: "dawn", seed: 34 },
  { title: "Blue Hour", caption: "Pines going dark against the snow.", palette: "alpine", seed: 55 },
]

// Every slide as an image URL; slides without one are painted after mount.
function useSlideImages(slides: Slide[]): string[] {
  const key = slides.map((s) => s.image || (s.palette || "dawn") + ":" + (s.seed ?? 1)).join("|")
  const [painted, setPainted] = React.useState(() => slides.map(() => ""))
  React.useEffect(() => {
    setPainted(slides.map((s, i) => (s.image ? "" : paintLandscape(s.seed ?? i + 1, s.palette || "dawn"))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return slides.map((s, i) => s.image || painted[i] || "")
}

const AP_CSS = [
  ".ap-root{--ap-bottom:0px;position:relative;width:100%;overflow:hidden;background:#0d0d0f;color:var(--ap-ink);user-select:none;-webkit-user-select:none;touch-action:pan-y;outline:none}",
  ".ap-root:focus-visible{box-shadow:inset 0 0 0 2px var(--ap-ink)}",
  "@media (hover:hover) and (pointer:fine){.ap-root[data-lens='1']{cursor:none}}",
  ".ap-layer{position:absolute;inset:0;overflow:hidden}",
  ".ap-img{position:absolute;inset:0;width:100%;height:100%;max-width:none;object-fit:cover;display:block;pointer-events:none}",
  ".ap-ring{position:absolute;left:0;top:0;border-radius:50%;border:1px solid var(--ap-ink);pointer-events:none;opacity:0}",
  ".ap-shade{position:absolute;inset:auto 0 0 0;height:45%;background:linear-gradient(to top,rgba(0,0,0,.55),rgba(0,0,0,0));pointer-events:none}",
  ".ap-top{position:absolute;inset:0 0 auto 0;height:clamp(120px,20vh,200px);background:linear-gradient(180deg,rgba(4,5,9,.72),rgba(4,5,9,.26) 46%,rgba(4,5,9,0));pointer-events:none}",
  "html.light .ap-top{background:linear-gradient(180deg,hsl(var(--background) / .9),hsl(var(--background) / .32) 46%,hsl(var(--background) / 0))}",
  ".ap-text{position:absolute;left:clamp(20px,4vw,56px);bottom:calc(clamp(40px,7vh,72px) + var(--ap-bottom));right:clamp(20px,4vw,56px);pointer-events:none}",
  ".ap-line{display:block;overflow:hidden}",
  ".ap-line>span{display:block;animation:ap-rise .9s cubic-bezier(.2,.8,.2,1) both}",
  ".ap-title{font:500 clamp(34px,6vw,84px)/1 ui-serif,Georgia,'Times New Roman',serif;letter-spacing:-.02em}",
  ".ap-title.is-bengali{font-family:'SolaimanLipi','Noto Sans Bengali','Nirmala UI','Hind Siliguri',serif;font-weight:400;line-height:1.15;letter-spacing:0}",
  ".ap-cap{margin-top:12px;font:400 14px/1.4 ui-sans-serif,system-ui,sans-serif;opacity:.8;max-width:42ch}",
  ".ap-cap.is-bengali{font-family:'SolaimanLipi','Noto Sans Bengali','Nirmala UI',sans-serif;font-size:15px;line-height:1.5}",
  ".ap-cap>span{animation-delay:.08s}",
  ".ap-kicker-line{display:block;margin-bottom:14px;animation:ap-rise-soft .8s cubic-bezier(.2,.8,.2,1) both}",
  ".ap-kicker{display:inline-flex;align-items:center;max-width:100%;padding:4px 9px;border-radius:8px;border:1px solid rgba(255,255,255,.32);background:rgba(255,255,255,.16);box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 1px 2px rgba(0,0,0,.16);backdrop-filter:blur(16px) saturate(160%);-webkit-backdrop-filter:blur(16px) saturate(160%);font:500 10.5px/1.25 ui-sans-serif,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--ap-ink)}",
  ".ap-kicker.is-bengali{font-family:'SolaimanLipi','Noto Sans Bengali','Nirmala UI',sans-serif;font-size:12px;letter-spacing:0;text-transform:none}",
  ".ap-meta-line{display:block;margin-top:16px;animation:ap-rise-soft .8s cubic-bezier(.2,.8,.2,1) both;animation-delay:.1s}",
  ".ap-meta{display:flex;flex-wrap:wrap;gap:8px}",
  ".ap-chip{display:inline-flex;align-items:center;padding:7px 11px;border-radius:10px;border:1px solid rgba(255,255,255,.32);background:rgba(255,255,255,.16);box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 1px 2px rgba(0,0,0,.16);backdrop-filter:blur(16px) saturate(160%);-webkit-backdrop-filter:blur(16px) saturate(160%);font:500 12.5px/1 ui-sans-serif,system-ui,sans-serif;color:var(--ap-ink)}",
  ".ap-chip.is-bengali{font-family:'SolaimanLipi','Noto Sans Bengali','Nirmala UI',sans-serif;font-size:13.5px;letter-spacing:0}",
  ".ap-cta-line{display:flex;margin-top:16px;animation:ap-rise-soft .8s cubic-bezier(.2,.8,.2,1) both;animation-delay:.16s}",
  ".ap-cta{display:inline-flex;align-items:center;gap:9px;height:42px;padding:0 16px;border-radius:10px;border:1px solid rgba(255,255,255,.4);background:rgba(255,255,255,.2);box-shadow:inset 0 1px 0 rgba(255,255,255,.32),0 1px 2px rgba(0,0,0,.18);backdrop-filter:blur(16px) saturate(160%);-webkit-backdrop-filter:blur(16px) saturate(160%);color:var(--ap-ink);font:600 13px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.01em;text-decoration:none;pointer-events:auto;cursor:pointer;transition:background-color .2s ease,transform .2s ease}",
  ".ap-cta:hover{background:rgba(255,255,255,.32);transform:translateY(-1px)}",
  ".ap-cta:focus-visible{outline:none;box-shadow:0 0 0 2px rgba(0,0,0,.45),0 0 0 4px var(--ap-ink)}",
  "@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.ap-kicker,.ap-chip{background:rgba(10,12,18,.52)}.ap-cta{background:rgba(10,12,18,.58)}}",
  ".ap-cta svg{width:14px;height:14px;flex:none}",
  ".ap-cta.is-bengali{font-family:'SolaimanLipi','Noto Sans Bengali','Nirmala UI',sans-serif;font-size:14px;letter-spacing:0}",
  ".ap-track{position:absolute;left:clamp(20px,4vw,56px);right:clamp(20px,4vw,56px);bottom:calc(clamp(20px,3.5vh,36px) + var(--ap-bottom));height:1px;background:color-mix(in srgb,var(--ap-ink) 28%,transparent);pointer-events:none}",
  ".ap-fill{height:100%;background:var(--ap-ink);transform-origin:left;transform:scaleX(0)}",
  ".ap-fill[data-run='1']{animation:ap-fill var(--ap-dur) linear forwards}",
  ".ap-root[data-paused='1'] .ap-fill{animation-play-state:paused}",
  ".ap-lens{position:absolute;left:0;top:0;width:76px;height:76px;margin:-38px 0 0 -38px;border-radius:50%;border:1px solid var(--ap-ink);display:grid;place-items:center;font:500 11px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;pointer-events:none;opacity:0;transition:opacity .25s ease;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}",
  ".ap-lens[data-on='1']{opacity:1}",
  ".ap-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}",
  "@keyframes ap-rise{from{transform:translateY(105%)}to{transform:none}}",
  "@keyframes ap-rise-soft{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}",
  "@keyframes ap-fill{to{transform:scaleX(1)}}",
  "@media (max-width:767px){.ap-root[data-dock='1']{--ap-bottom:calc(4.75rem + env(safe-area-inset-bottom,0px))}.ap-kicker-line{margin-bottom:10px}.ap-kicker{padding:3px 8px;font-size:10px}.ap-kicker.is-bengali{font-size:11.5px}.ap-meta-line,.ap-cta-line{margin-top:12px}.ap-chip{padding:6px 9px;font-size:11.5px}.ap-chip.is-bengali{font-size:12.5px}.ap-cta{height:38px;padding:0 13px;font-size:12px}.ap-cta.is-bengali{font-size:13px}}",
  "@media (prefers-reduced-motion:reduce){.ap-line>span,.ap-kicker-line,.ap-meta-line,.ap-cta-line{animation:none}}",
].join("\n")

type Incoming = { to: number; x: number; y: number; id: number }

function isBengali(text?: string) {
  return !!text && /[\u0980-\u09FF]/.test(text)
}

export default function ApertureCarousel({
  slides = DEFAULT_SLIDES,
  height = "100svh",
  autoplay = 6000,
  duration = 1100,
  ink = "#ffffff",
  plainCursor = false,
  reserveMobileDock = false,
  onChange,
  className,
  style,
  ariaLabel = "Image carousel",
}: ApertureCarouselProps) {
  const n = slides.length
  const srcs = useSlideImages(slides)
  const [index, setIndex] = React.useState(0)
  const [incoming, setIncoming] = React.useState<Incoming | null>(null)
  const [paused, setPaused] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const layerRef = React.useRef<HTMLDivElement | null>(null)
  const ringRef = React.useRef<HTMLDivElement | null>(null)
  const lensRef = React.useRef<HTMLDivElement | null>(null)
  const busy = React.useRef(false)
  const down = React.useRef<{ x: number; y: number } | null>(null)
  const [lensOn, setLensOn] = React.useState(false)
  const [lensLabel, setLensLabel] = React.useState("Next")
  // An auto-advancing hero contradicts an explicit reduced-motion preference,
  // so the deck becomes manual there; clicks, swipes and arrow keys still work.
  const [reduceMotion, setReduceMotion] = React.useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  )

  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const onChange = () => setReduceMotion(query.matches)
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [])

  const go = React.useCallback(
    (dir: number, x?: number, y?: number) => {
      const root = rootRef.current
      if (!root || busy.current || n < 2) return
      const w = root.clientWidth
      const h = root.clientHeight
      busy.current = true
      setIncoming({
        to: wrap(index + dir, n),
        x: x ?? (dir > 0 ? w * 0.85 : w * 0.15),
        y: y ?? h * 0.5,
        id: Date.now(),
      })
    },
    [index, n],
  )

  // Open the iris once the incoming layer is in the DOM.
  React.useLayoutEffect(() => {
    const root = rootRef.current
    const layer = layerRef.current
    const ring = ringRef.current
    if (!incoming || !root || !layer) return
    const w = root.clientWidth
    const h = root.clientHeight
    const R = coverRadius(incoming.x, incoming.y, w, h)
    const at = " at " + incoming.x + "px " + incoming.y + "px)"
    const ease = "cubic-bezier(.7,0,.2,1)"
    const anims: Animation[] = []
    if (reduceMotion) {
      anims.push(layer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: "both" }))
    } else {
      anims.push(layer.animate([{ clipPath: "circle(0px" + at }, { clipPath: "circle(" + R + "px" + at }], { duration, easing: ease, fill: "both" }))
      const img = layer.firstElementChild as HTMLElement | null
      if (img) anims.push(img.animate([{ transform: "scale(1.18)" }, { transform: "scale(1)" }], { duration: duration * 1.25, easing: "cubic-bezier(.2,.7,.2,1)", fill: "both" }))
      if (ring) {
        ring.style.width = ring.style.height = R * 2 + "px"
        anims.push(
          ring.animate(
            [
              { transform: "translate(" + (incoming.x - R) + "px," + (incoming.y - R) + "px) scale(0)", opacity: 1 },
              { opacity: 1, offset: 0.7 },
              { transform: "translate(" + (incoming.x - R) + "px," + (incoming.y - R) + "px) scale(1)", opacity: 0 },
            ],
            { duration, easing: ease, fill: "both" },
          ),
        )
      }
    }
    let done = false
    anims[0].onfinish = () => {
      done = true
      setIndex(incoming.to)
      setIncoming(null)
      busy.current = false
    }
    return () => {
      if (!done) busy.current = false
      anims.forEach((a) => a.cancel())
    }
  }, [incoming, duration, reduceMotion])

  React.useEffect(() => {
    onChange?.(index)
  }, [index, onChange])

  // pause the timer while off-screen or in a background tab
  React.useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let seen = true
    const sync = () => setPaused(!seen || document.hidden)
    const io = new IntersectionObserver(([e]) => {
      seen = e.isIntersecting
      sync()
    })
    io.observe(root)
    document.addEventListener("visibilitychange", sync)
    return () => {
      io.disconnect()
      document.removeEventListener("visibilitychange", sync)
    }
  }, [])

  // Warm the next photo once the current slide has had time to paint, so the
  // iris opens onto a loaded image instead of a black layer on a slow link.
  const nextImage = n > 1 ? slides[(index + 1) % n]?.image : undefined
  React.useEffect(() => {
    if (!nextImage) return
    const timer = window.setTimeout(() => {
      const image = new Image()
      image.decoding = "async"
      image.src = nextImage
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [nextImage])

  const local = (e: React.PointerEvent) => {
    const r = rootRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width }
  }
  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !showLens) return
    if ((e.target as HTMLElement).closest("[data-ap-cta]")) {
      if (lensOn) setLensOn(false)
      return
    }
    const p = local(e)
    const lens = lensRef.current
    if (lens) lens.style.transform = "translate(" + p.x + "px," + p.y + "px)"
    const label = sideOf(p.x, p.w) > 0 ? "Next" : "Prev"
    if (label !== lensLabel) setLensLabel(label)
    if (!lensOn) setLensOn(true)
  }
  const onDown = (e: React.PointerEvent) => {
    down.current = { x: e.clientX, y: e.clientY }
  }
  const onUp = (e: React.PointerEvent) => {
    const start = down.current
    down.current = null
    if (!start) return
    const p = local(e)
    const dx = e.clientX - start.x
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - start.y)) go(dx < 0 ? 1 : -1, p.x, p.y)
    else if (Math.abs(dx) < 8) go(sideOf(p.x, p.w), p.x, p.y)
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") go(1)
    else if (e.key === "ArrowLeft") go(-1)
    else return
    e.preventDefault()
  }

  const shown = incoming ? incoming.to : index
  const s = slides[shown] || {}
  // The fill is the interval, not just the still pause: it starts the moment a
  // slide becomes current, so `autoplay` is the gap between advances.
  const runFill = autoplay > 0 && n > 1 && !reduceMotion
  const showLens = !plainCursor && n > 1
  const rootStyle = {
    height,
    "--ap-ink": ink,
    "--ap-dur": autoplay + "ms",
    ...style,
  } as React.CSSProperties

  return (
    <div
      ref={rootRef}
      className={["ap-root", className].filter(Boolean).join(" ")}
      style={rootStyle}
      data-paused={paused ? "1" : "0"}
      data-lens={showLens ? "1" : "0"}
      data-dock={reserveMobileDock ? "1" : "0"}
      role="region"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={onKey}
      onPointerMove={onMove}
      onPointerLeave={() => setLensOn(false)}
      onPointerDown={onDown}
      onPointerUp={onUp}
    >
      <style>{AP_CSS}</style>
      <div className="ap-layer">
        {srcs[index] ? <img className="ap-img" src={srcs[index]} alt={slides[index]?.alt || slides[index]?.title || ""} draggable={false} /> : null}
      </div>
      {incoming ? (
        <div ref={layerRef} className="ap-layer" key={incoming.id} style={{ clipPath: "circle(0px at 0 0)" }}>
          {srcs[incoming.to] ? <img className="ap-img" src={srcs[incoming.to]} alt="" draggable={false} /> : null}
        </div>
      ) : null}
      <div ref={ringRef} className="ap-ring" aria-hidden="true" />
      <div className="ap-shade" aria-hidden="true" />
      <div className="ap-top" aria-hidden="true" />
      <div className="ap-text" key={"t" + shown}>
        {s.eyebrow ? (
          <span className="ap-kicker-line" aria-hidden="true">
            <span className={["ap-kicker", isBengali(s.eyebrow) ? "is-bengali" : ""].filter(Boolean).join(" ")}>
              {s.eyebrow}
            </span>
          </span>
        ) : null}
        {s.title ? (
          <span className={["ap-line ap-title", isBengali(s.title) ? "is-bengali" : ""].filter(Boolean).join(" ")} aria-hidden="true">
            <span>{s.title}</span>
          </span>
        ) : null}
        {s.meta?.length ? (
          <span className="ap-meta-line" aria-hidden="true">
            <span className="ap-meta">
              {s.meta.map((item) => (
                <span key={item} className={["ap-chip", isBengali(item) ? "is-bengali" : ""].filter(Boolean).join(" ")}>
                  {item}
                </span>
              ))}
            </span>
          </span>
        ) : null}
        {s.caption ? (
          <span className={["ap-line ap-cap", isBengali(s.caption) ? "is-bengali" : ""].filter(Boolean).join(" ")} aria-hidden="true">
            <span>{s.caption}</span>
          </span>
        ) : null}
        {s.cta ? (
          <span className="ap-cta-line">
            <Link
              to={s.cta.href}
              data-ap-cta
              className={["ap-cta", isBengali(s.cta.label) ? "is-bengali" : ""].filter(Boolean).join(" ")}
              aria-label={s.title ? s.cta.label + ": " + s.title : s.cta.label}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {s.cta.label}
              <ArrowRight strokeWidth={1.8} aria-hidden="true" />
            </Link>
          </span>
        ) : null}
      </div>
      <div className="ap-track" aria-hidden="true">
        <div key={"f" + shown} className="ap-fill" data-run={runFill ? "1" : "0"} onAnimationEnd={() => go(1)} />
      </div>
      {showLens ? (
        <div ref={lensRef} className="ap-lens" data-on={lensOn ? "1" : "0"} aria-hidden="true">
          {lensLabel}
        </div>
      ) : null}
      <div className="ap-sr" aria-live="polite">
        {"Slide " + (shown + 1) + " of " + n + (s.title ? ": " + s.title : "")}
      </div>
    </div>
  )
}
