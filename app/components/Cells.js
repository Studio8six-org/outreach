import { safeUrl, splitList } from "../../lib/leads";

const SHORT = { facebook: "FB", instagram: "IG", tiktok: "TT", x: "X", linkedin: "in", youtube: "YT", whatsapp: "WA" };
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

const domain = (url) => url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");

export function WebsiteCell({ url }) {
  const href = safeUrl(url);
  if (!href) return <span className="muted">-</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={href}>
      {domain(href)}
    </a>
  );
}

export function ContactCell({ email, phone }) {
  const emails = splitList(email).filter((e) => EMAIL.test(e));
  const phones = splitList(phone);
  if (!emails.length && !phones.length) return <span className="muted">-</span>;
  return (
    <div className="stack">
      {emails.slice(0, 2).map((e) => (
        <a key={e} href={`mailto:${e}`}>{e}</a>
      ))}
      {phones.slice(0, 2).map((p) => (
        <a key={p} href={`tel:${p.replace(/[^\d+]/g, "")}`}>{p}</a>
      ))}
    </div>
  );
}

export function SocialCell({ socials }) {
  const entries = Object.entries(socials || {}).filter(([, url]) => safeUrl(url));
  if (!entries.length) return <span className="muted">-</span>;
  return (
    <div className="chips">
      {entries.map(([name, url]) => (
        <a key={name} className="chip" href={safeUrl(url)} target="_blank" rel="noopener noreferrer" title={name}>
          {SHORT[name] || name.slice(0, 2)}
        </a>
      ))}
    </div>
  );
}
