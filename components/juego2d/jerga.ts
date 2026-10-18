import type { PaisId } from "./paises";

/**
 * La voz del juego según el país: jerga, un poco de sarcasmo (con el
 * estafador, nunca con la víctima real) y tomadura de pelo amable al jugador.
 *
 * Reglas para escribir aquí:
 *  - Nada de groserías ni insultos: lo juega gente de todas las edades en
 *    un evento. Jerga de uso común y amable.
 *  - El blanco del sarcasmo es el estafador. Al jugador se le bromea, pero
 *    el mensaje de fondo es «le pasa a cualquiera».
 *  - Frases cortas: caben en 2 líneas de ~21 caracteres. Los títulos de
 *    resultado, en 12 caracteres (se dibujan grandes).
 *  - `{x}` se reemplaza con lo que mande el juego (un nombre, un número).
 */

export type Momento =
  | "saludo"
  | "acierto"
  | "racha"
  | "fallo"
  | "cayo"
  | "desconfiado"
  | "tiempo"
  | "ganaste"
  | "perdiste"
  | "lobby"
  | "muchosCayeron"
  | "nadieCayo"
  | "podio"
  | "mula"
  | "inocente";

type Voz = Record<Momento, string[]>;

const VOCES: Record<PaisId, Voz> = {
  pe: {
    saludo: ["¡Habla, causa! Aquí los estafadores se hacen los vivos, pero tú más.", "¡Qué tal, mano! Vamos a ver si eres más pilas que el que te llama del «banco»."],
    acierto: ["¡Bacán, causa!", "¡Eso, mano!", "¡Habla, crack!", "¡Chévere!"],
    racha: ["¡Estás on fire, causa!", "¡Imparable, mano! El estafador ya está llorando.", "¡Racha bravaza!"],
    fallo: ["Asu mare...", "Uy, causa, casi.", "¡Fuiste, mano!"],
    cayo: ["Asu, le creíste... el pata ya está celebrando con una chela.", "El estafador te manda saludos desde su yate.", "Ese link olía a cuento de lejos, causa."],
    desconfiado: ["Tranquilo, causa: era tu mamá.", "No todo es estafa, mano. Relaja."],
    tiempo: ["¡Te quedaste pensando, causa!", "¡Más rápido, mano, que el estafador no espera!"],
    ganaste: ["¡BACÁN!", "¡CHÉVERE!", "¡CRACK!"],
    perdiste: ["¡QUÉ ROCHE!", "¡ASU MARE!", "¡FUISTE!"],
    lobby: ["¡Ya, causas, entren rápido!", "Dicten el código, que esto se pone bravo."],
    muchosCayeron: ["¡Media sala cayó! Qué roche.", "Uff, hoy el estafador hace su agosto."],
    nadieCayo: ["¡Nadie cayó! Así se hace, causas.", "Hoy el estafador se va a dormir sin cena."],
    podio: ["¡{x} es el más pilas de la sala!", "¡Aplausos para {x}, causa!"],
    mula: ["¡Te cacé, mula!", "¡Congelada, causa!"],
    inocente: ["¡Era la bodega, mano!", "¡Asu, ese era inocente!"],
  },
  co: {
    saludo: ["¡Quiubo, parce! Vamos a ver si le gana a los tumbadores.", "¡Hola, parcero! Pilas que aquí todo el mundo quiere su platica."],
    acierto: ["¡De una, parce!", "¡Bacano!", "¡Eso, mijo!", "¡Qué nota!"],
    racha: ["¡Está prendido, parce!", "¡Imparable! El tumbador ya está llorando.", "¡Qué racha tan bacana!"],
    fallo: ["¡Uy, no, parce!", "Qué boleta...", "¡Ay, mijo!"],
    cayo: ["Parce, el tumbador ya está pidiendo la picada a nombre suyo.", "¡Le creyó! El estafador ya está de rumba.", "Uy, ese le dio papaya al tumbador."],
    desconfiado: ["Tranquilo, parce, era la cucha.", "No todo es estafa, mijo."],
    tiempo: ["¡Se quedó pensando, parce!", "¡Más rápido, que el tumbador no espera!"],
    ganaste: ["¡BACANO!", "¡DE UNA!", "¡QUÉ NOTA!"],
    perdiste: ["¡QUÉ BOLETA!", "¡UY, NO!", "¡AY, MIJO!"],
    lobby: ["¡Entren, parceros!", "Pasen el código, que esto se va a poner bueno."],
    muchosCayeron: ["¡Media sala dio papaya!", "Uy, hoy el tumbador sale ganando."],
    nadieCayo: ["¡Nadie cayó! Qué berraquera.", "Hoy el tumbador se queda sin rumba."],
    podio: ["¡{x} es el más avispado, parce!", "¡Aplausos para {x}!"],
    mula: ["¡Cayó la mula, parce!", "¡De una, congelada!"],
    inocente: ["¡Esa era la tienda, parce!", "¡Uy, era inocente!"],
  },
  mx: {
    saludo: ["¡Qué onda! A ver si eres más abusado que los que te marcan del «banco».", "¡Órale! Aquí todos quieren tu lana. Aguas."],
    acierto: ["¡Chido!", "¡Eso, carnal!", "¡Bien ahí!", "¡Qué chido!"],
    racha: ["¡Estás que ardes, carnal!", "¡Imparable! El estafador ya chilla.", "¡Racha bien chida!"],
    fallo: ["¡No manches!", "Qué oso...", "¡Uy, carnal!"],
    cayo: ["Neta le creíste... el estafador ya pidió sus tacos.", "¡Aguas! Ya te bajaron la lana.", "El estafador te manda saludos desde la playa."],
    desconfiado: ["Relájate, era tu jefa.", "No todo es estafa, carnal."],
    tiempo: ["¡Te quedaste pensando, carnal!", "¡Ándale, que el estafador no espera!"],
    ganaste: ["¡QUÉ CHIDO!", "¡ÓRALE!", "¡BIEN AHÍ!"],
    perdiste: ["¡NO MANCHES!", "¡QUÉ OSO!", "¡AY, CARNAL!"],
    lobby: ["¡Éntrenle, banda!", "Pásense el código, que se va a poner bueno."],
    muchosCayeron: ["¡Media sala cayó, qué oso!", "Hoy el estafador sí sacó para sus tacos."],
    nadieCayo: ["¡Nadie cayó! Bien chidos.", "Hoy el estafador se queda sin tacos."],
    podio: ["¡{x} es el más abusado!", "¡Un aplauso para {x}, banda!"],
    mula: ["¡Cayó la mula!", "¡Congelada, carnal!"],
    inocente: ["¡Era la tiendita, carnal!", "¡No manches, era inocente!"],
  },
  ar: {
    saludo: ["¡Hola, che! A ver si sos más vivo que el chanta que te llama.", "¡Buenas! Acá todos quieren tu guita. Ojo."],
    acierto: ["¡Joya, che!", "¡Bárbaro!", "¡Posta, crack!", "¡Bien ahí!"],
    racha: ["¡Estás re on fire, che!", "¡Imparable! El chanta ya llora.", "¡Qué racha, maestro!"],
    fallo: ["¡Qué garrón!", "Uh, che...", "¡Nooo, che!"],
    cayo: ["¡Te la creíste! El chanta ya se está comprando un asado.", "Posta que el chanta te vio venir.", "El estafador te saluda desde la costa."],
    desconfiado: ["Tranqui, era tu vieja.", "No todo es estafa, che. Relajá."],
    tiempo: ["¡Te colgaste pensando, che!", "¡Dale, que el chanta no espera!"],
    ganaste: ["¡JOYA!", "¡BÁRBARO!", "¡BIEN AHÍ!"],
    perdiste: ["¡QUÉ GARRÓN!", "¡UH, CHE!", "¡NOOO!"],
    lobby: ["¡Entren, che!", "Pásense el código, que esto se pone lindo."],
    muchosCayeron: ["¡Media sala se la creyó!", "Hoy el chanta se va con el asado."],
    nadieCayo: ["¡Nadie cayó! Bárbaro, che.", "Hoy el chanta se queda sin asado."],
    podio: ["¡{x} es el más vivo de la sala!", "¡Aplausos para {x}, che!"],
    mula: ["¡Cayó la mula, che!", "¡Congelada!"],
    inocente: ["¡Era el almacén, che!", "¡Uh, era inocente!"],
  },
  cl: {
    saludo: ["¡Hola, po! A ver si te pasan el cuento del tío o no.", "¡Buena! Aquí todos quieren tus lucas. Ojo, po."],
    acierto: ["¡Bacán, po!", "¡Al tiro!", "¡Eso, compadre!", "¡Seco!"],
    racha: ["¡Cuático lo tuyo!", "¡Imparable, po! El cuentero ya llora.", "¡Qué racha más bacán!"],
    fallo: ["¡Chuta!", "Fome, po...", "¡Uy, compadre!"],
    cayo: ["¡Te pasaron el cuento del tío, po!", "El cuentero ya está celebrando con un completo.", "Te vieron cara de turista, compadre."],
    desconfiado: ["Relájate, era tu mamá, po.", "No todo es cuento, compadre."],
    tiempo: ["¡Te quedaste pegado, po!", "¡Al tiro, que el cuentero no espera!"],
    ganaste: ["¡BACÁN, PO!", "¡CUÁTICO!", "¡SECO!"],
    perdiste: ["¡CHUTA!", "¡QUÉ FOME!", "¡UY, PO!"],
    lobby: ["¡Entren al tiro!", "Pasen el código, que esto va a estar cuático."],
    muchosCayeron: ["¡Media sala cayó en el cuento!", "Hoy el cuentero se va contento."],
    nadieCayo: ["¡Nadie cayó! Bacán, po.", "Hoy el cuentero se va sin lucas."],
    podio: ["¡{x} es el más seco!", "¡Aplausos para {x}, po!"],
    mula: ["¡Cayó la mula, po!", "¡Congelada al tiro!"],
    inocente: ["¡Era el almacén, po!", "¡Chuta, era inocente!"],
  },
  ec: {
    saludo: ["¡Qué fue, ñaño! A ver si eres más avispado que el estafador.", "¡Hola, mijo! Aquí todos quieren tu platita. Ojo."],
    acierto: ["¡De ley, ñaño!", "¡Chévere!", "¡Bien, mijo!", "¡Bacán!"],
    racha: ["¡Estás imparable, ñaño!", "¡El estafador ya está llorando!", "¡Qué racha de ley!"],
    fallo: ["¡Chuta!", "¡Uy, ñaño!", "¡Ay, mijo!"],
    cayo: ["Chuta, le creíste... el estafador ya está de farra.", "¡Te dieron gato por liebre, ñaño!", "El estafador te manda saludos desde Montañita."],
    desconfiado: ["Tranquilo, ñaño, era tu mamá.", "No todo es estafa, mijo."],
    tiempo: ["¡Te quedaste pensando, ñaño!", "¡Apura, que el estafador no espera!"],
    ganaste: ["¡DE LEY!", "¡CHÉVERE!", "¡BACÁN!"],
    perdiste: ["¡CHUTA!", "¡AY, ÑAÑO!", "¡QUÉ PENA!"],
    lobby: ["¡Entren, ñaños!", "Pasen el código, que se pone bueno."],
    muchosCayeron: ["¡Media sala cayó, chuta!", "Hoy el estafador se va de farra."],
    nadieCayo: ["¡Nadie cayó! De ley, ñaños.", "Hoy el estafador se queda sin farra."],
    podio: ["¡{x} es el más avispado!", "¡Aplausos para {x}, ñaño!"],
    mula: ["¡Cayó la mula, ñaño!", "¡Congelada!"],
    inocente: ["¡Era la tienda, ñaño!", "¡Chuta, era inocente!"],
  },
  bo: {
    saludo: ["¡Hola, pues! A ver si le ganas al estafador, chango.", "¡Qué tal! Aquí todos quieren tus pesitos. Ojo, pues."],
    acierto: ["¡De una, chango!", "¡Bien, pues!", "¡Genio!", "¡Eso!"],
    racha: ["¡Estás imparable, chango!", "¡El estafador ya está llorando, pues!", "¡Qué racha!"],
    fallo: ["¡Pucha!", "Qué macana...", "¡Ay, chango!"],
    cayo: ["¡Pucha! El estafador ya se va de fiesta a tu costa.", "Le creíste, chango... qué macana.", "El estafador ya está pagando con tu QR, pues."],
    desconfiado: ["Tranquilo, era tu mamá, pues.", "No todo es estafa, chango."],
    tiempo: ["¡Te quedaste pensando, chango!", "¡Rápido, pues, que el estafador no espera!"],
    ganaste: ["¡DE UNA!", "¡GENIO!", "¡BIEN, PUES!"],
    perdiste: ["¡PUCHA!", "¡QUÉ MACANA!", "¡AY, CHANGO!"],
    lobby: ["¡Entren, pues!", "Pasen el código, que esto se pone bueno."],
    muchosCayeron: ["¡Media sala cayó, pucha!", "Hoy el estafador se va de fiesta."],
    nadieCayo: ["¡Nadie cayó! Genios, pues.", "Hoy el estafador se queda sin fiesta."],
    podio: ["¡{x} es el más vivo, pues!", "¡Aplausos para {x}!"],
    mula: ["¡Cayó la mula, chango!", "¡Congelada, pues!"],
    inocente: ["¡Era la tienda, pues!", "¡Pucha, era inocente!"],
  },
  ve: {
    saludo: ["¡Épale, pana! A ver si eres más vivo que el que te escribe del «banco».", "¡Qué más, chamo! Aquí todos quieren tus reales. Pendiente."],
    acierto: ["¡Chévere, pana!", "¡Épale, chamo!", "¡Burda de bien!", "¡Fino!"],
    racha: ["¡Estás encendido, pana!", "¡Imparable! El estafador ya está llorando.", "¡Qué racha tan fina!"],
    fallo: ["¡Qué ladilla!", "¡Ay, chamo!", "¡Nooo, pana!"],
    cayo: ["Chamo, el estafador ya está celebrando con unas arepas.", "¡Pana, te vieron la cara!", "El estafador te manda saludos desde la playa."],
    desconfiado: ["Tranquilo, pana, era tu mamá.", "No todo es estafa, chamo."],
    tiempo: ["¡Te quedaste pegado, pana!", "¡Apúrate, chamo, que el estafador no espera!"],
    ganaste: ["¡CHÉVERE!", "¡ÉPALE!", "¡FINO, PANA!"],
    perdiste: ["¡LADILLA!", "¡AY, CHAMO!", "¡NOOO!"],
    lobby: ["¡Entren, panas!", "Pasen el código, que esto se pone fino."],
    muchosCayeron: ["¡Media sala cayó, qué ladilla!", "Hoy el estafador come arepa doble."],
    nadieCayo: ["¡Nadie cayó! Burda de bien.", "Hoy el estafador se queda sin arepa."],
    podio: ["¡{x} es el más pilas, pana!", "¡Aplausos para {x}!"],
    mula: ["¡Cayó la mula, pana!", "¡Congelada, chamo!"],
    inocente: ["¡Era la bodega, pana!", "¡Ay, era inocente!"],
  },
  otro: {
    saludo: ["¡Hola! A ver si eres más listo que quien te llama del «banco».", "¡Bienvenido! Aquí todos quieren tu dinero. Atento."],
    acierto: ["¡Bien!", "¡Excelente!", "¡Eso es!", "¡Muy bien!"],
    racha: ["¡Estás imparable!", "¡El estafador ya está llorando!", "¡Qué racha!"],
    fallo: ["¡Uy!", "Casi...", "¡Ay, no!"],
    cayo: ["Le creíste... el estafador ya está celebrando.", "El estafador te manda saludos desde la playa.", "Ese link olía raro de lejos."],
    desconfiado: ["Tranquilo: era tu mamá.", "No todo es estafa. Relájate."],
    tiempo: ["¡Te quedaste pensando!", "¡Rápido, que el estafador no espera!"],
    ganaste: ["¡EXCELENTE!", "¡MUY BIEN!", "¡GENIAL!"],
    perdiste: ["¡CASI!", "¡UY, NO!", "¡OTRA VEZ!"],
    lobby: ["¡Entren todos!", "Compartan el código, que esto se pone bueno."],
    muchosCayeron: ["¡Media sala cayó!", "Hoy el estafador sale ganando."],
    nadieCayo: ["¡Nadie cayó! Excelente.", "Hoy el estafador se va con las manos vacías."],
    podio: ["¡{x} es el más listo de la sala!", "¡Aplausos para {x}!"],
    mula: ["¡Cayó la mula!", "¡Congelada!"],
    inocente: ["¡Era la tienda!", "¡Ese era inocente!"],
  },
};

/** Una frase al azar para el momento, con `{x}` reemplazado. */
export function frase(pais: PaisId, momento: Momento, x = ""): string {
  const lista = VOCES[pais]?.[momento] ?? VOCES.otro[momento];
  return lista[Math.floor(Math.random() * lista.length)].replace(/\{x\}/g, x);
}

/** Para tests: todas las frases de todos los países. */
export function todasLasFrases(): Array<{ pais: PaisId; momento: Momento; texto: string }> {
  return (Object.keys(VOCES) as PaisId[]).flatMap((pais) =>
    (Object.keys(VOCES[pais]) as Momento[]).flatMap((momento) => VOCES[pais][momento].map((texto) => ({ pais, momento, texto }))),
  );
}
