"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { HeroPhone } from "./HeroPhone";
import styles from "./landing.module.css";
import { PHONE } from "./phone-config";
import { StoryMap } from "./StoryMap";
import { stateAt } from "./timeline";

/* Props float around the phone. dx/dy (stage fractions) is where each one flies
   when the camera pushes in; they fade out as they go. */
const PROPS = [
  { src: "/images/traike/3d/compass.png", pos: "right-[4%] top-[41%] w-[78px] md:left-[54%] md:right-auto md:top-[8%] md:w-[130px]", dx: -0.1, dy: -0.25, fd: 7 },
  { src: "/images/landing/prop-canteen.webp", pos: "left-[40%] bottom-[5%] w-[96px] md:w-[150px] max-md:hidden", dx: -0.25, dy: 0.2, fd: 8 },
  { src: "/images/landing/prop-binoculars.webp", pos: "right-[1%] bottom-[3%] w-[110px] md:w-[250px]", dx: 0.35, dy: 0.25, fd: 6 },
] as const;

const CLOUDS = [
  { src: "/images/landing/cloud-1.webp", pos: "-left-[12%] top-[2%] w-[75%]", flip: false },
  { src: "/images/landing/cloud-2.webp", pos: "-right-[6%] -top-[12%] w-[42%]", flip: false },
  { src: "/images/landing/cloud-3.webp", pos: "left-[16%] -bottom-[14%] w-[85%]", flip: false },
  { src: "/images/landing/cloud-1.webp", pos: "-right-[16%] bottom-[8%] w-[65%]", flip: true },
  { src: "/images/landing/cloud-3.webp", pos: "left-[8%] -top-[10%] w-[75%]", flip: true },
  { src: "/images/landing/cloud-1.webp", pos: "left-[14%] top-[26%] w-[72%]", flip: false },
] as const;

