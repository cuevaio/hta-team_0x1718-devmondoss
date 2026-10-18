"use client";

import Link from "next/link";
import { useState } from "react";
import { motivoAliasInvalido } from "@/lib/juego/alias";
import s from "./juego.module.css";
import Victima from "./victima";
import Atacante from "./atacante";

/** `/play` — entrada al demo jugable (DEMO_JUEGO §3–4, §8). */
export default function Juego() {
  const [alias, setAlias] = useState("");
  const [rol, setRol] = useState<"victima" | "atacante" | null>(null);
  const [partida, setPartida] = useState(0);

  const limpio = alias.trim();
  const motivo = limpio ? motivoAliasInvalido(limpio) : null;
  const valido = limpio.length > 0 && limpio.length <= 24 && !motivo;

  return (
    <main className={s.pagina}>
      <div className={s.contenedor}>
        <div className={s.franja}>
          <span className={s.sello}>Simulación · dinero y personas ficticias</span>
          {rol && (
            <button
              className={`${s.boton} ${s.botonSecundario}`}
              style={{ minHeight: 32, padding: "4px 10px", fontSize: "0.75rem" }}
              onClick={() => setRol(null)}
            >
              Salir
            </button>
          )}
        </div>

        {!rol ? (
          <>
            <header className={s.grupo}>
              <h1 className={s.titulo}>Te están robando</h1>
              <p className={s.subtitulo}>El barrio no duerme</p>
            </header>

            <section className={s.tarjeta}>
              <p className={s.texto}>
                Vive una estafa real de Perú desde los dos lados y mira cómo reacciona nuestro sistema de agentes.
              </p>
              <p className={s.suave}>
                Este juego simula un intento de estafa con dinero, banco y personas ficticias. Puede generar tensión;
                puedes salir cuando quieras. Guardamos tus elecciones y tus respuestas de forma anónima. No pedimos
                nombre, DNI, teléfono ni datos bancarios.
              </p>
              <label className={s.campo}>
                <span>Elige un apodo (no uses tu nombre real)</span>
                <input
                  value={alias}
                  maxLength={24}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder="Ej.: Zorro"
                  autoComplete="off"
                />
              </label>
              {motivo && (
                <p className={s.error} role="alert">
                  {motivo.replace(/^el alias/, "El apodo")}
                </p>
              )}
            </section>

            <div className={s.botones}>
              <button
                className={s.boton}
                disabled={!valido}
                onClick={() => {
                  setPartida((n) => n + 1);
                  setRol("victima");
                }}
              >
                👩🏽 Ser la víctima · Rosa, dueña de una bodega
              </button>
              <button
                className={`${s.boton} ${s.botonPeligro}`}
                disabled={!valido}
                onClick={() => {
                  setPartida((n) => n + 1);
                  setRol("atacante");
                }}
              >
                🕶️ Ser el atacante · encuentra huecos del sistema
              </button>
            </div>

            <p className={s.pie}>
              Si te pasó algo así de verdad: comunícate con tu banco por sus canales oficiales y reporta a la SBS,
              Indecopi o la Policía Nacional.
            </p>
          </>
        ) : rol === "victima" ? (
          <Victima key={partida} alias={limpio} onTerminar={() => setRol(null)} />
        ) : (
          <Atacante key={partida} alias={limpio} onTerminar={() => setRol(null)} />
        )}

        <p className={s.pie}>
          Datos 100% sintéticos. Banco Andino no existe. <Link href="/monitor">Ver el monitor</Link>
        </p>
      </div>
    </main>
  );
}
