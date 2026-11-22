/**
 * Seed « Sfax » — jeu de données réaliste et cohérent pour le développement.
 *
 * Usage :  npm run seed:sfax
 *
 * Ce script est LA source unique de données de test. Il est rejouable à volonté :
 *  1. Il purge toutes les données métier (commandes, restaurants, catalogue,
 *     zones, comptes, notifications, wallets, etc.).
 *  2. Il préserve les liens Clerk existants (clerkId) par email/username afin
 *     que les connexions admin/vendor/rider/customer continuent de fonctionner.
 *  3. Il recrée un environnement complet centré sur Sfax (Tunisie) :
 *     configuration en TND (3 décimales), zone de livraison « Sfax Ville »,
 *     cuisines, 5 restaurants avec menus réels, 3 livreurs, 2 clients avec
 *     adresses géolocalisées dans la zone — prêt pour passer des commandes.
 *
 * Comptes après seed (mot de passe partout : password123) :
 *   Admin       : admin@enatega.com
 *   Vendors     : vendor@enatega.com, hsouna@gmail.com,
 *                 vendor.pizza@enatega-test.com, vendor.masmoudi@enatega-test.com
 *   Stores      : lecorail / lasquadra / baguette.sfax / sidimansour / masmoudi
 *   Riders      : ayadi / rider.sfax / rider / rider.sidimansour
 *   Customers   : issam.ayadi.ext@gmail.com, customer.sfax@enatega-test.com
 */
import 'dotenv/config';
import mongoose, { Types } from 'mongoose';
import { hashPassword } from '../common/crypto.util';

// ── Constantes géographiques (Sfax, Tunisie) ────────────────────────────────
// Rectangle couvrant le grand Sfax, de la Corniche à Sidi Mansour et Gremda.
// GeoJSON : [longitude, latitude].
const SFAX_ZONE_RING: number[][] = [
  [10.68, 34.68],
  [10.83, 34.68],
  [10.83, 34.81],
  [10.68, 34.81],
  [10.68, 34.68],
];

const TIMEZONE = 'Africa/Tunis';
const CURRENCY = 'TND';
const MONEY_SCALE = 3; // le dinar tunisien a 3 décimales (millimes)
const PASSWORD = 'password123';

const toMinor = (value: number): number => Math.round(value * 10 ** MONEY_SCALE);

const DAY_CODES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const openingTimes = (start: string, end: string) =>
  DAY_CODES.map((day) => ({ day, times: [{ startTime: start, endTime: end }] }));

// ── Images (Unsplash, URLs vérifiées 200) ───────────────────────────────────
const img = (id: string, w = 800): string =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

const IMG = {
  pizza: img('1513104890138-7c749659a591'),
  pizzaOven: img('1574071318508-1cdbab80d002'),
  pizzaCheese: img('1593560708920-61dd98c46a4e'),
  burger: img('1568901346375-23c9450c58cd'),
  sandwich: img('1528735602780-2552fd46c7af'),
  seafoodPlatter: img('1559339352-11d035aa65de'),
  grilledFish: img('1615141982883-c7ad0e69fd62'),
  shrimp: img('1565680018434-b513d5e5fd47'),
  stew: img('1547592180-85f173990554'),
  riceDish: img('1512058564366-18510be2db19'),
  pasta: img('1621996346565-e3dbc646d9a9'),
  pastaBowl: img('1551183053-bf91a1d81141'),
  salad: img('1512621776951-a57141f2eefd'),
  dessert: img('1551024506-0bccd828d307'),
  cake: img('1578985545062-69928b1d9587'),
  coffee: img('1509042239860-f550ce710b93'),
  juice: img('1437418747212-8d9709afab22'),
  bbq: img('1544025162-d76694265947'),
  lambChops: img('1529193591184-b1d58069ecdd'),
  soup: img('1547592166-23ac45744acd'),
  fries: img('1573080496219-bb080dd4f877'),
  restaurantInterior: img('1517248135467-4c7edcad34c4'),
  restaurantTerrace: img('1555396273-367ea4eb4db5'),
  restaurantCosy: img('1552566626-52f8b828add9'),
  fineDining: img('1414235077428-338989a2e8c0'),
  bakery: img('1517433670267-08bbd4be890f'),
  fastFood: img('1561758033-d89a9ad46330'),
  pizzeria: img('1579751626657-72bc17010498'),
  couscous: img('1603133872878-684f208fb84b'),
  grilledChicken: img('1532550907401-a500c9a57435'),
  shakshuka: img('1584278860047-22db9ff82bed'),
  lemonade: img('1523677011781-c91d1bbe2f9e'),
  orangeJuice: img('1613478223719-2ab802602423'),
  cheesecake: img('1533134242443-d4fd215305ad'),
  fruitTart: img('1464305795204-6f5bbfc7fb81'),
  viennoiserie: img('1549903072-7e6e0bedb7fb'),
  baklava: img('1519676867240-f03562e64548'),
  tea: img('1626074353765-517a681e40be'),
  soda: img('1571877227200-a0d98ea607e9'),
};

