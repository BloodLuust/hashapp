import type { NextPage } from 'next';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import Button from '../components/Button';
import RandomModeConsole from '../components/RandomModeConsole';
import ParallaxBackground from '../components/ParallaxBackground';
import HeaderBar from '../components/HeaderBar';
import { useEffect, useState } from 'react';
import { fetchHealth } from '@/lib/api';

const Parallax = dynamic(() => import('react-scroll-parallax').then(m => m.Parallax), { ssr: false });

const Home: NextPage = () => {
  const [showRandom, setShowRandom] = useState(false)
  return (
    <>
      <Head>
        <title>Wallet Recovery</title>
      </Head>

      {/* Hero Section */}
      <section className="relative h-screen bg-gray-50 dark:bg-midnight flex flex-col items-center justify-center">
        <ParallaxBackground />
        <HeaderBar />
        {/* Parallax title: moves at a slower speed on scroll */}
        <Parallax speed={-5}>
          <h1 className="text-5xl font-bold text-center mb-6 text-gray-900 dark:text-gray-100">
              Wallet Recovery Starts Here
          </h1>
        </Parallax>
        {/* Launch buttons */}
        <div className="flex gap-3">
          <a href="/dashboard">
            <Button label="Launch Scanner" />
          </a>
          <button onClick={() => setShowRandom(true)} className="inline-flex items-center rounded-md bg-black text-white px-4 py-2 hover:bg-gray-800 transition-colors">Random Mode</button>
        </div>
      </section>

      {/* Placeholder second section to enable scrolling (for parallax effect) */}
      <section className="h-screen flex items-center justify-center bg-white">
        <p className="text-xl text-gray-700">[ Additional content here ]</p>
      </section>
      {showRandom && <RandomModeConsole open={showRandom} onClose={() => setShowRandom(false)} />}
    </>
  );
};

export default Home;
