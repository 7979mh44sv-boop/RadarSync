import Link from "next/link";
import HeroVisual from "@/components/product/HeroVisual";
import { JurySummary } from "@/components/product/ProductSections";
import TimingBoxRender from "@/components/product/TimingBoxRender";

const TEASERS = [
  { href: "/why-us", k: "Why", t: "Satellites must share time." },
  { href: "/product", k: "Product", t: "The Timing Box concept." },
  { href: "/science", k: "Science", t: "Live simulation and demo." },
  { href: "/market", k: "Market", t: "Buyers and business model." },
  { href: "/roadmap", k: "Roadmap", t: "From concept to orbit." },
];

export default function Home() {
  return (
    <>
      <section className="relative flex min-h-[100svh] flex-col overflow-hidden" aria-labelledby="hero-title">
        <HeroVisual />
        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-end px-6 pb-16 pt-24 sm:pb-24">
          <h1 id="hero-title" className="text-5xl font-bold uppercase leading-[0.95] tracking-tight text-white sm:text-7xl lg:text-8xl">
            One Constellation.
            <br />
            One Radar.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-slate-200 sm:text-xl">Precision timing for satellites working together.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/product" className="border-2 border-white px-7 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition-colors hover:bg-white hover:text-black focus-visible:bg-white focus-visible:text-black focus-visible:outline-none">
              Explore Product
            </Link>
            <Link href="/science" className="border-2 border-white/30 px-7 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-200 transition-colors hover:border-white hover:text-white focus-visible:border-white focus-visible:outline-none">
              Run Demo
            </Link>
          </div>
          <p className="mt-6 text-xs uppercase tracking-[0.2em] text-slate-400">Concept render · Simulation-backed · Hardware in development</p>
        </div>
      </section>
      <JurySummary />
      <section aria-labelledby="home-product" className="bg-gradient-to-b from-cloud via-ice/70 to-cloud py-20 sm:py-28">
        <div className="mx-auto w-full max-w-6xl px-6 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-signal">The product</p>
          <h2 id="home-product" className="mt-3 text-4xl font-bold uppercase tracking-tight text-navy sm:text-6xl">The Timing Box</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">One compact module. Built to help satellites stay in sync.</p>
          <div className="mt-10"><TimingBoxRender /></div>
          <Link href="/product" className="mt-8 inline-block border-2 border-navy px-7 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-navy transition-colors hover:bg-navy hover:text-white">
            Explore Product
          </Link>
        </div>
      </section>
      <nav aria-label="Explore" className="mx-auto grid w-full max-w-7xl gap-px px-6 py-16 sm:grid-cols-2 lg:grid-cols-5">
        {TEASERS.map((t) => (
          <Link key={t.href} href={t.href} className="group border-t border-ice py-6 pr-4 transition-colors hover:border-signal focus-visible:border-signal focus-visible:outline-none">
            <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-signal">{t.k}</span>
            <span className="mt-2 flex items-center justify-between text-lg font-semibold text-navy">
              {t.t}<span aria-hidden className="ml-2 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-navy">→</span>
            </span>
          </Link>
        ))}
      </nav>
    </>
  );
}