// Affecte automatiquement une image cohérente à chaque plat d'après son titre.
const FOOD_IMAGE_RULES: [RegExp, string][] = [
  [/pizza/i, IMG.pizza],
  [/couscous/i, IMG.couscous],
  [/brik|ojja|kafteji/i, IMG.shakshuka],
  [/crevette/i, IMG.shrimp],
  [/daurade|loup|rouget|sole|poisson/i, IMG.grilledFish],
  [/calamar|friture|poulpe|fruits de mer/i, IMG.seafoodPlatter],
  [/salade/i, IMG.salad],
  [/spaghetti|penne|lasagne|pâtes/i, IMG.pasta],
  [/makloub|chapati|baguette|libanais|sandwich/i, IMG.sandwich],
  [/frites/i, IMG.fries],
  [/nuggets|escalope|cordon|poulet|dinde/i, IMG.grilledChicken],
  [/grillade|côtelette|merguez|agneau/i, IMG.lambChops],
  [/chorba|lablabi|soupe/i, IMG.soup],
  [/mloukhia|kamounia/i, IMG.stew],
  [/riz/i, IMG.riceDish],
  [/baklawa|kaak|makroudh|assortiment|zriga|assida/i, IMG.baklava],
  [/mille-feuille|éclair/i, IMG.viennoiserie],
  [/tarte/i, IMG.fruitTart],
  [/cheesecake/i, IMG.cheesecake],
  [/café|cappuccino/i, IMG.coffee],
  [/thé/i, IMG.tea],
  [/citronnade/i, IMG.lemonade],
  [/jus/i, IMG.orangeJuice],
  [/boga|coca|eau/i, IMG.soda],
];

const foodImage = (title: string): string => {
  for (const [pattern, url] of FOOD_IMAGE_RULES) {
    if (pattern.test(title)) return url;
  }
  return IMG.stew;
};

// ── Types du jeu de données déclaratif ──────────────────────────────────────

interface SeedOption {
  key: string;
  title: string;
  price: number;
}

interface SeedAddon {
  key: string;
  title: string;
  description?: string;
  quantityMinimum: number;
  quantityMaximum: number;
  optionKeys: string[];
}

interface SeedVariation {
  title: string;
  price: number;
  addonKeys?: string[];
}

interface SeedFood {
  title: string;
  description?: string;
  variations: SeedVariation[];
}

interface SeedCategory {
  title: string;
  foods: SeedFood[];
}

interface SeedRestaurant {
  name: string;
  slug: string;
  image: string;
  logo: string;
  username: string;
  orderPrefix: string;
  address: string;
  phone: string;
  shopCategory: string;
  cuisines: string[];
  location: [number, number]; // [lon, lat]
  minimumOrder: number;
  deliveryTime: number;
  openingStart: string;
  openingEnd: string;
  ownerEmail: string;
  categories: SeedCategory[];
  addons: SeedAddon[];
  options: SeedOption[];
}

// ── Menus réels (prix en dinars tunisiens) ──────────────────────────────────

