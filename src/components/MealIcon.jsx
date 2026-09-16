import React from "react";

// Categorizador inteligente de comidas basado en palabras clave
export function getMealCategory(nombre = "") {
  const n = nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (/hamburguesa|burger|cheeseburger|medallon/.test(n)) return "burger";
  if (/sandwich|sanduich|tostado|lomito|wrap|bagel|torta de/.test(n)) return "sandwich";
  if (/fideo|pasta|tallarin|espagueti|spaghetti|ravioli|raviol|gnocchi|noqui|lasagna|lasana|canelon|fetuccin|penne|macarron/.test(n)) return "pasta";
  if (/pizza|empanada|calzone|focaccia|fugazza|tarta/.test(n)) return "pizza";
  if (/pollo|pechuga|alita|patamuslo|suprema|nugget|pavo/.test(n)) return "poultry";
  if (/pescado|salmon|atun|merluza|sushi|marisco|camaron|langostino|rabas|calamar|paella/.test(n)) return "fish";
  if (/carne|bife|asado|costilla|vacio|lomo|matambre|entrecot|churrasco|milanesa|cerdo|bondiola|vaca|ternera|colita/.test(n)) return "meat";
  if (/ensalada|lechuga|rucula|tomate|pepino|zanahoria|brocoli|espinaca|verdura|vegetal|palta|guacamole/.test(n)) return "salad";
  if (/huevo|omelette|revuelto|frito|pochado|tortilla|panqueque|pancake|waffle/.test(n)) return "egg";
  if (/cafe|te |te$|mate|cappuccino|cortado|infusion|latte|espresso|mocha/.test(n)) return "coffee";
  if (/jugo|licuado|smoothie|agua|gaseosa|coca|sprite|cerveza|vino|trago|coctel|bebida/.test(n)) return "drink";
  if (/manzana|banana|fruta|naranja|frutilla|mandarina|uva|pera|kiwi|durazno|arandano|sandia|melon/.test(n)) return "fruit";
  if (/arroz|risotto|wok|quinoa|legumbre|lenteja|garbanzo|poroto|frijol/.test(n)) return "rice";
  if (/sopa|guiso|cazuela|estofado|locro|caldo|ramen|puchero/.test(n)) return "soup";
  if (/taco|burrito|quesadilla|fajita|nachos/.test(n)) return "taco";
  if (/pan|medialuna|croissant|torta|pastel|factura|galletita|galleta|cookie|alfajor|helado|chocolate|postre|flan|budin|muffin/.test(n)) return "bakery";

  return "default";
}

export function MealIcon({ name = "", size = 22, color = "currentColor" }) {
  const category = getMealCategory(name);
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
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
