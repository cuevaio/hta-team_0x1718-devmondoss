import { redirect } from "next/navigation";

/** La raíz es el videojuego; el panel de dos paneles ya no se sirve. */
export default function Home() {
  redirect("/play");
}
