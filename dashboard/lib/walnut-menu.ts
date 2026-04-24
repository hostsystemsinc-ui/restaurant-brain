// Walnut Cafe — menu organized to exactly mirror the 4 source documents
// (Breakfast / Lunch / Drinks / Kids). Section order, titles, intro notes,
// and item prices all match the PDFs provided by the client.

export interface MenuItem    { name: string; desc: string; price: string }
export interface MenuSection { title: string; subtitle?: string; items: MenuItem[] }
export interface MenuCategory { label: string; sections: MenuSection[] }

export const WALNUT_MENU: MenuCategory[] = [
  // ── BREAKFAST ──────────────────────────────────────────────────────────────
  {
    label: "Breakfast",
    sections: [
      {
        title: "The Omelettes",
        subtitle: "All served with choice of two sides",
        items: [
          { name: "Vegetarian",         desc: "Cheddar, Mushrooms, Onions, Tomatoes & Green Peppers",                                                                         price: "$12" },
          { name: "Mexican Omelette",   desc: "Cheddar, Mushrooms, Onions, Tomatoes, Salsa, Sour Cream & Black Olives",                                                       price: "$13" },
          { name: "Denver Omelette",    desc: "Cheddar, Ham, Mushrooms, Onions, Tomatoes & Green Peppers",                                                                    price: "$14" },
          { name: "Southside Omelette", desc: "Bacon, Green Chiles, Cilantro & Cheddar",                                                                                      price: "$14" },
          { name: "APS Omelette",       desc: "Artichoke, Pesto & Swiss",                                                                                                     price: "$14" },
        ],
      },
      {
        title: "The Favorites",
        items: [
          { name: "The Basic B",           desc: "2 Eggs any way you like them served with 2 sides. Add meat for a little extra! Add bacon, pork sausage, veggie sausage, turkey sausage or ham +$3", price: "$10.50" },
          { name: "Huevos Rancheros",      desc: "2 Eggs over easy, Refried or Black Beans, Cheddar, Salsa or Green Chile, Lettuce, Tomatoes, Sour Cream & Black Olives",                             price: "$13" },
          { name: "Eggs Marcos",           desc: "2 Scrambled Eggs With Bacon, Cream Cheese & Cheddar, Served With 2 Sides",                                                                           price: "$14" },
          { name: "Big Dill Eggs",         desc: "You'll love the dill sauce! 2 eggs over easy on an English Muffin with fresh Spinach & Swiss Cheese topped with our Creamy Dill Sauce — served with 1 side. Add Ham $3", price: "$13" },
          { name: "Pesto Quesadilla",      desc: "2 Scramble Eggs, Bacon, Pesto, Red Onions, Roasted Red Peppers, Mushrooms & Mozzarella, served with lettuce, Tomatoes, Sour Cream & Salsa",          price: "$14" },
          { name: "Sunrise Sandwich",      desc: "Excellent Choice for a quick, easy meal. 2 Eggs any way you like them with your choice of Meat & Cheese on a croissant — served with 1 side",        price: "$14" },
          { name: "The Skip Scramble",     desc: "2 Scrambled Eggs, Cheddar, Mushrooms & Veggie Sausage — served with 2 sides",                                                                        price: "$14" },
          { name: "Boulder Scramble",      desc: "No Eggs in here! Tofu, Tomatoes, Onions, Mushrooms, Spinach & Cheddar — served with 2 sides",                                                        price: "$14" },
          { name: "Duzer-Rrito",           desc: "2 Scrambled Eggs with Black Beans wrapped in a Flour Tortilla topped with Salsa, Cheddar, Sour Cream & Black Olives. Served with Lettuce, Tomatoes and Breakfast Potatoes on the side. Every Breakfast Burrito ordered $1.00 is donated to the KRD fund.", price: "$13" },
          { name: "Mini-Rrito",            desc: "2 scrambled eggs, cheddar, house potatoes, and veggies or meat, in a flour tortilla. All wrapped up to eat on the go!",                              price: "$7" },
          { name: "Ranch Eggs",            desc: "2 scrambled eggs with ham, mushroom, onion, tomato & cheddar. Comes with 2 sides.",                                                                  price: "$14" },
          { name: "Quiche of the Day",     desc: "Call in to find out which quiche we have today! You get 1/4 of the whole thing and it comes with 2 sides!",                                          price: "$13" },
          { name: "Yo! Yo! Wrap",          desc: "2 scrambled eggs with breakfast potatoes, mushroom, green chiles, tomato & cheddar, wrapped in a flour tortilla. Served with 1 side.",               price: "$13" },
          { name: "Dana's Tempeh Skillet", desc: "Tempeh, breakfast potatoes, onion, tomato, mushroom, spinach & cheddar. Served with 1 side.",                                                        price: "$14" },
        ],
      },
      {
        title: "Pick Your Sides",
        items: [
          { name: "Choice",        desc: "Potatoes · Potatoes with Cheddar +$2 · Fresh Fruit all Berries +$2.25 · Fresh Fruit (no Strawberry, Kiwi, or Banana) · Babycakes Buttermilk · Babycakes: Banana Walnut, Blueberry, Blueberry Corn Bread (no GF), Chocolate Chip +$1.25 · Blueberry Corn Bread · Toast (Rye, Sourdough, White, Wheat) · Toast Gluten Free +$1.25 · Biscuit · Grits · Grits with Cheddar +$1.25 · Grits with Jalapeno +$0.75 · French Toast Whole Wheat · French Toast: Banana Walnut, Strawberry Banana, Fresh Fruit +$1.25 · English Muffin · Plain Bagel · Bagel with Cream Cheese +$1.25 · Bacon, Ham, Sausage (Pork, Turkey, Veggie or Vegan), Tofu or Tempeh +$3", price: "" },
          { name: "Substitutions", desc: "Egg Whites or Free Range Eggs", price: "$1.75" },
        ],
      },
      {
        title: "On the Lighter Side",
        items: [
          { name: "Breakfast Potatoes",                                          desc: "Hand cut red potatoes — secret seasoning that is out of this world with a nice spice!",                                                                          price: "$4.50" },
          { name: "Breakfast Potatoes with Cheddar, Salsa & Sour Cream",         desc: "Hand cut red potatoes with our secret seasoning. Topped with spicy homemade warm salsa, cheddar cheese, and sour cream",                                         price: "$6.50" },
          { name: "Breakfast Potatoes with Green Pepper, Swiss & Fresh Dill Sauce", desc: "Hand cut red potatoes with our secret seasoning. Topped with green peppers, swiss cheese, and our special dill sauce made from scratch",                      price: "$6.50" },
          { name: "Oatmeal",                                                     desc: "Yummy slow cooked kind, not instant! Comes with milk and brown sugar on the side. Add oatmeal blues, raisins & bananas, raisins, bananas, or blueberry +$0.75. Add all nuts, almonds, pecans, or walnuts +$1.50", price: "$6" },
          { name: "Homemade Sweet Roll",                                         desc: "Homemade cinnamon roll served with that great gooey icing!",                                                                                                       price: "$6" },
          { name: "House Made Sour Cream Coffee Cake",                           desc: "House made coffee cake. These are HUGE!",                                                                                                                         price: "$6" },
          { name: "Sobocado",                                                    desc: "One piece of wheat toast topped with half an avocado, one tomato slice & one egg made to order. Served with 1 side.",                                            price: "$10.50" },
          { name: "Parfait",                                                     desc: "A bowl of plain yogurt, granola, and fresh fruit.",                                                                                                              price: "$8" },
        ],
      },
      {
        title: "Sides",
        items: [
          { name: "Bacon",                 desc: "Thick cut bacon — 4 slices — can't go wrong here if you are a bacon fan!", price: "$5" },
          { name: "Bagel",                 desc: "Plain bagel",                                                              price: "$3.50" },
          { name: "Bage & Cream Cheese",   desc: "Plain bagel with cream cheese",                                            price: "$4.25" },
          { name: "Big Buttermilk Biscuit", desc: "Large, fluffy, buttermilk biscuit — kind of what you'd expect if ordering a southern biscuit", price: "$4" },
          { name: "Blueberry Corn Bread",  desc: "Cornbread with fresh blueberries added — this is made fresh every morning. Can be a single serving or shared as a group", price: "$4" },
          { name: "English Muffin",        desc: "",                                                                          price: "$3" },
          { name: "Toast",                 desc: "How do you explain toast? Two slices of bread in a toaster — HA! Rye, Sourdough, White, Wheat. Gluten free +$1.25", price: "$3" },
          { name: "Ham",                   desc: "Super tasty thick ham steak",                                               price: "$5" },
          { name: "Pork Sausage",          desc: "Spicy, made in house sausage that is finished on a charcoal grill. If you like sausage — you will love our house pork sausage", price: "$5" },
          { name: "Veggie Sausage",        desc: "Morning Star Veggie Sausage!",                                              price: "$5" },
          { name: "Sliced Banana",         desc: "",                                                                          price: "$2" },
          { name: "Sliced Apple",          desc: "",                                                                          price: "$2" },
        ],
      },
      {
        title: "Pancakes",
        subtitle: "1/2 Short – 1 pancake | Short – 2 pancakes | Tall – 3 pancakes. Make it Gluten Free Add $1.50",
        items: [
          { name: "Banana Walnut Pancakes",  desc: "Our Buttermilk Pancake batter with an abundance of Bananas and Walnuts added!", price: "1/2 Short $7.50 · Short $9.50 · Tall $11.50" },
          { name: "Blueberry Pancakes",      desc: "Our Buttermilk Pancake batter with fresh Blueberries added",                    price: "1/2 Short $7.50 · Short $9.50 · Tall $11.50" },
          { name: "Buttermilk Pancakes",     desc: "Our buttermilk pancakes are out of this world. Highly recommend!",              price: "1/2 Short $6 · Short $8 · Tall $10" },
          { name: "Chocolate Chip Pancakes", desc: "Our Buttermilk Pancake batter with Chocolate Chips added — melt in your mouth explosion!", price: "1/2 Short $7.50 · Short $9.50 · Tall $11.50" },
          { name: "Grananola Pancakes",      desc: "Banana, granola & chocolate chips",                                             price: "1/2 Short $7.50 · Short $9.50 · Tall $11.50" },
          { name: "Spicy Pumpkin Pancakes",  desc: "These pancakes taste great all year, not just in the fall!",                    price: "1/2 Short $7.50 · Short $9.50 · Tall $11.50" },
        ],
      },
      {
        title: "Waffle",
        subtitle: "Make it Gluten Free Add $1.50",
        items: [
          { name: "Plain Great Waffle",     desc: "Thick, Belgian waffle!",                                                   price: "$10" },
          { name: "Banana Walnut Waffle",   desc: "Thick, Belgian waffle loaded with bananas and walnuts on top!",            price: "$11.50" },
          { name: "Fresh Fruit",            desc: "Thick, Belgian waffle with daily, fresh cut fruit on top!",                price: "$11.50" },
          { name: "Strawberry Banana Waffle", desc: "Thick, Belgian waffle topped with strawberries and bananas!",            price: "$11.50" },
        ],
      },
      {
        title: "French Toast",
        subtitle: "Make it Gluten Free Add $1.50",
        items: [
          { name: "Cinnamon French Toast",         desc: "Choice of bread soaked in our own special egg, cinnamon mixture and cooked to perfection!", price: "$10" },
          { name: "Banana Walnut",                 desc: "Choice of bread soaked in our egg batter with a hint of cinnamon and topped with bananas and walnuts", price: "$11.50" },
          { name: "Fresh Fruit French Toast",      desc: "Choice of bread soaked in our egg batter with a hint of cinnamon and then topped with fresh, cut fruit", price: "$11.50" },
          { name: "Strawberry Banana French Toast", desc: "Cinnamon French toast topped with strawberries and bananas.",                               price: "$11.50" },
        ],
      },
      {
        title: "Extras",
        items: [
          { name: "Organic Maple Syrup", desc: "", price: "$2.25" },
        ],
      },
    ],
  },

  // ── LUNCH ──────────────────────────────────────────────────────────────────
  {
    label: "Lunch",
    sections: [
      {
        title: "Lunch Favorites",
        items: [
          { name: "Quesadillas",   desc: "Your choice of Chicken, Chorizo, Tilapia, Avocado or Steak (+$2) with Refried Beans, Green Chiles, Cilantro, and Cheddar. Served with Salsa 13, Sour Cream, and Guacamole.", price: "$12.50" },
          { name: "Green Burrito", desc: "Your choice of Chicken, Chorizo, Tilapia, Avocado or Steak (+$2) with Onion, Green Peppers, Cilantro, Mexican rice and Mozzarella wrapped in a Flour Tortilla and smothered in Green Chile. Served with Lettuce, Tomatoes, Sour Cream and Refried Beans on the side", price: "$13.50" },
          { name: "Fiesta Tacos",  desc: "3 Corn Tortillas with your choice of Chicken, Chorizo, Tilapia, Avocado or Steak (+$2) with Mexican Rice, Pico De Gallo & Queso Fresco. Served with Lettuce, Tomatoes, Sour Cream, Lime Wedges, Black Beans and Salsa 13.", price: "$14.50" },
        ],
      },
      {
        title: "Salads & Soups",
        subtitle: "Salad Dressings: Honey Mustard, Blue Cheese, Ranch, Balsamic Vinaigrette, and Spicy Santa Fe",
        items: [
          { name: "Santa Fe Chicken Salad", desc: "#1 Selling Salad! Charbroiled Chicken Breast Strips on Green Leaf Lettuce with Tomatoes, Black Beans, Cilantro, Cheddar and our Creamy Spicy Santa Fe Dressing. Served with Tortilla Chips or Grilled Tortilla", price: "$13" },
          { name: "Ruby Racer",             desc: "Fresh Spinach topped with Carrot, Red Onion, Tomato, Artichoke, Feta, Walnuts & Craisins. Served with a grilled flour tortilla and Balsamic Vinaigrette.", price: "$13" },
          { name: "Green Chili",            desc: "Santa Fe Style Green Chile. It's vegetarian & gluten free!", price: "Cup $3 · Bowl $4" },
        ],
      },
      {
        title: "Fancy Sandwiches",
        subtitle: "Choice of Potato Chips, Corn Chips, or an Apple. Add Tossed Salad +$2.95 | Breakfast Potatoes +$2.50 | Make it Gluten-Free Add $1.50",
        items: [
          { name: "Club Sandwich", desc: "Top seller sandwich! 3 slices of toasted sourdough with turkey, ham, bacon, swiss, cheddar, lettuce, tomatoes, and mayo", price: "$13.50" },
          { name: "Heart Melt",    desc: "Sauteed artichoke hearts, mushrooms, black olives, and melted Swiss, served on grilled rye",                             price: "$12" },
        ],
      },
      {
        title: "Simple Sandwiches",
        subtitle: "Choice of Potato Chips, Corn Chips, or an Apple. Add Tossed Salad +$2.95 | Breakfast Potatoes +$2.50 | Make it Gluten-Free Add $1",
        items: [
          { name: "B.L.T.",            desc: "Bacon, lettuce, and tomato sandwich served on toasted sourdough bread",                           price: "$10" },
          { name: "Tuna Salad & Swiss", desc: "Tuna and Swiss sandwich served on your choice of bread along with lettuce, tomato, and mayo",   price: "$9" },
        ],
      },
      {
        title: "Burgers",
        subtitle: "Choice of Potato Chips, Corn Chips, or an Apple. Add Tossed Salad +$2.95 | Breakfast Potatoes +$2.50 | Make it Gluten-Free Add $1",
        items: [
          { name: "Beef Burger (GFO)",   desc: "Angus beef burger grilled on a bun with lettuce, tomato, mayo, and pickles",                       price: "$13" },
          { name: "Beyond Burger (GFO)", desc: "100% plant based burger grilled and served on a bun with lettuce, tomato, mayo, and pickles",      price: "$13" },
          { name: "Add-Ons",             desc: "Add Cheddar, Swiss, Mozzarella, Pepper Jack or Daiya $1.50 · Add Bacon $3",                        price: "" },
          { name: "Chicken Burger",      desc: "Same as the beef burger but with chicken!",                                                         price: "$13" },
        ],
      },
    ],
  },

  // ── DRINKS ─────────────────────────────────────────────────────────────────
  {
    label: "Drinks",
    sections: [
      {
        title: "Juices, Sodas & More",
        items: [
          { name: "House Coffee",         desc: "Delicious OZO Coffee! We will leave room so you can doctor it yourself! Flavors: vanilla, caramel, hazelnut, coconut, almond, walnutty, frosted mint, Irish cream, cinnamon, sugar free vanilla, pumpkin +$0.75. Flavors: chocolate +$0.50", price: "$3.75" },
          { name: "Decaf",                desc: "Delicious OZO Coffee, but with less caffeine!",                                                     price: "$3.75" },
          { name: "12 oz Orange Juice",   desc: "",                                                                                                  price: "$3.95" },
          { name: "12 oz Apple Juice",    desc: "",                                                                                                  price: "$2.95" },
          { name: "Iced Tea",             desc: "",                                                                                                  price: "$3.50" },
          { name: "Lemonade",             desc: "",                                                                                                  price: "$3.50" },
          { name: "Teamonade",            desc: "",                                                                                                  price: "$4" },
          { name: "Coke, Diet Coke",      desc: "",                                                                                                  price: "$3" },
          { name: "12 oz Milk",           desc: "2%, skim, whole milk. Almond, soy, oat milk +$0.75",                                                price: "$2.75" },
          { name: "12 oz Chocolate Milk", desc: "2%, skim, whole milk. Almond, soy, oat milk $0.75",                                                 price: "$3.25" },
        ],
      },
      {
        title: "Rowdy Mermaid",
        items: [
          { name: "Alpine Lavender", desc: "Tumeric, ginger, fennel, fennugreek", price: "$4.95" },
        ],
      },
      {
        title: "Kid's Drinks",
        items: [
          { name: "Kid's Hot Chocolate",  desc: "Made in house creamy, rich, topped with whipped cream.",                   price: "$2.50" },
          { name: "Kid's Lemonade",       desc: "Refreshing lemonade — kind you buy at a lemonade stand",                   price: "$2.50" },
          { name: "Kid's Apple Juice",    desc: "Organic apple juice that is the perfect size for a young one!",            price: "$2.25" },
          { name: "Kid's Orange Juice",   desc: "Organic orange juice that is the perfect size for a little one!",          price: "$2.50" },
          { name: "Kid's Milk",           desc: "Milk to help the bones grow strong",                                       price: "$2.25" },
          { name: "Kid's Chocolate Milk", desc: "Made in house and not from a mix — creamy and chocolatey!",                price: "$2.50" },
          { name: "Almond, soy, oat milk", desc: "",                                                                        price: "+$0.75" },
        ],
      },
      {
        title: "Espresso Bar",
        items: [
          { name: "Boulder Latte",        desc: "#1 seller! Double shot of espresso with steamed milk, vanilla and honey, topped with cinnamon",  price: "$5.50" },
          { name: "Espresso",             desc: "Straight pure shot of espresso",                                                                 price: "$3" },
          { name: "Americano",            desc: "Double shot of espresso with hot water",                                                         price: "$3.75" },
          { name: "Cappuccino",           desc: "Double shot of espresso with steamed milk and foam in a short cup",                              price: "$4.25" },
          { name: "Cafe Latte",           desc: "Double shot of espresso with steamed milk and foam",                                             price: "$4.50" },
          { name: "Mocha Latte",          desc: "YUM! Double shot of espresso with steamed hot cocoa, topped with whip cream",                    price: "$5.50" },
          { name: "Aulait",               desc: "House coffee with steamed milk",                                                                  price: "$3.95" },
          { name: "Florentine",           desc: "House coffee with steamed hot cocoa",                                                             price: "$4.50" },
          { name: "Hazelnut Mocha Latte", desc: "Double shot of espresso with steamed hot cocoa and hazelnut, topped with whipped cream",          price: "$5.50" },
          { name: "Caramelita Latte",     desc: "Double shot of espresso with steamed milk and caramel, topped with whipped cream and caramel sauce", price: "$5.50" },
          { name: "Walnutty Latte",       desc: "Double shot of espresso with steamed milk, hazelnut, coconut and almond, topped with nutmeg",     price: "$5.50" },
          { name: "Black and White",      desc: "Double shot of espresso with steamed milk, vanilla and chocolate sauce",                          price: "$5.50" },
          { name: "Mind Eraser",          desc: "Triple shot of espresso and house coffee. We will leave room so you can dress it up yourself!",   price: "$5.50" },
          { name: "Sherpa Chai",          desc: "A blend of fiery species, organic ginger and black tea and milk.",                                price: "$4.75" },
          { name: "Chocolate Chai",       desc: "Everything's better with chocolate. Steamed Oregon Chai with chocolate sauce",                    price: "$4.95" },
          { name: "Dana D's Vanilla Blast", desc: "Double shot of espresso, vanilla and a secret. Served over ice. Not available in decaf because it has Dana's name on it!", price: "$5.50" },
          { name: "Dana D's Vanilla Blast Off", desc: "Double shot of espresso, vanilla and a secret. Served over ice. With a triple shot of espresso on top to deliver it's punch. Not available in decaf because it has Dana's name on it!", price: "$5.95" },
          { name: "Cambric",              desc: "Earl grey tea with steamed milk and honey",                                                       price: "$4.25" },
          { name: "Steamed Hot Chocolate", desc: "Made in house rich and creamy, topped with whipped cream",                                       price: "$3.95" },
          { name: "Add-Ons",              desc: "Almond, oat, soy milk $0.75 · Flavors (vanilla, caramel, hazelnut, coconut, almond, walnutty, frosted mint, Irish cream, cinnamon, sugar free vanilla, pumpkin) $0.75 · Flavors (chocolate) $0.50 · Single Shot $1 · Double Shot $1.50 · Triple Shot $2.25", price: "" },
        ],
      },
    ],
  },

  // ── KIDS ───────────────────────────────────────────────────────────────────
  {
    label: "Kids",
    sections: [
      {
        title: "Breakfast $7",
        subtitle: "Side choices: potato chips, banana slices, apple slices, or banana bread | Make it gluten-free +$1.50",
        items: [
          { name: "Toad in the Hole",           desc: "Yum… Grilled bread with an egg in the middle served with one side",                                    price: "" },
          { name: "Flat Head Flap Face",        desc: "Funny face pancake — perfect for a little one that wants pancakes for breakfast or lunch!",            price: "" },
          { name: "Yippee Yahoo",               desc: "One slice of french toast served with two slices of bacon",                                            price: "" },
          { name: "Scrambled Brains and Bread", desc: "One scrambled egg with a slice of toast — one of our top sellers",                                     price: "" },
        ],
      },
      {
        title: "Lunch $7",
        subtitle: "Side choices: potato chips, banana slices, apple slices, or banana bread | Make it gluten-free +$1.50",
        items: [
          { name: "PB&J",                desc: "Peanut Butter & Jelly with a pickle spear and potato chips on the side",            price: "" },
          { name: "Cozmik Melt-Down",    desc: "Grilled cheese with cheddar and sourdough. A pickle spear and potato chips on the side.", price: "" },
          { name: "Kid's Quiche & Toast", desc: "1/8 piece of quiche with a slice of toast",                                          price: "" },
          { name: "Teeny Beanie Burrito", desc: "Cheddar and refried beans rolled in a flour tortilla with potato chips on the side", price: "" },
          { name: "Cheese Frisbee",      desc: "Open faced tortilla with melted cheddar. A pickle spear and potato chips on the side", price: "" },
          { name: "Mac-N-Cheesy",        desc: "A simple and delicious kid sized bowl of Mac & Cheese",                               price: "" },
        ],
      },
    ],
  },
]
