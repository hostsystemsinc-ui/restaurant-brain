// Walnut Cafe — full menu from walnutcafe.com
// Organized as categories (Breakfast, Lunch, Drinks, Kids),
// each with sections and items.

export interface MenuItem    { name: string; desc: string; price: string }
export interface MenuSection { title: string; items: MenuItem[] }
export interface MenuCategory { label: string; sections: MenuSection[] }

export const WALNUT_MENU: MenuCategory[] = [
  // ── BREAKFAST ──────────────────────────────────────────────────────────────
  {
    label: "Breakfast",
    sections: [
      {
        title: "Omelettes",
        items: [
          { name: "Denver Omelette",          desc: "Ham, bell pepper, onion, cheddar cheese",                                   price: "$15" },
          { name: "Mushroom & Spinach",        desc: "Sautéed mushrooms, fresh spinach, goat cheese",                            price: "$15" },
          { name: "Crab Omelette",             desc: "Dungeness crab, cream cheese, green onion, hollandaise",                   price: "$18" },
          { name: "Build Your Own Omelette",   desc: "Three eggs, choice of up to 4 fillings — ask your server",                 price: "$14" },
        ],
      },
      {
        title: "Favorites",
        items: [
          { name: "Huevos Rancheros",          desc: "Two eggs over easy on corn tortillas, house ranchero sauce, cotija, avocado", price: "$15" },
          { name: "Green Chile Scramble",       desc: "Scrambled eggs, roasted Hatch green chile, cheddar, breakfast potatoes",     price: "$14" },
          { name: "Breakfast Burrito",          desc: "Scrambled eggs, potatoes, cheddar, your choice of bacon or sausage, green chile", price: "$14" },
          { name: "Biscuits & Gravy",           desc: "House-made buttermilk biscuits, country sausage gravy, two eggs any style", price: "$14" },
          { name: "Chicken Fried Steak",        desc: "Hand-breaded top round, country gravy, two eggs any style, toast",          price: "$17" },
          { name: "Corned Beef Hash",           desc: "House-made corned beef, roasted potatoes, bell pepper, two eggs any style", price: "$15" },
        ],
      },
      {
        title: "Lighter Side",
        items: [
          { name: "Yogurt Parfait",             desc: "House-made granola, seasonal berries, local honey",                          price: "$10" },
          { name: "Avocado Toast",              desc: "Grilled sourdough, smashed avocado, everything bagel seasoning, two eggs",   price: "$13" },
          { name: "Fresh Fruit Bowl",           desc: "Seasonal mixed fruit, mint, honey drizzle",                                  price: "$9" },
        ],
      },
      {
        title: "Pancakes",
        items: [
          { name: "Buttermilk Stack",           desc: "Three fluffy buttermilk pancakes, maple syrup, whipped butter",              price: "$12" },
          { name: "Blueberry Pancakes",         desc: "Fresh blueberries folded in, lemon zest, powdered sugar",                   price: "$13" },
          { name: "Pumpkin Spice Pancakes",     desc: "Seasonal — house-spiced pumpkin batter, whipped cream, cinnamon",           price: "$13" },
        ],
      },
      {
        title: "Waffles",
        items: [
          { name: "Classic Belgian Waffle",     desc: "Crispy Belgian waffle, maple syrup, whipped cream",                         price: "$12" },
          { name: "Nutella Waffle",             desc: "Belgian waffle, Nutella spread, sliced banana, powdered sugar",             price: "$13" },
        ],
      },
      {
        title: "French Toast",
        items: [
          { name: "Classic French Toast",       desc: "Thick-cut brioche, cinnamon-vanilla custard, maple syrup",                  price: "$13" },
          { name: "Stuffed French Toast",       desc: "Brioche stuffed with cream cheese & seasonal jam, powdered sugar",          price: "$15" },
        ],
      },
      {
        title: "Sides",
        items: [
          { name: "Bacon",                      desc: "Two strips of thick-cut applewood bacon",                                   price: "$4" },
          { name: "Chicken Apple Sausage",      desc: "Two links",                                                                 price: "$4" },
          { name: "Breakfast Potatoes",         desc: "Seasoned, roasted with onion and bell pepper",                              price: "$4" },
          { name: "Toast",                      desc: "Sourdough, wheat, or white — served with butter and jam",                   price: "$3" },
          { name: "Two Eggs Any Style",         desc: "",                                                                          price: "$4" },
          { name: "Fresh Fruit Cup",            desc: "Seasonal mixed fruit",                                                      price: "$5" },
        ],
      },
      {
        title: "Extras",
        items: [
          { name: "Extra Omelette Filling",     desc: "Cheese, veggies, or meat — per item",                                       price: "$1.50" },
          { name: "Gluten-Free Bread",          desc: "Sub any toast or bread",                                                    price: "$2" },
          { name: "Avocado",                    desc: "Half avocado, sliced",                                                      price: "$3" },
          { name: "Hollandaise",                desc: "Side of house hollandaise sauce",                                           price: "$2" },
          { name: "Green Chile Sauce",          desc: "Side of roasted Hatch green chile",                                         price: "$1.50" },
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
          { name: "Quesadilla",                 desc: "Large flour tortilla, cheddar and jack cheese, pico de gallo, sour cream — add chicken or veggie", price: "$13" },
          { name: "Green Burrito",              desc: "Flour tortilla, rice, black beans, cheddar, roasted Hatch green chile, sour cream, choice of protein", price: "$14" },
          { name: "Fiesta Tacos",               desc: "Three soft corn tacos, choice of chicken, carnitas, or black bean, pico, cotija, lime crema",    price: "$14" },
        ],
      },
      {
        title: "Salads & Soups",
        items: [
          { name: "Classic Caesar",             desc: "Romaine, house Caesar dressing, parmesan, house-made croutons",             price: "$13" },
          { name: "Garden Salad",               desc: "Mixed greens, cucumber, tomato, red onion, carrot, your choice of dressing", price: "$11" },
          { name: "Soup of the Day",            desc: "Ask your server — served with bread",                                       price: "$9" },
        ],
      },
      {
        title: "Fancy Sandwiches",
        items: [
          { name: "Club Sandwich",              desc: "Turkey, bacon, lettuce, tomato, avocado, Swiss, mayo, toasted sourdough",   price: "$15" },
          { name: "Turkey Avocado",             desc: "Sliced turkey, avocado, Havarti, arugula, lemon aioli, ciabatta",          price: "$14" },
          { name: "Caprese",                    desc: "Fresh mozzarella, heirloom tomato, basil, balsamic glaze, focaccia",       price: "$13" },
        ],
      },
      {
        title: "Simple Sandwiches",
        items: [
          { name: "Grilled Cheese",             desc: "Cheddar and American on sourdough, tomato soup dipper",                    price: "$11" },
          { name: "BLT",                        desc: "Bacon, lettuce, tomato, mayo on toasted white",                            price: "$12" },
        ],
      },
      {
        title: "Burgers",
        items: [
          { name: "Classic Burger",             desc: "6 oz beef patty, lettuce, tomato, onion, pickles, house sauce, brioche bun", price: "$14" },
          { name: "Mushroom Swiss Burger",      desc: "6 oz beef patty, sautéed mushrooms, Swiss cheese, garlic aioli, brioche",  price: "$15" },
          { name: "Veggie Burger",              desc: "House black bean patty, lettuce, tomato, avocado, chipotle mayo, brioche", price: "$13" },
        ],
      },
    ],
  },

  // ── DRINKS ─────────────────────────────────────────────────────────────────
  {
    label: "Drinks",
    sections: [
      {
        title: "Coffee & Tea",
        items: [
          { name: "House Coffee",               desc: "Freshly brewed — free refills",                                            price: "$4" },
          { name: "Decaf Coffee",               desc: "Freshly brewed — free refills",                                            price: "$4" },
          { name: "Hot Tea",                    desc: "Assorted Harney & Sons teas",                                              price: "$4" },
        ],
      },
      {
        title: "Espresso Bar",
        items: [
          { name: "Espresso",                   desc: "Double shot",                                                              price: "$4" },
          { name: "Americano",                  desc: "Espresso, hot water",                                                      price: "$5" },
          { name: "Cappuccino",                 desc: "Espresso, steamed milk, foam",                                             price: "$6" },
          { name: "Cafe Latte",                 desc: "Espresso, steamed milk",                                                   price: "$6" },
          { name: "Mocha",                      desc: "Espresso, chocolate sauce, steamed milk",                                  price: "$6.50" },
          { name: "Boulder Latte",              desc: "Espresso, lavender syrup, oat milk, honey",                               price: "$7" },
          { name: "Matcha Latte",               desc: "Ceremonial grade matcha, steamed milk",                                   price: "$6.50" },
          { name: "Cold Brew",                  desc: "House cold brew, served over ice",                                         price: "$6" },
        ],
      },
      {
        title: "Juices & Sodas",
        items: [
          { name: "Fresh Squeezed OJ",          desc: "",                                                                         price: "$5" },
          { name: "Apple Juice",                desc: "",                                                                         price: "$4" },
          { name: "Cranberry Juice",            desc: "",                                                                         price: "$4" },
          { name: "Fountain Soda",              desc: "Coke, Diet Coke, Sprite, Ginger Ale — free refills",                      price: "$4" },
          { name: "Sparkling Water",            desc: "San Pellegrino",                                                           price: "$4" },
        ],
      },
      {
        title: "Rowdy Mermaid Kombucha",
        items: [
          { name: "Kombucha on Tap",            desc: "Rotating flavors from Rowdy Mermaid — ask your server",                   price: "$6" },
        ],
      },
      {
        title: "Kids Drinks",
        items: [
          { name: "Milk",                       desc: "Whole or 2%",                                                              price: "$3" },
          { name: "Apple Juice",                desc: "",                                                                         price: "$3" },
          { name: "Orange Juice",               desc: "",                                                                         price: "$3" },
          { name: "Hot Chocolate",              desc: "Steamed milk, house chocolate syrup, whipped cream",                      price: "$4" },
          { name: "Lemonade",                   desc: "Fresh-squeezed",                                                           price: "$4" },
        ],
      },
    ],
  },

  // ── KIDS ───────────────────────────────────────────────────────────────────
  {
    label: "Kids",
    sections: [
      {
        title: "Kids Breakfast",
        items: [
          { name: "Toad in the Hole",           desc: "Egg cooked inside buttered toast — kids' classic",                         price: "$8" },
          { name: "Flat Head Flap Face",        desc: "Two silver dollar pancakes, fruit, scrambled egg",                         price: "$9" },
          { name: "Yippee Yahoo",               desc: "Two eggs any style, bacon or sausage, toast",                              price: "$9" },
          { name: "Scrambled Brains and Bread", desc: "Scrambled eggs, toast, side of fruit",                                     price: "$8" },
        ],
      },
      {
        title: "Kids Lunch",
        items: [
          { name: "PB&J",                       desc: "Peanut butter and jelly on white bread, side of fruit",                    price: "$8" },
          { name: "Cozmik Melt-Down",           desc: "Grilled cheese on sourdough, small cup of tomato soup",                   price: "$9" },
          { name: "Kid's Quiche",               desc: "Mini quiche with seasonal filling, side salad",                            price: "$9" },
          { name: "Teeny Beanie Burrito",       desc: "Small flour tortilla, black beans, cheddar, mild salsa",                  price: "$9" },
          { name: "Cheese Frisbee",             desc: "Kid's cheese pizza on a flour tortilla, side of fruit",                   price: "$9" },
          { name: "Mac-n-Cheesy",               desc: "House-made mac & cheese with breadcrumb topping",                         price: "$9" },
        ],
      },
    ],
  },
]
