import { Marquee } from "@/components/ui";

const langs = [
  { name: "Python", color: "#ffd34e" },
  { name: "Java", color: "#e76f51" },
  { name: "Node.js", color: "#5fb878" },
  { name: "Ruby", color: "#e0451c" },
  { name: "Go", color: "#5dc9e2" },
  { name: "Rust", color: "#ff5d2e" },
];

export function Ecosystem() {
  return (
    <section className="eco">
      <div className="wrap eco-inner">
        <span className="eco-label">fast cores · works with</span>
        <Marquee
          className="flex-1"
          items={langs}
          getKey={(l) => l.name}
          ariaLabel="Languages ByteVeda works with"
          renderItem={(l) => (
            <span className="eco-item">
              <svg viewBox="0 0 24 24" aria-hidden>
                <title>{l.name}</title>
                <circle cx="12" cy="12" r="9" fill={l.color} opacity="0.9" />
              </svg>
              {l.name}
            </span>
          )}
        />
      </div>
    </section>
  );
}
