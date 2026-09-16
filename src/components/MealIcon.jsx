import React from "react";

export function normalizar(texto = "") {
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// ============================================================
// CAPA 1 — Ícono visual: "¿qué forma tiene este ingrediente?"
// Se aplica al ingrediente DOMINANTE del plato (mayor peso/calorías),
// no al nombre completo del plato. Así "milanesa con papas fritas y
// ensalada" muestra el ícono de lo que realmente pesa más.
// ============================================================
export function getVisualCategory(nombreIngrediente = "") {
  const n = normalizar(nombreIngrediente);

  if (/\bhelad|ice[ -]?cream|gelato|sorbet|sorbete/.test(n)) return "iceCream";
  if (/\bsushi|nigiri|sashimi|maki\b/.test(n)) return "sushi";
  if (/\bsemilla|\bchia\b|\blino\b|linaza|sesamo|girasol|calabaza|\bpepita|poppy/.test(n)) return "seeds";
  if (/\bnuez|almendra|\bmani\b|cacahuate|avellana|castana|pistacho|pecan|macadamia|\bcaju\b|anacardo/.test(n)) return "nuts";

  if (/\bvino|cerveza|\bfernet|\btrago|coctel|whisky|vodka|\bron\b|gin\b|espumante|champagne|sidra/.test(n)) return "alcohol";
  if (/aceitun|pepinillo|\bpicada|encurtido|\bmani salado|fritur/.test(n)) return "snack";
  if (/\bqueso|\byogur|\bleche\b|\bcrema\b|\bmanteca\b|ricota|mascarpone/.test(n)) return "dairy";
  if (/lenteja|garbanzo|\bporoto|frijol|\bhabas?\b/.test(n)) return "legumbre";

  if (/hamburguesa|\bburger\b|cheeseburger|medallon/.test(n)) return "burger";
  if (/sandwich|sanduich|tostad[oa]|lomito|\bwrap\b|bagel|torta de/.test(n)) return "sandwich";
  if (/fideo|\bpasta\b|tallarin|espagueti|spaghetti|ravioli|raviol|gnocchi|noqui|lasagna|lasana|canelon|fetuccin|penne|macarron/.test(n)) return "pasta";
  if (/\bpizza|empanada|calzone|focaccia|fugazza|\btarta\b/.test(n)) return "pizza";
  if (/pollo|pechuga|alita|patamuslo|suprema|nugget|\bpavo\b/.test(n)) return "poultry";
  if (/pescado|salmon|atun|merluza|marisco|camaron|langostino|rabas|calamar|paella/.test(n)) return "fish";
  if (/\bcarne\b|\bbife\b|asado|costilla|vacio|\blomo\b|matambre|entrecot|churrasco|milanesa|\bcerdo\b|bondiola|\bvaca\b|ternera|colita|chorizo|choripan|salchich|morcilla/.test(n)) return "meat";
  if (/ensalada|lechuga|rucula|\btomates?\b|pepino|zanahoria|brocoli|espinaca|\bverdura|\bvegetal|\bpalta\b|guacamole/.test(n)) return "salad";
  if (/\bhuevo|omelette|revuelto\b|\bfrito\b|pochado|tortilla de papa|panqueque|pancake|\bwaffle\b/.test(n)) return "egg";
  if (/\bcafe\b|\bte\b|\bmate\b|cappuccino|cortado|infusion|\blatte\b|espresso|\bmocha\b/.test(n)) return "coffee";
  if (/\bjugo\b|licuado|smoothie|\bagua\b|gaseosa|\bcoca\b|sprite|bebida/.test(n)) return "drink";
  if (/manzana|banana|\bfruta\b|naranja|frutilla|mandarina|\buvas?\b|\bperas?\b|\bkiwis?\b|durazno|arandano|sandia|melon/.test(n)) return "fruit";
  if (/\barroz\b|risotto|\bwok\b|quinoa/.test(n)) return "rice";
  if (/\bsopa\b|guiso|cazuela|estofado|\blocro\b|\bcaldo\b|ramen|puchero/.test(n)) return "soup";
  if (/\btacos?\b|burrito|quesadilla|fajita|nachos/.test(n)) return "taco";
  if (/pastel de papas?|shepherd'?s pie|cottage pie|papas fritas|patatas fritas|papas al horno|patata al horno|papas rusticas|patatas bravas|pure de papas?|pure de patatas|tortilla de papas?|\bpapas?\b|\bpatatas?\b|batata/.test(n)) return "potato";
  if (/\bpan(es)?\b|medialuna|croissant|\btorta\b|\bpastel\b|factura|galletita|galleta|\bcookie\b|alfajor|chocolate|postre|\bflan\b|budin|muffin|\bscone\b/.test(n)) return "bakery";

  return "default";
}

// Determina el ingrediente dominante (mayor peso estimado en g; desempate por calorías)
export function getDominantIngredient(ingredientes = []) {
  if (!Array.isArray(ingredientes) || !ingredientes.length) return null;
  return ingredientes.reduce((max, ing) => {
    const pesoActual = Number(ing.peso_estimado_g) || 0;
    const pesoMax = Number(max.peso_estimado_g) || 0;
    if (pesoActual === pesoMax) {
      return (Number(ing.calorias) || 0) > (Number(max.calorias) || 0) ? ing : max;
    }
    return pesoActual > pesoMax ? ing : max;
  }, ingredientes[0]);
}

// ============================================================
// CAPA 2 — Grupo nutricional: "¿qué función cumple este ingrediente?"
// Se calcula por CADA ingrediente al cargarlo (no solo el dominante),
// para permitir análisis agrupados (% de comidas con vegetales,
// frecuencia semanal con alcohol, fuentes de proteína, etc.).
// ============================================================
export function getNutrientGroup(nombreIngrediente = "") {
  const n = normalizar(nombreIngrediente);

  if (/\bvino|cerveza|\bfernet|\btrago|coctel|whisky|vodka|\bron\b|gin\b|espumante|champagne|sidra/.test(n)) return "alcohol";
  if (/\bqueso|\byogur|\bleche\b|\bcrema\b|ricota|mascarpone/.test(n)) return "lacteo";
  if (/\baceite|\bmanteca\b|margarina|mayonesa/.test(n)) return "grasa_aceite";
  if (/\bnuez|nueces|almendra|\bmani\b|cacahuate|avellana|castana|pistacho|pecan|macadamia|\bsemilla|\bchia\b|\blino\b|linaza|sesamo/.test(n)) return "grasa_saludable";
  if (/pollo|pechuga|\bpavo\b|pescado|salmon|atun|merluza|marisco|camaron|langostino|calamar|\bcarne\b|\bbife\b|asado|costilla|vacio|\blomo\b|matambre|entrecot|churrasco|milanesa|\bcerdo\b|\bvaca\b|ternera|\bhuevo|omelette|chorizo|salchich|jamon|fiambre|salame|salami/.test(n)) return "proteina_animal";
  if (/lenteja|garbanzo|\bporoto|frijol|\bhabas?\b|tofu|seitan|soja/.test(n)) return "proteina_vegetal";
  if (/\barroz\b|\bpanes?\b|\bpan\b|fideo|\bpasta\b|\bpapas?\b|\bpatatas?\b|quinoa|avena|harina|tallarin|gnocchi|noqui|raviol|batata|hojaldre|\bmasa\b/.test(n)) return "carbohidrato_almidon";
  if (/manzana|banana|\bfruta\b|naranja|frutilla|mandarina|\buvas?\b|\bperas?\b|\bkiwis?\b|durazno|arandano|sandia|melon/.test(n)) return "fruta";
  if (/lechuga|rucula|\btomate\b|pepino|zanahoria|brocoli|espinaca|\bverdura|\bvegetal|\bpalta\b|acelga|\bapio\b|cebolla|pimiento|morron|chaucha|judia|zapallo|calabaza/.test(n)) return "vegetal_fibra";
  if (/aceitun|pepinillo|encurtido|mostaza/.test(n)) return "condimento_bajo_impacto";
  if (/\bhelad|chocolate|\bpostre|\bflan\b|budin|muffin|alfajor|galletita|galleta|\bcookie\b|\btorta\b|\bpastel\b|factura|dulce de leche|mermelada/.test(n)) return "dulce_ultraprocesado";
  if (/\bjugo\b|licuado|smoothie|gaseosa|\bcoca\b|sprite/.test(n)) return "bebida_azucarada";
  if (/\bagua\b|\bmate\b|\bcafe\b|\bte\b|infusion/.test(n)) return "bebida_sin_calorias";

  return "sin_clasificar";
}

// Componente MealIcon con soporte para ingredientes dominantes y fallback a nombre
export function MealIcon({ ingredientes = [], name = "", size = 22, color = "currentColor" }) {
  const dominante = getDominantIngredient(ingredientes);
  const targetName = dominante?.nombre || name || "";
  const category = getVisualCategory(targetName);

  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  switch (category) {
    case "burger":
      return (
        <svg {...props}>
          <path d="M4 11a8 8 0 0 1 16 0H4z" />
          <path d="M3 15h18" />
          <path d="M5 19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1H5v1z" />
          <path d="M4 14c1.5 1 2.5-1 4 0s2.5-1 4 0 2.5-1 4 0 2.5-1 4 0" />
        </svg>
      );
    case "sandwich":
      return (
        <svg {...props}>
          <path d="m3 11 18-5v5l-18 5z" />
          <path d="M3 16l18-5v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <path d="M3 11V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1" />
        </svg>
      );
    case "pasta":
      return (
        <svg {...props}>
          <path d="M3 12h18a7 7 0 0 1-14 0" />
          <path d="M6 12a6 6 0 0 0 12 0" />
          <path d="M8 8c1-2 3-2 4 0s3 2 4 0" />
          <path d="M12 4v4" />
        </svg>
      );
    case "pizza":
      return (
        <svg {...props}>
          <path d="M4 4c7-1 12 4 16 16L4 12V4z" />
          <circle cx="9" cy="8" r="1" fill={color} />
          <circle cx="12" cy="12" r="1" fill={color} />
          <circle cx="7" cy="11" r="1" fill={color} />
        </svg>
      );
    case "poultry":
      return (
        <svg {...props}>
          <path d="M15.5 5.5a5 5 0 0 0-7.07 0c-1.6 1.6-1.9 4-.9 5.8l-4.3 4.3a1.5 1.5 0 0 0 0 2.12 1.5 1.5 0 0 0 2.12 0l4.3-4.3c1.8 1 4.2.7 5.8-.9a5 5 0 0 0 .05-7.02z" />
        </svg>
      );
    case "fish":
      return (
        <svg {...props}>
          <path d="M2 16c5-1 8-5 13-5 3 0 5 2 7 5-2 3-4 5-7 5-5 0-8-4-13-5z" />
          <path d="M17 11c1-3 3-5 5-5v6" />
          <path d="M17 21c1-3 3-5 5-5v6" />
          <circle cx="7" cy="16" r="1" fill={color} />
        </svg>
      );
    case "sushi":
      return (
        <svg {...props}>
          <rect x="4" y="8" width="16" height="10" rx="4" />
          <line x1="4" y1="13" x2="20" y2="13" />
          <circle cx="12" cy="10.5" r="1" fill={color} />
        </svg>
      );
    case "meat":
      return (
        <svg {...props}>
          <path d="M14 4c3.5 0 6 2.5 6 6 0 4-3 9-9 9-4.5 0-7-2.5-7-6 0-3 2-6 5.5-6 1.5 0 2.5.5 3.5 1" />
          <circle cx="10" cy="11" r="2" />
        </svg>
      );
    case "salad":
      return (
        <svg {...props}>
          <path d="M3 11c0 5 4 9 9 9s9-4 9-9H3z" />
          <path d="M7 11a5 5 0 0 1 5-5c1.5 0 2.8.6 3.7 1.6" />
          <path d="M12 6a4 4 0 0 1 4-3c2 0 3 1.5 3 3" />
        </svg>
      );
    case "egg":
      return (
        <svg {...props}>
          <path d="M12 21c-4.5 0-8-3-8-7 0-5 3.5-10 8-10s8 5 8 10c0 4-3.5 7-8 7z" />
          <circle cx="12" cy="14" r="3" />
        </svg>
      );
    case "coffee":
      return (
        <svg {...props}>
          <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
          <path d="M3 8h14v7a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z" />
          <line x1="6" y1="2" x2="6" y2="4" />
          <line x1="10" y1="2" x2="10" y2="4" />
          <line x1="14" y1="2" x2="14" y2="4" />
        </svg>
      );
    case "drink":
      return (
        <svg {...props}>
          <path d="M6 8h12l-1.5 12h-9L6 8z" />
          <path d="M4 8h16" />
          <path d="m14 2-2 6" />
        </svg>
      );
    case "alcohol":
      return (
        <svg {...props}>
          <path d="M8 3h8l-1 6a3 3 0 0 1-6 0z" />
          <line x1="12" y1="9" x2="12" y2="20" />
          <line x1="8" y1="20" x2="16" y2="20" />
        </svg>
      );
    case "dairy":
      return (
        <svg {...props}>
          <path d="M9 2h6v3l2 3v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V8l2-3z" />
          <line x1="7" y1="12" x2="17" y2="12" />
        </svg>
      );
    case "legumbre":
      return (
        <svg {...props}>
          <path d="M4 12c0-5 4-9 8-9s8 4 8 9-4 9-8 9-8-4-8-9z" />
          <circle cx="9" cy="10" r="1.4" fill={color} />
          <circle cx="14" cy="9" r="1.4" fill={color} />
          <circle cx="11" cy="14" r="1.4" fill={color} />
          <circle cx="15.5" cy="13.5" r="1.4" fill={color} />
        </svg>
      );
    case "snack":
      return (
        <svg {...props}>
          <circle cx="7" cy="9" r="2" />
          <circle cx="13" cy="7" r="2" />
          <circle cx="17" cy="12" r="2" />
          <circle cx="9" cy="15" r="2" />
          <circle cx="15" cy="17" r="2" />
        </svg>
      );
    case "fruit":
      return (
        <svg {...props}>
          <path d="M12 20.5c-3.5 0-7-2.5-7-7.5a6 6 0 0 1 12 0c0 5-3.5 7.5-5 7.5z" />
          <path d="M12 4c0 3 2 4 4 4" />
          <path d="M12 4V2" />
        </svg>
      );
    case "rice":
      return (
        <svg {...props}>
          <path d="M3 12c0 5 4 9 9 9s9-4 9-9H3z" />
          <path d="M4 12c1-3 4-5 8-5s7 2 8 5" />
          <line x1="9" y1="3" x2="9" y2="4" />
          <line x1="15" y1="3" x2="15" y2="4" />
        </svg>
      );
    case "soup":
      return (
        <svg {...props}>
          <path d="M4 11h16a8 8 0 0 1-16 0z" />
          <path d="M2 11h20" />
          <path d="M8 4c.5 1 .5 2 0 3" />
          <path d="M12 4c.5 1 .5 2 0 3" />
          <path d="M16 4c.5 1 .5 2 0 3" />
        </svg>
      );
    case "taco":
      return (
        <svg {...props}>
          <path d="M3 16A9 9 0 0 1 21 16H3z" />
          <path d="M6 13c1.5-1 3-1 4.5 0s3 1 4.5 0 3-1 4.5 0" />
        </svg>
      );
    case "potato":
      return (
        <svg {...props}>
          <path d="M5 10l2 11h10l2-11" />
          <path d="M5 10h14" />
          <path d="M9 10a3 3 0 0 0 6 0" />
          <path d="M7 10V5a1 1 0 0 1 2 0v5" />
          <path d="M11 10V3a1 1 0 0 1 2 0v7" />
          <path d="M15 10V6a1 1 0 0 1 2 0v4" />
        </svg>
      );
    case "iceCream":
      return (
        <svg {...props}>
          <path d="M7 10a5 5 0 1 1 10 0c0 2-1.2 3.4-2.7 4.1H9.7C8.2 13.4 7 12 7 10z" />
          <path d="m10 14 2 8 2-8" />
          <path d="M9 7.5c1 .7 2 .7 3 0s2-.7 3 0" />
        </svg>
      );
    case "seeds":
      return (
        <svg {...props}>
          <ellipse cx="8" cy="8" rx="2.5" ry="4" transform="rotate(-35 8 8)" />
          <ellipse cx="16" cy="8" rx="2.5" ry="4" transform="rotate(35 16 8)" />
          <ellipse cx="8" cy="16" rx="2.5" ry="4" transform="rotate(35 8 16)" />
          <ellipse cx="16" cy="16" rx="2.5" ry="4" transform="rotate(-35 16 16)" />
        </svg>
      );
    case "nuts":
      return (
        <svg {...props}>
          <path d="M12 3c-4.5 0-7 3.5-7 8 0 5.5 3 10 7 10s7-4.5 7-10c0-4.5-2.5-8-7-8z" />
          <path d="M9 5c1.5 2 1.5 4 0 6s-1.5 4 0 7" />
          <path d="M15 5c-1.5 2-1.5 4 0 6s1.5 4 0 7" />
        </svg>
      );
    case "bakery":
      return (
        <svg {...props}>
          <path d="M4 10a8 8 0 0 1 16 0v2H4v-2z" />
          <path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
          <line x1="8" y1="12" x2="8" y2="16" />
          <line x1="12" y1="12" x2="12" y2="16" />
          <line x1="16" y1="12" x2="16" y2="16" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v8" />
          <path d="M8 12h8" />
        </svg>
      );
  }
}