const RESTAURANTS: SeedRestaurant[] = [
  {
    name: 'Le Corail',
    slug: 'le-corail',
    image: IMG.seafoodPlatter,
    logo: IMG.grilledFish,
    username: 'lecorail',
    orderPrefix: 'COR-',
    address: 'Route de la Corniche, Sfax 3000',
    phone: '+216 74 223 110',
    shopCategory: 'poisson',
    cuisines: ['Poisson & Fruits de mer', 'Tunisienne'],
    location: [10.777, 34.757],
    minimumOrder: 15,
    deliveryTime: 40,
    openingStart: '11:00',
    openingEnd: '23:00',
    ownerEmail: 'hsouna@gmail.com',
    options: [
      { key: 'frites', title: 'Frites maison', price: 3 },
      { key: 'riz', title: 'Riz', price: 3 },
      { key: 'salade', title: 'Salade verte', price: 2.5 },
      { key: 'legumes', title: 'Légumes grillés', price: 4 },
      { key: 'harissa', title: 'Harissa maison', price: 0.5 },
      { key: 'sauce-blanche', title: 'Sauce blanche', price: 1 },
      { key: 'citron', title: 'Citron', price: 0 },
    ],
    addons: [
      {
        key: 'accompagnements',
        title: 'Accompagnements',
        description: 'Choisissez jusqu’à deux accompagnements',
        quantityMinimum: 0,
        quantityMaximum: 2,
        optionKeys: ['frites', 'riz', 'salade', 'legumes'],
      },
      {
        key: 'sauces',
        title: 'Sauces',
        quantityMinimum: 0,
        quantityMaximum: 2,
        optionKeys: ['harissa', 'sauce-blanche', 'citron'],
      },
    ],
    categories: [
      {
        title: 'Entrées de la mer',
        foods: [
          { title: 'Salade méchouia', description: 'Poivrons et tomates grillés, thon, œuf', variations: [{ title: 'Portion', price: 8 }] },
          { title: 'Brik à l’œuf', variations: [{ title: 'Pièce', price: 3.5 }] },
          { title: 'Brik au thon', variations: [{ title: 'Pièce', price: 4.5 }] },
          { title: 'Salade de poulpe', description: 'Poulpe frais, persil, citron, huile d’olive', variations: [{ title: 'Portion', price: 12 }] },
          { title: 'Crevettes sautées à l’ail', variations: [{ title: 'Portion', price: 18 }] },
        ],
      },
      {
        title: 'Poissons grillés',
        foods: [
          {
            title: 'Daurade royale grillée',
            description: 'Pêche du jour, servie avec citron',
            variations: [
              { title: '400 g', price: 28, addonKeys: ['accompagnements', 'sauces'] },
              { title: '600 g', price: 38, addonKeys: ['accompagnements', 'sauces'] },
            ],
          },
          { title: 'Loup de mer grillé', variations: [{ title: 'Pièce (~500 g)', price: 32, addonKeys: ['accompagnements', 'sauces'] }] },
          { title: 'Rouget grillé', variations: [{ title: 'Portion', price: 24, addonKeys: ['accompagnements', 'sauces'] }] },
          { title: 'Sole meunière', variations: [{ title: 'Pièce', price: 26, addonKeys: ['accompagnements'] }] },
        ],
      },
      {
        title: 'Fruits de mer',
        foods: [
          { title: 'Crevettes royales grillées', variations: [{ title: 'Portion (6 pièces)', price: 45, addonKeys: ['accompagnements', 'sauces'] }] },
          { title: 'Calamars farcis', variations: [{ title: 'Portion', price: 30 }] },
          { title: 'Ojja aux crevettes', description: 'Œufs, tomate, piment, crevettes', variations: [{ title: 'Portion', price: 22 }] },
          { title: 'Friture de calamars', variations: [{ title: 'Portion', price: 20, addonKeys: ['sauces'] }] },
        ],
      },
      {
        title: 'Couscous & riz',
        foods: [
          { title: 'Couscous au poisson', description: 'Mérou ou daurade selon arrivage', variations: [{ title: 'Portion', price: 25 }] },
          { title: 'Couscous aux fruits de mer', variations: [{ title: 'Portion', price: 30 }] },
          { title: 'Riz aux fruits de mer', variations: [{ title: 'Portion', price: 24 }] },
        ],
      },
      {
        title: 'Boissons',
        foods: [
          { title: 'Eau minérale 1L', variations: [{ title: 'Bouteille', price: 2 }] },
          { title: 'Boga Cidre', variations: [{ title: 'Canette 33cl', price: 2.5 }] },
          { title: 'Coca-Cola', variations: [{ title: 'Canette 33cl', price: 2.5 }] },
          { title: 'Citronnade fraîche', variations: [{ title: 'Verre 40cl', price: 4 }] },
        ],
      },
    ],
  },
  {
    name: 'Pizzeria La Squadra',
    slug: 'la-squadra',
    image: IMG.pizzeria,
    logo: IMG.pizza,
    username: 'lasquadra',
    orderPrefix: 'SQD-',
    address: 'Route Gremda km 0.5, Sfax 3027',
    phone: '+216 74 402 250',
    shopCategory: 'pizzeria',
    cuisines: ['Pizza & Pâtes'],
    location: [10.748, 34.753],
    minimumOrder: 10,
    deliveryTime: 30,
    openingStart: '11:00',
    openingEnd: '23:30',
    ownerEmail: 'vendor.pizza@enatega-test.com',
    options: [
      { key: 'fromage', title: 'Fromage extra', price: 2 },
      { key: 'champignons', title: 'Champignons', price: 1.5 },
      { key: 'oeuf', title: 'Œuf', price: 1 },
      { key: 'thon', title: 'Thon', price: 3 },
      { key: 'jambon', title: 'Jambon de dinde', price: 2.5 },
      { key: 'olives', title: 'Olives', price: 1 },
    ],
    addons: [
      {
        key: 'supplements-pizza',
        title: 'Suppléments pizza',
        quantityMinimum: 0,
        quantityMaximum: 4,
        optionKeys: ['fromage', 'champignons', 'oeuf', 'thon', 'jambon', 'olives'],
      },
    ],
    categories: [
      {
        title: 'Pizzas',
        foods: [
          { title: 'Pizza Margherita', description: 'Sauce tomate, mozzarella, origan', variations: [
            { title: 'Moyenne', price: 9, addonKeys: ['supplements-pizza'] },
            { title: 'Large', price: 14, addonKeys: ['supplements-pizza'] },
          ] },
          { title: 'Pizza Thon', description: 'Thon, oignons, olives, mozzarella', variations: [
            { title: 'Moyenne', price: 12, addonKeys: ['supplements-pizza'] },
            { title: 'Large', price: 18, addonKeys: ['supplements-pizza'] },
          ] },
          { title: 'Pizza Quatre Fromages', variations: [
            { title: 'Moyenne', price: 14, addonKeys: ['supplements-pizza'] },
            { title: 'Large', price: 21, addonKeys: ['supplements-pizza'] },
          ] },
          { title: 'Pizza Pepperoni', variations: [
            { title: 'Moyenne', price: 13, addonKeys: ['supplements-pizza'] },
            { title: 'Large', price: 19, addonKeys: ['supplements-pizza'] },
          ] },
          { title: 'Pizza Fruits de mer', description: 'Crevettes, calamars, moules', variations: [
            { title: 'Moyenne', price: 16, addonKeys: ['supplements-pizza'] },
            { title: 'Large', price: 24, addonKeys: ['supplements-pizza'] },
          ] },
          { title: 'Pizza Végétarienne', variations: [
            { title: 'Moyenne', price: 11, addonKeys: ['supplements-pizza'] },
            { title: 'Large', price: 16, addonKeys: ['supplements-pizza'] },
          ] },
        ],
      },
      {
        title: 'Pâtes',
        foods: [
          { title: 'Spaghetti bolognaise', variations: [{ title: 'Portion', price: 12 }] },
          { title: 'Penne arrabiata', variations: [{ title: 'Portion', price: 10 }] },
          { title: 'Lasagne maison', variations: [{ title: 'Portion', price: 14 }] },
        ],
      },
      {
        title: 'Salades',
        foods: [
          { title: 'Salade César', variations: [{ title: 'Portion', price: 10 }] },
          { title: 'Salade Caprese', variations: [{ title: 'Portion', price: 9 }] },
        ],
      },
      {
        title: 'Boissons',
        foods: [
          { title: 'Eau minérale 50cl', variations: [{ title: 'Bouteille', price: 2 }] },
          { title: 'Coca-Cola', variations: [{ title: 'Canette 33cl', price: 2.5 }] },
          { title: 'Boga', variations: [{ title: 'Canette 33cl', price: 2.5 }] },
          { title: 'Jus d’orange frais', variations: [{ title: 'Verre 40cl', price: 5 }] },
        ],
      },
    ],
  },
  {
    name: 'Baguette & Baguette Sfax',
    slug: 'baguette-baguette-sfax',
    image: IMG.fastFood,
    logo: IMG.sandwich,
    username: 'baguette.sfax',
    orderPrefix: 'BB-',
    address: 'Avenue Majida Boulila, Sfax 3027',
    phone: '+216 74 401 401',
    shopCategory: 'fast-food',
    cuisines: ['Fast Food'],
    location: [10.752, 34.745],
    minimumOrder: 8,
    deliveryTime: 25,
    openingStart: '10:00',
    openingEnd: '23:59',
    ownerEmail: 'vendor@enatega.com',
    options: [
      { key: 'fromage', title: 'Fromage', price: 1 },
      { key: 'oeuf', title: 'Œuf', price: 1 },
      { key: 'harissa', title: 'Harissa', price: 0.3 },
      { key: 'mayonnaise', title: 'Mayonnaise', price: 0.3 },
      { key: 'frites-in', title: 'Frites dans le sandwich', price: 1.5 },
    ],
    addons: [
      {
        key: 'supplements-sandwich',
        title: 'Suppléments sandwich',
        quantityMinimum: 0,
        quantityMaximum: 4,
        optionKeys: ['fromage', 'oeuf', 'harissa', 'mayonnaise', 'frites-in'],
      },
    ],
    categories: [
      {
        title: 'Sandwichs',
        foods: [
          { title: 'Baguette farcie thon', variations: [{ title: 'Sandwich', price: 7.5, addonKeys: ['supplements-sandwich'] }] },
          { title: 'Baguette farcie escalope', variations: [{ title: 'Sandwich', price: 8.5, addonKeys: ['supplements-sandwich'] }] },
          { title: 'Baguette farcie mixte', description: 'Thon + escalope', variations: [{ title: 'Sandwich', price: 9.5, addonKeys: ['supplements-sandwich'] }] },
          { title: 'Libanais poulet', variations: [{ title: 'Sandwich', price: 8, addonKeys: ['supplements-sandwich'] }] },
        ],
      },
      {
        title: 'Makloub & Chapati',
        foods: [
          { title: 'Makloub thon', variations: [{ title: 'Pièce', price: 7, addonKeys: ['supplements-sandwich'] }] },
          { title: 'Makloub escalope', variations: [{ title: 'Pièce', price: 8, addonKeys: ['supplements-sandwich'] }] },
          { title: 'Makloub mixte', variations: [{ title: 'Pièce', price: 9.5, addonKeys: ['supplements-sandwich'] }] },
          { title: 'Chapati thon', variations: [{ title: 'Pièce', price: 6.5, addonKeys: ['supplements-sandwich'] }] },
          { title: 'Chapati escalope', variations: [{ title: 'Pièce', price: 7.5, addonKeys: ['supplements-sandwich'] }] },
        ],
      },
      {
        title: 'Plats',
        foods: [
          { title: 'Escalope grillée + frites', variations: [{ title: 'Assiette', price: 13 }] },
          { title: 'Cordon bleu', variations: [{ title: 'Assiette', price: 14 }] },
          { title: 'Nuggets (8 pièces)', variations: [{ title: 'Portion', price: 8 }] },
        ],
      },
      {
        title: 'Extras & Boissons',
        foods: [
          { title: 'Frites', variations: [{ title: 'Portion', price: 4 }, { title: 'Grande portion', price: 6 }] },
          { title: 'Boga', variations: [{ title: 'Canette 33cl', price: 2.5 }] },
          { title: 'Coca-Cola', variations: [{ title: 'Canette 33cl', price: 2.5 }] },
          { title: 'Eau minérale 50cl', variations: [{ title: 'Bouteille', price: 1.5 }] },
          { title: 'Citronnade', variations: [{ title: 'Verre 40cl', price: 4 }] },
        ],
      },
    ],
  },
  {
    name: 'Restaurant Sidi Mansour',
    slug: 'sidi-mansour',
    image: IMG.restaurantTerrace,
    logo: IMG.couscous,
    username: 'sidimansour',
    orderPrefix: 'SM-',
    address: 'Route Sidi Mansour km 6, Sfax',
    phone: '+216 74 861 020',
    shopCategory: 'tunisien',
    cuisines: ['Tunisienne', 'Grillades'],
    location: [10.79, 34.79],
    minimumOrder: 12,
    deliveryTime: 45,
    // Restaurant de test terrain principal — ouvert 24/7 pour que les tests
    // E2E puissent tourner à n'importe quelle heure.
    openingStart: '00:00',
    openingEnd: '23:59',
    ownerEmail: 'vendor@enatega.com',
    options: [
      { key: 'frites', title: 'Frites', price: 3 },
      { key: 'salade', title: 'Salade tunisienne', price: 2.5 },
      { key: 'riz', title: 'Riz', price: 3 },
    ],
    addons: [
      {
        key: 'accompagnements',
        title: 'Accompagnements',
        quantityMinimum: 0,
        quantityMaximum: 2,
        optionKeys: ['frites', 'salade', 'riz'],
      },
    ],
    categories: [
      {
        title: 'Entrées',
        foods: [
          { title: 'Chorba frik', variations: [{ title: 'Bol', price: 5 }] },
          { title: 'Lablabi', variations: [{ title: 'Bol', price: 5 }] },
          { title: 'Salade tunisienne', variations: [{ title: 'Portion', price: 6 }] },
          { title: 'Brik à l’œuf', variations: [{ title: 'Pièce', price: 3.5 }] },
        ],
      },
      {
        title: 'Plats traditionnels',
        foods: [
          { title: 'Couscous au poisson', variations: [{ title: 'Portion', price: 20 }] },
          { title: 'Couscous à l’agneau', variations: [{ title: 'Portion', price: 22 }] },
          { title: 'Mloukhia', description: 'Ragoût de corète au bœuf', variations: [{ title: 'Portion', price: 14 }] },
          { title: 'Kamounia', variations: [{ title: 'Portion', price: 15 }] },
          { title: 'Ojja merguez', variations: [{ title: 'Portion', price: 13 }] },
          { title: 'Kafteji', variations: [{ title: 'Portion', price: 8 }] },
          { title: 'Riz djerbien', variations: [{ title: 'Portion', price: 14 }] },
        ],
      },
      {
        title: 'Grillades',
        foods: [
          { title: 'Grillade mixte', description: 'Agneau, merguez, escalope, kefta', variations: [{ title: 'Assiette', price: 25, addonKeys: ['accompagnements'] }] },
          { title: 'Côtelettes d’agneau', variations: [{ title: 'Assiette', price: 28, addonKeys: ['accompagnements'] }] },
          { title: 'Escalope de dinde grillée', variations: [{ title: 'Assiette', price: 14, addonKeys: ['accompagnements'] }] },
          { title: 'Merguez grillées', variations: [{ title: 'Assiette', price: 12, addonKeys: ['accompagnements'] }] },
        ],
      },
      {
        title: 'Desserts & Boissons',
        foods: [
          { title: 'Zriga', variations: [{ title: 'Coupe', price: 4 }] },
          { title: 'Assida', variations: [{ title: 'Coupe', price: 5 }] },
          { title: 'Thé aux pignons', variations: [{ title: 'Verre', price: 3 }] },
          { title: 'Citronnade', variations: [{ title: 'Verre 40cl', price: 4 }] },
          { title: 'Eau minérale 1L', variations: [{ title: 'Bouteille', price: 2 }] },
          { title: 'Boga', variations: [{ title: 'Canette 33cl', price: 2.5 }] },
        ],
      },
    ],
  },
  {
    name: 'Pâtisserie Masmoudi',
    slug: 'patisserie-masmoudi',
    image: IMG.bakery,
    logo: IMG.baklava,
    username: 'masmoudi',
    orderPrefix: 'MAS-',
    address: 'Avenue Hédi Chaker, Sfax 3000',
    phone: '+216 74 296 767',
    shopCategory: 'patisserie',
    cuisines: ['Pâtisserie & Café'],
    location: [10.761, 34.739],
    minimumOrder: 10,
    deliveryTime: 30,
    openingStart: '07:00',
    openingEnd: '21:00',
    ownerEmail: 'vendor.masmoudi@enatega-test.com',
    options: [],
    addons: [],
    categories: [
      {
        title: 'Pâtisseries tunisiennes',
        foods: [
          { title: 'Baklawa aux amandes', variations: [
            { title: 'Boîte 250 g', price: 18 },
            { title: 'Boîte 500 g', price: 34 },
          ] },
          { title: 'Kaak warka', variations: [
            { title: 'Boîte 250 g', price: 20 },
            { title: 'Boîte 500 g', price: 38 },
          ] },
          { title: 'Makroudh aux dattes', variations: [
            { title: 'Boîte 250 g', price: 12 },
            { title: 'Boîte 500 g', price: 22 },
          ] },
          { title: 'Assortiment prestige', description: 'Sélection de pâtisseries fines', variations: [{ title: 'Boîte 500 g', price: 45 }] },
        ],
      },
      {
        title: 'Gâteaux',
        foods: [
          { title: 'Mille-feuille', variations: [{ title: 'Part', price: 6 }] },
          { title: 'Tarte aux fraises', variations: [{ title: 'Part', price: 7 }] },
          { title: 'Éclair au chocolat', variations: [{ title: 'Pièce', price: 5 }] },
          { title: 'Cheesecake', variations: [{ title: 'Part', price: 8 }] },
        ],
      },
      {
        title: 'Café & Boissons',
        foods: [
          { title: 'Café express', variations: [{ title: 'Tasse', price: 2.5 }] },
          { title: 'Cappuccino', variations: [{ title: 'Tasse', price: 4 }] },
          { title: 'Thé à la menthe', variations: [{ title: 'Verre', price: 2.5 }] },
          { title: 'Jus d’orange frais', variations: [{ title: 'Verre 40cl', price: 5 }] },
        ],
      },
    ],
  },
];

