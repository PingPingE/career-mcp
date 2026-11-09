import type { ReactNode } from "react";

export const metadata = { title: "Career MCP" };

const css = `
:root { --bg:#fafaf9; --fg:#1c1917; --muted:#78716c; --line:#e7e5e4; --accent:#1d4ed8; --err:#b91c1c; }
@media (prefers-color-scheme: dark) { :root { --bg:#1c1917; --fg:#f5f5f4; --muted:#a8a29e; --line:#44403c; --accent:#93c5fd; --err:#fca5a5; } }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--fg); font:15px/1.6 -apple-system, "Pretendard", system-ui, sans-serif; }
main { max-width: 720px; margin: 0 auto; padding: 40px 16px; }
h1 { font-size: 22px; margin: 0 0 4px; }
.muted { color: var(--muted); }
.err { color: var(--err); }
input, button { font: inherit; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--line); background: transparent; color: inherit; width: 100%; }
button { background: var(--fg); color: var(--bg); border: 0; cursor: pointer; }
button.secondary { background: transparent; color: var(--fg); border: 1px solid var(--line); }
form { display: grid; gap: 10px; max-width: 360px; margin-top: 20px; }
code { background: color-mix(in srgb, var(--fg) 8%, transparent); padding: 2px 6px; border-radius: 4px; word-break: break-all; }
table { border-collapse: collapse; width: 100%; font-size: 13px; margin-top: 12px; }
td, th { border-bottom: 1px solid var(--line); padding: 6px 4px; text-align: left; vertical-align: top; }
.scroll { overflow-x: auto; }
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <style>{css}</style>
        <main>{children}</main>
      </body>
    </html>
  );
}
