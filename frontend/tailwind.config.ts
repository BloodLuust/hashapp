import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";
import containerQueries from "@tailwindcss/container-queries";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [typography, containerQueries],
} satisfies Config;
