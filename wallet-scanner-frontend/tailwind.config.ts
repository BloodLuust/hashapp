import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#FF3EA5',
          dark: '#C51D7C',
          light: '#A8D8FF',
        },
        midnight: '#0B0E14',
        midnight2: '#141827',
        babyBlue: '#A8D8FF',
        vividPink: '#FF3EA5',
      },
      backgroundImage: {
        'radial-faded':
          'radial-gradient(60%_50%_at_50%_0%, rgba(255,62,165,0.35) 0%, rgba(255,62,165,0.0) 70%)',
      },
    },
  },
  plugins: [],
}

export default config
