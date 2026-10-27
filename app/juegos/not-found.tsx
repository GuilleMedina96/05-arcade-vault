import Link from "next/link";

export default function GameNotFound() {
  return (
    <div
      className="fade-in"
      style={{ textAlign: "center", padding: "96px 24px" }}
    >
      <div
        className="pixel neon-magenta flicker"
        style={{ fontSize: 14, marginBottom: 16 }}
      >
        JUEGO NO ENCONTRADO
      </div>
      <p
        style={{
          color: "var(--ink-dim)",
          maxWidth: 420,
          margin: "0 auto 32px",
        }}
      >
        Este juego no existe en el vault. Revisa el enlace o elige otro título
        de la biblioteca.
      </p>
      <Link className="btn lg" href="/">
        VOLVER AL VAULT
      </Link>
    </div>
  );
}