const OWNERS: { email: string; name: string; userType: 'ADMIN' | 'VENDOR' }[] = [
  { email: 'admin@enatega.com', name: 'Super Admin', userType: 'ADMIN' },
  { email: 'hsouna@gmail.com', name: 'Hsouna Guidara', userType: 'VENDOR' },
  { email: 'vendor@enatega.com', name: 'Demo Vendor', userType: 'VENDOR' },
  { email: 'vendor.pizza@enatega-test.com', name: 'Pizza Vendor', userType: 'VENDOR' },
  { email: 'vendor.masmoudi@enatega-test.com', name: 'Masmoudi Vendor', userType: 'VENDOR' },
];

const RIDERS = [
  { name: 'Issam Ayadi', username: 'ayadi', email: 'issam.ayadi.ext@gmail.com', phone: '+216 20 111 222', location: [10.758, 34.742] as [number, number] },
  { name: 'Sfax Rider', username: 'rider.sfax', email: 'rider.sfax@enatega-test.com', phone: '+216 21 333 444', location: [10.765, 34.748] as [number, number] },
  { name: 'Demo Rider', username: 'rider', email: 'rider.demo@enatega-test.com', phone: '+216 22 555 666', location: [10.75, 34.75] as [number, number] },
  // Compte de test terrain principal — doit survivre à chaque reseed (le
  // snapshot clerkId matche par email).
  { name: 'Livreur Sidi Mansour', username: 'rider.sidimansour', email: 'rider.sidimansour@enatega.com', phone: '+216 23 777 888', location: [10.76, 34.745] as [number, number] },
];

