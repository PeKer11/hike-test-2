import Image from "next/image";

import styles from "./landing.module.css";
import { PHONE } from "./phone-config";
import { RouteMap } from "./RouteMap";

/* Photoreal phone shell (generated render, green screen keyed out) with the live
   route map behind it. The screen is laid out at 393x852 and warped onto the
   shell's screen corners with a homography measured by scripts/landing/prep-phone.py. */
export function HeroPhone({ className = "" }: { className?: string }) {
  return (
    <div className={`${styles.phoneBox} ${className}`} data-phone>
      <div className={styles.phoneShadow} aria-hidden />
      <div className={styles.phoneStage}>
        <div className={styles.phoneClip}>
          <div
            className={`${styles.phoneScreen} autoplay`}
            style={{
              width: PHONE.screenW,
              height: PHONE.screenH,
              transform: PHONE.matrix3d,
            }}
          >
            <RouteMap
              variant="portrait"
              plate="/images/landing/map-plate.webp"
              animate
              className="absolute inset-0 h-full w-full"
            />
          </div>
        </div>
        <Image
          src="/images/landing/phone-shell.webp"
          alt=""
          width={PHONE.shellW}
          height={PHONE.shellH}
          sizes="(min-width: 768px) 360px, 80vw"
          aria-hidden
          className={styles.phoneShell}
        />
      </div>
    </div>
  );
}