export function HeroStory() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const plate = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const phoneWrap = useRef<HTMLDivElement>(null);
  const clouds = useRef<HTMLDivElement>(null);
  const map = useRef<HTMLDivElement>(null);
  const props = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sec = section.current;
    const stg = stage.current;
    const wrap = phoneWrap.current;
    const box = wrap?.querySelector<HTMLElement>("[data-phone]");
    const mapInner = map.current?.querySelector<HTMLElement>("[data-map-inner]");
    if (!sec || !stg || !wrap || !box || !plate.current || !copy.current || !clouds.current || !map.current || !mapInner) return;
    if (reduce.matches) return;

    let docTop = 0;
    let range = 1;
    let cx = 0;
    let cy = 0;
    let tx = 0;
    let ty = 0;
    let S = 1;
    let W = 1;
    let H = 1;
    let target = 0;
    let cur = 0;
    let raf = 0;

    const measure = () => {
      // The shared header can wrap on narrow screens (80px at 360-390), so read it.
      const HEADER = document.querySelector("header")?.offsetHeight ?? 64;
      sec.style.setProperty("--hh", `${HEADER}px`);
      wrap.style.transform = "none";
      const s = stg.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      const k = b.width / PHONE.shellW;
      const avgX = PHONE.corners.reduce((a, c) => a + c[0], 0) / 4;
      const avgY = PHONE.corners.reduce((a, c) => a + c[1], 0) / 4;
      cx = b.left - s.left + avgX * k;
      cy = b.top - s.top + avgY * k;
      const screenH = ((PHONE.corners[3][1] - PHONE.corners[0][1] + (PHONE.corners[2][1] - PHONE.corners[1][1])) / 2) * k;
      W = s.width;
      H = s.height;
      S = Math.min(5, (H * 1.18) / screenH);
      tx = W / 2 - cx;
      ty = H / 2 - cy;
      docTop = sec.getBoundingClientRect().top + window.scrollY - HEADER;
      range = Math.max(1, sec.offsetHeight - H);
      const w = wrap.getBoundingClientRect();
      wrap.style.transformOrigin = `${s.left + cx - w.left}px ${s.top + cy - w.top}px`;
      readScroll();
    };

    const readScroll = () => {
      target = Math.min(1, Math.max(0, (window.scrollY - docTop) / range));
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const apply = (p: number) => {
      const st = stateAt(p);
      copy.current!.style.opacity = String(st.copyO);
      copy.current!.style.transform = `translate3d(0,${st.copyY}px,0)`;
      copy.current!.style.pointerEvents = st.copyO < 0.1 ? "none" : "auto";
      copy.current!.style.visibility = st.copyO < 0.02 ? "hidden" : "visible";
      plate.current!.style.transform = `scale(${st.plateScale})`;
      wrap.style.transform = `translate3d(${tx * st.push}px,${ty * st.push}px,0) scale(${1 + (S - 1) * st.push})`;
      wrap.style.visibility = st.phoneVisible ? "visible" : "hidden";
      props.current.forEach((el, i) => {
        if (!el) return;
        const d = PROPS[i];
        el.style.opacity = String(1 - st.propsOut);
        el.style.transform = `translate3d(${d.dx * W * st.propsOut}px,${d.dy * H * st.propsOut}px,0)`;
      });
      clouds.current!.style.opacity = String(st.cloudO);
      clouds.current!.style.setProperty("--cs", String(st.cloudS));
      clouds.current!.style.visibility = st.cloudO > 0.001 ? "visible" : "hidden";
      map.current!.style.visibility = st.mapVisible ? "visible" : "hidden";
      mapInner.style.transform = `scale(${st.mapScale})`;
      map.current!.classList.toggle("play", st.play);
    };

    const frame = () => {
      raf = 0;
      cur += (target - cur) * 0.18;
      if (Math.abs(target - cur) < 0.0004) cur = target;
      apply(cur);
      if (cur !== target) raf = requestAnimationFrame(frame);
    };

    measure();
    cur = target;
    apply(cur);
    const onResize = () => measure();
    window.addEventListener("scroll", readScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", readScroll);
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section ref={section} className={styles.hero}>
      <div ref={stage} className={styles.stage}>
        <div ref={plate} className="absolute inset-0 -z-20 will-change-transform">
          <div className={styles.plate} aria-hidden />
        </div>
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_20%_45%,rgba(251,248,244,0.82),transparent_72%)]" />

        {PROPS.map((p, i) => (
          <div
            key={p.src}
            ref={(el) => {
              props.current[i] = el;
            }}
            className={`pointer-events-none absolute z-[5] ${p.pos}`}
          >
            <Image
              src={p.src}
              alt=""
              width={640}
              height={640}
              aria-hidden
              className={`${styles.float} h-auto w-full drop-shadow-[0_22px_26px_rgba(7,42,31,0.35)]`}
              style={{ ["--fd" as string]: `${p.fd}s` }}
            />
          </div>
        ))}

        <div className="relative z-10 mx-auto grid h-full max-w-[1200px] content-start items-start gap-6 px-4 pt-8 sm:px-6 md:grid-cols-[1.15fr_0.85fr] md:content-center md:items-center md:pt-0">
          <div ref={copy} className="will-change-transform">
            <h1 className="max-w-xl font-display text-5xl font-normal leading-[1.05] text-forest md:text-[clamp(44px,6vw,88px)]">
              A walk built around you
            </h1>
            <p className="mt-6 max-w-md text-xl leading-relaxed text-forest/85">
              Tell Traike how much time you have. It shapes the walk around you.
            </p>
            <Link
              href="/app"
              className="mt-9 inline-block rounded-full bg-terra px-8 py-4 text-lg font-bold text-cream shadow-[0_8px_24px_rgba(193,95,60,0.45)] transition-colors hover:bg-terra/90"
            >
              Start a free walk
            </Link>
          </div>
          <div className="flex justify-center md:justify-end md:pe-6">
            <div ref={phoneWrap} className="will-change-transform">
              <div className={styles.bob}>
                <HeroPhone />
              </div>
            </div>
          </div>
        </div>

        <div ref={map} className="invisible absolute inset-0 z-20">
          <StoryMap />
        </div>

        <div ref={clouds} className={`${styles.clouds} pointer-events-none invisible absolute inset-0 z-30 opacity-0`} aria-hidden>
          <div className="absolute inset-0 bg-[radial-gradient(90%_90%_at_50%_50%,#fbe9c8,#f6dcae_60%,#efc98f)]" />
          {CLOUDS.map((c, i) => (
            <Image
              key={i}
              src={c.src}
              alt=""
              width={1400}
              height={740}
              className={`absolute h-auto ${c.pos} ${styles.cloud}`}
              style={{ ["--flip" as string]: c.flip ? -1 : 1 }}
            />
          ))}
        </div>

        <div className="absolute inset-x-0 bottom-0 z-[3] h-24 bg-gradient-to-b from-transparent to-cream" />
      </div>
    </section>
  );
}