const CUSTOMERS = [
  {
    name: 'Issam Ayadi',
    email: 'issam.ayadi.ext@gmail.com',
    phone: '+216 20 111 222',
    addresses: [
      { label: 'Maison', deliveryAddress: 'Route Gremda km 2, Sfax', details: 'Résidence Les Jasmins, 2e étage', location: [10.7455, 34.755], selected: true },
      { label: 'Bureau', deliveryAddress: 'Avenue Habib Bourguiba, Sfax centre', details: 'Immeuble El Amal', location: [10.7605, 34.7405], selected: false },
    ],
  },
  {
    name: 'Sfax Customer',
    email: 'customer.sfax@enatega-test.com',
    phone: '+216 12 345 678',
    addresses: [
      { label: 'Maison', deliveryAddress: 'Rue Habib Maazoun, Sfax 3000', details: 'Près du théâtre municipal', location: [10.765, 34.742], selected: true },
    ],
  },
];

const CUISINES = [
  { name: 'Tunisienne', description: 'Cuisine traditionnelle tunisienne', image: IMG.couscous },
  { name: 'Poisson & Fruits de mer', description: 'Poissons frais et fruits de mer de la côte sfaxienne', image: IMG.grilledFish },
  { name: 'Pizza & Pâtes', description: 'Spécialités italiennes', image: IMG.pizza },
  { name: 'Fast Food', description: 'Sandwichs, makloub et chapati', image: IMG.burger },
  { name: 'Grillades', description: 'Viandes grillées au charbon', image: IMG.bbq },
  { name: 'Pâtisserie & Café', description: 'Pâtisseries fines et boissons chaudes', image: IMG.dessert },
];

