/** Café menu — prices in ZAR (whole rands). */

export type MenuItem = {
  name: string;
  price: number;
  description?: string;
};

export type MenuSection = {
  id: string;
  title: string;
  /** Optional script-style subtitle (e.g. Treats) */
  accent?: string;
  items: MenuItem[];
  /** Flat extras row under the section */
  sides?: string;
};

export type MenuCategory = {
  id: "breakfast" | "lunch" | "brews";
  label: string;
  sections: MenuSection[];
};

export const MENU_CATEGORIES: MenuCategory[] = [
  {
    id: "breakfast",
    label: "Breakfast",
    sections: [
      {
        id: "breakfast-mains",
        title: "Breakfast",
        items: [
          {
            name: "Classic breakfast",
            price: 149,
            description:
              "two eggs / back bacon / grilled tomato / served with toast / mushrooms / sausage",
          },
          {
            name: "Omelette",
            price: 175,
            description:
              "diced bacon / mozzarella / cheddar cheese / feta / basil pesto / avo",
          },
          {
            name: "Breakfast bagel",
            price: 160,
            description:
              "buttered & toasted bagel / back bacon / eggs / feta / basil pesto / avo / rocket",
          },
          {
            name: "Cream cheese bagel",
            price: 54,
            description: "Toasted bagel with cream cheese. Build your own with add-ons.",
          },
          {
            name: "Smashed Egg Avo on Toast",
            price: 90,
            description:
              "sourdough / eggs / avo / feta / served with roasted tomatoes & rocket",
          },
          {
            name: "Egg Benedict Bacon",
            price: 170,
            description:
              "two poached eggs / toasted brioche / back bacon / hollandaise / baby spinach / pepperdew / sun dried tomatoes",
          },
          {
            name: "Egg steak stack Fillet",
            price: 195,
            description:
              "grilled steak / grilled onions / mushrooms / grilled tomatoes topped with an egg",
          },
          {
            name: "Breakfast Dip bowl",
            price: 145,
            description:
              "Savory beef mince / 2 eggs / avo / sourdough toast / in-house dip",
          },
        ],
      },
      {
        id: "treats",
        title: "Treats",
        accent: "Treats",
        items: [
          {
            name: "French toast",
            price: 155,
            description: "mixed berries / honey / cinnamon / mascarpone cream",
          },
          { name: "Croissant plain", price: 28 },
          { name: "Croissant chocolate / almond", price: 32 },
          {
            name: "Cake",
            price: 76,
            description: "baked cheese / chocolate / caramel cheese",
          },
        ],
      },
      {
        id: "sides",
        title: "Sides",
        accent: "sides",
        items: [],
        sides:
          "pork sausage +18 · vienna +12 · skinny fries +22 · back bacon +15 · egg +12 · mushrooms +17 · sourdough toast +12 · cream cheese +10 · pepperdew +8 · sun-dried tomatoes +10 · feta / olives / spring onions / cucumber +8 · pesto +10",
      },
    ],
  },
  {
    id: "lunch",
    label: "Lunch",
    sections: [
      {
        id: "lunch-mains",
        title: "Lunch",
        items: [
          {
            name: "Grilled Chicken & Avo Salad bowl",
            price: 175,
            description:
              "Grilled chicken breast, avocado, feta, cucumber, cherry tomatoes, and lettuce, served with a light lemon-herb dressing",
          },
          {
            name: "Coast fish tacos",
            price: 185,
            description:
              "3 soft tortillas filled with crispy fish, crisp slaw, guacamole, fresh pico de gallo",
          },
          {
            name: "Seared Salmon salad",
            price: 195,
            description:
              "norwegian salmon / cabbage / edamame / sriracha mayo / avo / pickled ginger / radish",
          },
          {
            name: "Chicken Alfredo pasta",
            price: 185,
            description: "seared chicken fillet with creamy fettuccine pasta",
          },
          {
            name: "Sweet Potato, Cottage Cheese & Beef Bowl",
            price: 175,
            description: "lean beef / sweet potatoes / cottage cheese / hot honey",
          },
          {
            name: "Wing & chips (6)",
            price: 105,
            description:
              "crispy chicken wings served with fries · Flavours: bbq / lemon pepper / peri",
          },
          {
            name: "Wing & chips (10)",
            price: 180,
            description:
              "crispy chicken wings served with fries · Flavours: bbq / lemon pepper / peri",
          },
          {
            name: "Short ribs & wings",
            price: 190,
            description: "ribs / 6 full wings served with fries",
          },
          {
            name: "Lamb chops with creamy mash",
            price: 235,
            description:
              "Succulent grilled lamb cutlets served with creamy mashed potato, seasonal green beans",
          },
          {
            name: "Grilled Sirloin Steak",
            price: 270,
            description:
              "Juicy grilled sirloin steak served with roasted baby potatoes, glazed carrots, and mushroom sauce",
          },
          {
            name: "T-Bone Steak with Loaded Potatoes & asparagus",
            price: 285,
            description:
              "Flame-grilled T-bone steak served with charred asparagus & a loaded baked potato",
          },
          {
            name: "Beef burger & fries",
            price: 185,
            description:
              "Grilled ground beef patty, cheese, lettuce, tomato, mustard and our famous BBQ & in-house sauce",
          },
          {
            name: "Toasted chicken sandwich",
            price: 135,
            description:
              "Sourdough, scrambled eggs, chicken, bacon, sun-dried tomatoes, cheese, in-house sauce",
          },
        ],
      },
    ],
  },
  {
    id: "brews",
    label: "Beans & Brews",
    sections: [
      {
        id: "hot",
        title: "Hot",
        items: [
          {
            name: "Americano",
            price: 39,
            description: "double shot espresso / hot water",
          },
          {
            name: "Caffè latte",
            price: 44,
            description: "single shot espresso / steamed milk",
          },
          {
            name: "Cappuccino single shot",
            price: 39,
            description: "single shot espresso / steamed milk",
          },
          {
            name: "Cappuccino double shot",
            price: 45,
            description: "double shot espresso / steamed milk",
          },
          {
            name: "Matcha latte",
            price: 64,
            description: "matcha shot / steamed milk",
          },
          {
            name: "Rooibos / Five Roses",
            price: 28,
            description: "black tea / hot milk",
          },
        ],
      },
      {
        id: "cold",
        title: "Cold",
        items: [
          {
            name: "Iced latte",
            price: 47,
            description:
              "single shot espresso / cold milk / syrup (caramel / hazelnut / vanilla)",
          },
          {
            name: "Matcha latte",
            price: 68,
            description: "plain / caramel / hazelnut / vanilla / cinnamon",
          },
        ],
      },
    ],
  },
];

export const CAR_WASH_INFO = {
  tagline: "Drive clean. Feel great.",
  note: "Get your car cleaned while you enjoy your meal and drinks.",
  reservation:
    "Limited to guests with a café reservation. Pre-book a slot for your car to be washed.",
  pricing: [
    { id: "hatch", label: "Small car", detail: "3 door", price: 80 },
    { id: "sedan", label: "Medium car", detail: "5 door", price: 100 },
    { id: "suv", label: "SUV / Bakkie", detail: "Larger vehicles", price: 120 },
  ],
  includes: [
    { title: "Exterior wash", detail: "Thorough hand wash" },
    { title: "Wheels cleaned", detail: "Rims and tyres cleaned" },
    { title: "Windows cleaned", detail: "Inside & outside" },
    { title: "Tyre shine", detail: "Tyres dressed for a clean finish" },
    { title: "Vacuum interior", detail: "Floors and seats" },
    { title: "Quality finish", detail: "Attention to detail every time" },
  ],
} as const;

export function formatZar(amount: number): string {
  return `R${amount}`;
}
