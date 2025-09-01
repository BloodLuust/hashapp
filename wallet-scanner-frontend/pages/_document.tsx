import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Prevent theme flash: set initial theme class before React mounts */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                try {
                  var ls = localStorage.getItem('theme');
                  var mql = window.matchMedia('(prefers-color-scheme: dark)');
                  var theme = ls || (mql.matches ? 'dark' : 'light');
                  var root = document.documentElement;
                  if (theme === 'dark') root.classList.add('dark');
                  else root.classList.remove('dark');
                } catch (e) {}
              })();
            `,
          }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