const SHOP_TYPES = [
  { name: 'Tunisien', slug: 'tunisien', image: IMG.couscous },
  { name: 'Poisson', slug: 'poisson', image: IMG.seafoodPlatter },
  { name: 'Pizzeria', slug: 'pizzeria', image: IMG.pizzaOven },
  { name: 'Fast Food', slug: 'fast-food', image: IMG.burger },
  { name: 'Pâtisserie', slug: 'patisserie', image: IMG.cake },
];

// Collections métier intégralement purgées avant le re-seed.
const COLLECTIONS_TO_PURGE = [
  'activities', 'addons', 'auditlogs', 'banners', 'categories', 'countries',
  'coupons', 'cuisines', 'customer_wallet_transactions', 'customer_wallets',
  'email_outboxes', 'foods', 'loyalty_accounts', 'notifications', 'offers',
  'options', 'order_trails', 'orders', 'otps', 'owners', 'paymentattempts',
  'push_tokens', 'restaurants', 'reviews', 'riders', 'shopTypes', 'staffs',
  'subCategories', 'support_tickets', 'taxations', 'ticket_messages',
  'tippings', 'user_notifications', 'users', 'wallettopups',
  'webnotifications', 'withdrawrequests', 'zones',
];

async function main(): Promise<void> {
  const uri = process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/enatega';
  await mongoose.connect(uri);
  const db = mongoose.connection.db!;
  const log = (msg: string) => console.log(`[seed-sfax] ${msg}`);

  // ── 1. Snapshot des liens Clerk avant purge ───────────────────────────────
  const ownerClerkByEmail = new Map<string, string>();
  for (const o of await db.collection('owners').find({ clerkId: { $exists: true } }).toArray()) {
    if (o.email) ownerClerkByEmail.set(String(o.email).toLowerCase(), o.clerkId);
  }
  const userClerkByEmail = new Map<string, string>();
  for (const u of await db.collection('users').find({ clerkId: { $exists: true } }).toArray()) {
    if (u.email) userClerkByEmail.set(String(u.email).toLowerCase(), u.clerkId);
  }
  const riderClerk = new Map<string, string>(); // clé: email ou username
  for (const r of await db.collection('riders').find({ clerkId: { $exists: true } }).toArray()) {
    if (r.email) riderClerk.set(String(r.email).toLowerCase(), r.clerkId);
    if (r.username) riderClerk.set(String(r.username).toLowerCase(), r.clerkId);
  }
  // Les clerkId de restaurants sont réattachés en priorité au nouveau
  // restaurant du même NOM — stable d'un reseed à l'autre même quand un owner
  // possède plusieurs restaurants (sinon le clerkId "store" dérivait vers le
  // premier restaurant de l'owner, cassant le login du store réel). Repli sur
  // l'ownerEmail pour les anciens dumps sans correspondance de nom (un clerkId
  // ne peut lier qu'un seul restaurant — index unique).
  const restaurantClerkByName = new Map<string, string>();
  const restaurantClerkByOwnerEmail = new Map<string, string>();
  for (const r of await db.collection('restaurants').find({ clerkId: { $exists: true } }).toArray()) {
    if (r.name) restaurantClerkByName.set(String(r.name).toLowerCase(), r.clerkId as string);
    const owner = r.owner
      ? await db.collection('owners').findOne({ _id: r.owner }, { projection: { email: 1 } })
      : null;
    if (owner?.email) {
      restaurantClerkByOwnerEmail.set(String(owner.email).toLowerCase(), r.clerkId as string);
    }
  }
  const preservedRestaurantClerkCount = new Set([
    ...restaurantClerkByName.values(),
    ...restaurantClerkByOwnerEmail.values(),
  ]).size;
  log(
    `Liens Clerk préservés: ${ownerClerkByEmail.size} owners, ${userClerkByEmail.size} users, ` +
    `${new Set(riderClerk.values()).size} riders, ${preservedRestaurantClerkCount} restaurants.`,
  );

  // ── 2. Purge ───────────────────────────────────────────────────────────────
  for (const name of COLLECTIONS_TO_PURGE) {
    const { deletedCount } = await db.collection(name).deleteMany({});
    if (deletedCount) log(`Purge ${name}: ${deletedCount} documents supprimés.`);
  }

  // ── 3. Configuration (TND, 3 décimales) ───────────────────────────────────
  await db.collection('configurations').updateOne(
    {},
    {
      $set: {
        currency: CURRENCY,
        currencySymbol: 'DT',
        currencyDecimalDigits: MONEY_SCALE,
        costType: 'fixed',
        baseDeliveryFee: 3,
        baseDeliveryFeeMinor: toMinor(3),
        deliveryRate: 1.5,
        deliveryRateMinor: toMinor(1.5),
        baseDeliveryDistance: 5,
        maxTipPercentage: 25,
        riderCommissionRate: 0.8,
        expressSurcharge: 2,
        expressSurchargeMinor: toMinor(2),
        expressEnabled: true,
        loyaltyEnabled: true,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  );
  log('Configuration mise à jour (TND, DT, 3 décimales).');

  // Pourboires : document singleton lu par le panier/checkout (app + web) et
  // le formulaire admin. La purge vide `tippings`, il faut donc le recréer.
  await db.collection('tippings').insertOne({
    tipVariations: [1, 2, 3],
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  log('Pourboires par défaut créés (1/2/3 DT).');

  // ── 4. Zone Sfax ───────────────────────────────────────────────────────────
  const zoneId = new Types.ObjectId();
  await db.collection('zones').insertOne({
    _id: zoneId,
    title: 'Sfax Ville',
    description: 'Grand Sfax : centre-ville, Corniche, Gremda, Sidi Mansour',
    location: { type: 'Polygon', coordinates: [SFAX_ZONE_RING] },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  log('Zone "Sfax Ville" créée.');

  // ── 5. Cuisines & shop types ───────────────────────────────────────────────
  const now = new Date();
  await db.collection('cuisines').insertMany(
    CUISINES.map((c) => ({ ...c, shopType: 'restaurant', createdAt: now, updatedAt: now })),
  );
  await db.collection('shopTypes').insertMany(
    SHOP_TYPES.map((s) => ({ ...s, isActive: true, createdAt: now, updatedAt: now })),
  );
  log(`${CUISINES.length} cuisines et ${SHOP_TYPES.length} shop types créés.`);

  // ── 6. Owners ──────────────────────────────────────────────────────────────
  const hashed = await hashPassword(PASSWORD);
  const ownerIdByEmail = new Map<string, Types.ObjectId>();
  for (const o of OWNERS) {
    const _id = new Types.ObjectId();
    ownerIdByEmail.set(o.email, _id);
    const clerkId = ownerClerkByEmail.get(o.email);
    await db.collection('owners').insertOne({
      _id,
      email: o.email,
      password: hashed,
      name: o.name,
      userType: o.userType,
      permissions: [],
      restaurants: [],
      isActive: true,
      ...(clerkId ? { clerkId } : {}),
      createdAt: now,
      updatedAt: now,
    });
    log(`Owner ${o.email} (${o.userType})${clerkId ? ' [Clerk lié]' : ''}.`);
  }

  // ── 7. Restaurants + catalogue ─────────────────────────────────────────────
  const usedRestaurantClerkIds = new Set<string>();
  // Un clerkId qui matche par NOM un restaurant de ce seed lui est réservé :
  // le fallback ownerEmail ne doit pas le consommer pour un autre restaurant
  // du même vendor créé avant lui (ex. baguette.sfax volait le clerkId store
  // de sidimansour, tous deux possédés par vendor@enatega.com).
  const nameReservedClerkIds = new Set<string>(
    RESTAURANTS.map((r) => restaurantClerkByName.get(r.name.toLowerCase()))
      .filter((id): id is string => !!id),
  );
  for (const r of RESTAURANTS) {
    const restaurantId = new Types.ObjectId();
    const ownerId = ownerIdByEmail.get(r.ownerEmail)!;
    const nameMatch = restaurantClerkByName.get(r.name.toLowerCase());
    const ownerFallback = restaurantClerkByOwnerEmail.get(r.ownerEmail.toLowerCase());
    const candidateClerkId =
      nameMatch ??
      (ownerFallback && !nameReservedClerkIds.has(ownerFallback) ? ownerFallback : undefined);
    // Un même vendor peut posséder plusieurs restaurants : ne lier le clerkId
    // store qu'une seule fois (index unique sparse sur restaurants.clerkId).
    const clerkId = candidateClerkId && !usedRestaurantClerkIds.has(candidateClerkId)
      ? candidateClerkId
      : undefined;
    if (clerkId) usedRestaurantClerkIds.add(clerkId);

    await db.collection('restaurants').insertOne({
      _id: restaurantId,
      unique_restaurant_id: r.slug,
      name: r.name,
      slug: r.slug,
      username: r.username,
      password: hashed,
      ...(clerkId ? { clerkId } : {}),
      orderId: 0,
      orderPrefix: r.orderPrefix,
      image: r.image,
      logo: r.logo,
      phone: r.phone,
      address: r.address,
      city: 'Sfax',
      postCode: '3000',
      location: { type: 'Point', coordinates: r.location },
      deliveryBounds: { type: 'Polygon', coordinates: [SFAX_ZONE_RING] },
      boundType: 'polygon',
      deliveryInfo: { minDeliveryFee: 2, deliveryDistance: 10, deliveryFee: 3 },
      deliveryTime: r.deliveryTime,
      minimumOrder: r.minimumOrder,
      tax: 0,
      salesTax: 0,
      commissionRate: 10,
      isActive: true,
      isAvailable: true,
      unavailableUntil: null,
      stripeDetailsSubmitted: false,
      enableNotification: false,
      openingTimes: openingTimes(r.openingStart, r.openingEnd),
      timezone: TIMEZONE,
      owner: ownerId,
      zone: zoneId,
      shopType: 'restaurant',
      shopCategory: r.shopCategory,
      cuisines: r.cuisines,
      sections: [],
      keywords: [r.name, 'Sfax', ...r.cuisines],
      tags: [],
      currentWalletAmount: 0,
      currentWalletAmountMinor: 0,
      totalWalletAmount: 0,
      totalWalletAmountMinor: 0,
      withdrawnWalletAmount: 0,
      withdrawnWalletAmountMinor: 0,
      walletAmountCurrency: CURRENCY,
      walletAmountScale: MONEY_SCALE,
      rating: 4.5,
      isOrderNotification: true,
      isOfferNotification: true,
      deliveryOptions: { delivery: true, pickup: true },
      createdAt: now,
      updatedAt: now,
    });

    await db.collection('owners').updateOne(
      { _id: ownerId },
      { $push: { restaurants: restaurantId } } as never,
    );

    // Options → ids réels, puis addons (référencent les options), puis foods.
    const optionIdByKey = new Map<string, string>();
    for (const opt of r.options) {
      const _id = new Types.ObjectId();
      optionIdByKey.set(opt.key, _id.toString());
      await db.collection('options').insertOne({
        _id,
        restaurantId,
        title: opt.title,
        price: opt.price,
        priceMinor: toMinor(opt.price),
        createdAt: now,
        updatedAt: now,
      });
    }
    const addonIdByKey = new Map<string, string>();
    for (const addon of r.addons) {
      const _id = new Types.ObjectId();
      addonIdByKey.set(addon.key, _id.toString());
      await db.collection('addons').insertOne({
        _id,
        restaurantId,
        title: addon.title,
        description: addon.description,
        quantityMinimum: addon.quantityMinimum,
        quantityMaximum: addon.quantityMaximum,
        options: addon.optionKeys.map((k) => optionIdByKey.get(k)!),
        createdAt: now,
        updatedAt: now,
      });
    }

    let foodCount = 0;
    for (const cat of r.categories) {
      const categoryId = new Types.ObjectId();
      await db.collection('categories').insertOne({
        _id: categoryId,
        restaurantId,
        title: cat.title,
        image: cat.foods.length ? foodImage(cat.foods[0].title) : undefined,
        createdAt: now,
        updatedAt: now,
      });
      for (const food of cat.foods) {
        foodCount++;
        await db.collection('foods').insertOne({
          _id: new Types.ObjectId(),
          restaurantId,
          categoryId,
          title: food.title,
          description: food.description,
          image: foodImage(food.title),
          isActive: true,
          isOutOfStock: false,
          variations: food.variations.map((v) => ({
            _id: new Types.ObjectId(),
            title: v.title,
            price: v.price,
            priceMinor: toMinor(v.price),
            discounted: 0,
            discountedMinor: 0,
            addons: (v.addonKeys ?? []).map((k) => addonIdByKey.get(k)!),
            isOutOfStock: false,
          })),
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    log(
      `Restaurant "${r.name}" (${r.username}) créé — ${r.categories.length} catégories, ` +
      `${foodCount} plats${clerkId ? ' [Clerk lié]' : ''}.`,
    );
  }

  // ── 8. Riders ──────────────────────────────────────────────────────────────
  for (const rd of RIDERS) {
    const clerkId = riderClerk.get(rd.email.toLowerCase()) ?? riderClerk.get(rd.username.toLowerCase());
    await db.collection('riders').insertOne({
      _id: new Types.ObjectId(),
      name: rd.name,
      username: rd.username,
      password: hashed,
      ...(clerkId ? { clerkId } : {}),
      email: rd.email,
      phone: rd.phone,
      timeZone: TIMEZONE,
      available: true,
      isActive: true,
      assigned: false,
      vehicleType: 'MOTORCYCLE',
      zone: zoneId,
      currentWalletAmount: 0,
      currentWalletAmountMinor: 0,
      totalWalletAmount: 0,
      totalWalletAmountMinor: 0,
      withdrawnWalletAmount: 0,
      withdrawnWalletAmountMinor: 0,
      walletAmountCurrency: CURRENCY,
      walletAmountScale: MONEY_SCALE,
      isOrderNotification: true,
      isOfferNotification: true,
      lastKnownLocation: { type: 'Point', coordinates: rd.location },
      lastSeenAt: now,
      workSchedule: [],
      createdAt: now,
      updatedAt: now,
    });
    log(`Rider ${rd.username} (${rd.email})${clerkId ? ' [Clerk lié]' : ''}.`);
  }

  // ── 9. Customers ───────────────────────────────────────────────────────────
  for (const cu of CUSTOMERS) {
    const clerkId = userClerkByEmail.get(cu.email.toLowerCase());
    await db.collection('users').insertOne({
      _id: new Types.ObjectId(),
      name: cu.name,
      email: cu.email,
      phone: cu.phone,
      password: hashed,
      ...(clerkId ? { clerkId } : {}),
      userType: 'default',
      emailIsVerified: true,
      phoneIsVerified: true,
      isActive: true,
      isOrderNotification: true,
      isOfferNotification: true,
      addresses: cu.addresses.map((a) => ({
        _id: new Types.ObjectId(),
        label: a.label,
        deliveryAddress: a.deliveryAddress,
        details: a.details,
        location: { type: 'Point', coordinates: a.location },
        selected: a.selected,
      })),
      favourite: [],
      status: 'active',
      preferredLanguage: 'fr',
      createdAt: now,
      updatedAt: now,
    });
    log(`Customer ${cu.email}${clerkId ? ' [Clerk lié]' : ''}.`);
  }

  log('──────────────────────────────────────────────');
  log('Seed Sfax terminé. Mot de passe partout : password123');
  log('Admin: admin@enatega.com | Stores: lecorail, lasquadra, baguette.sfax, sidimansour, masmoudi');
  log('Riders: ayadi, rider.sfax, rider, rider.sidimansour@enatega.com | Customers: issam.ayadi.ext@gmail.com, customer.sfax@enatega-test.com');

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('[seed-sfax] ÉCHEC:', error);
  process.exit(1);
});
