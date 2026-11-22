import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy (draft)", robots: { index: false } };

const contact = process.env.APP_CONTACT?.trim() || null;

const ITEMS: { h: string; p: string }[] = [
  { h: "Social profile", p: "A social profile exists only if you create it (18+, self-declared). You choose the name and one of twelve avatars. Visibility is private until you change it, to friends or to every signed-in member with a profile." },
  { h: "What others can see", p: "Name, avatar, member-since month, number of walks, kilometres, top areas and categories, and completed walks (city, day, distance, minutes, stops). Never your start point, route line or time of day. Stops within 300 m of a walk's start are left out. Google places are shown by category and place id only; the name is looked up live." },
  { h: "Walking now (separate opt-in, off by default)", p: "If you turn it on, friends see your name and the city, and a rough time since you started. We store a grid cell about 1 km wide, never your exact position. Nothing is shared in the first 10 minutes or within 800 m of the start, or outside supported areas. The record expires 20 minutes after the last update, stops showing when the walk ends or you hide it, and is removed within about 50 minutes." },
  { h: "Walk together", p: "Requests use a fixed set of messages and a public meeting place. No live location is shared." },
  { h: "Blocking and reports", p: "Blocking is silent and removes the friendship. A report is read only by the operator. Three distinct reports within seven days pause a profile until it is reviewed. Reports are kept for safety even after you delete your data." },
  { h: "Your data", p: "Settings, \"Forget everything\" and deleting the social profile remove your social data. Walk history and preferences stay on your account until you delete them." },
  { h: "Location lookups", p: "Your approximate city may be derived from your IP address to centre the map. Some preferences are stored on your device." },
  { h: "Contact", p: contact ? `Questions or requests: ${contact}` : "Contact details are set by the operator." },
];

/** DRAFT for counsel review (round 2 plan section 3.9). Nothing social goes live with its flags on until counsel signs this. */
export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-cream font-app-sans text-charcoal">
      {/* The app's type and rows (round 13): a serif title, tinted section bars, hairline rows. 720px on a tablet and a desktop. */}
      <div className="mx-auto w-full max-w-[720px] pb-16 md:border-x md:border-tk-hair">
        <header className="px-4 pb-4 pt-[max(28px,env(safe-area-inset-top))]">
          <p role="note" className="inline-block rounded-[6px] border border-tk-hair bg-tk-bar px-3 py-2 text-[14px] font-semibold text-tk-check shadow-[0_2px_0_var(--tk-lip)]">
            Draft for legal review. Not final.
          </p>
          <h1 className="mt-4 font-app-serif text-[36px] font-semibold leading-[1.1] text-tk-ink [font-variation-settings:'SOFT'_100,'WONK'_1]">Privacy</h1>
        </header>
        {ITEMS.map((i) => (
          <section key={i.h}>
            <h2 className="tk-bar !text-[15px]">{i.h}</h2>
            <p className="px-4 py-3 text-[16px] leading-6 text-tk-body">{i.p}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
