export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-radial-faded" />
      <div className="container mx-auto px-6 py-24 sm:py-28">
        <div className="flex flex-col items-center text-center">
          <div className="mb-6">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden>
              <rect width="64" height="64" rx="14" fill="#7C5CFC"/>
              <path d="M18 24c0-3.314 2.686-6 6-6h16c3.314 0 6 2.686 6 6v16c0 3.314-2.686 6-6 6H24c-3.314 0-6-2.686-6-6V24Z" fill="white" opacity=".15"/>
              <path d="M22 28h20v8H22z" fill="#fff"/>
              <circle cx="44" cy="32" r="3" fill="#A996FF"/>
            </svg>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
            Multi‑Chain Wallet Scanner
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-7 text-gray-600">
            Explore transactions across chains with speed, clarity, and beautiful visuals. Built with Next.js, Tailwind, and modern effects.
          </p>
          <div className="mt-10 flex gap-4">
            <a className="btn-primary" href="#get-started">Get Started</a>
            <a className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-gray-800 hover:bg-gray-50 transition-colors" href="#learn-more">Learn More</a>
          </div>
        </div>
      </div>
    </section>
  )
}

