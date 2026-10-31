// Real artworks supplied for Sarah's gallery. Descriptive titles are temporary; prices are not invented.
export const WORKS = [
  { code:'SG-01', title:'Portrait in Blue', artist:'Sarah Norris Gyening', medium:'Original painting', year:'', dims:'Details on request', price:'Price on request', status:'Inquire' },
  { code:'SG-02', title:'Crowned Figure', artist:'Sarah Norris Gyening', medium:'Original painting', year:'', dims:'Details on request', price:'Price on request', status:'Inquire' },
  { code:'SG-03', title:'Flowers & Still Life', artist:'Sarah Norris Gyening', medium:'Original paintings', year:'', dims:'Three works on view', price:'Inquire for details', status:'Inquire' },
  { code:'SG-06', title:'Landscapes & Florals', artist:'Sarah Norris Gyening', medium:'Original paintings', year:'', dims:'Two works on view', price:'Inquire for details', status:'Inquire' },
  { code:'SG-08', title:'Floral Portrait', artist:'Sarah Norris Gyening', medium:'Original painting', year:'', dims:'Details on request', price:'Price on request', status:'Inquire' },
  { code:'SG-09', title:'Red Floral Abstract', artist:'Sarah Norris Gyening', medium:'Original painting', year:'', dims:'Details on request', price:'Price on request', status:'Inquire' },
  { code:'SG-10', title:'Purple Flowers', artist:'Sarah Norris Gyening', medium:'Original painting', year:'', dims:'Details on request', price:'Price on request', status:'Inquire' },
];
// Individual artworks placed on the 3D gallery walls. Prices and dimensions
// remain unconfirmed until Sarah provides them.
export const ARTWORKS = [
  { code:'SG-01', title:'Portrait in Blue', room:0, file:'01-hooded-portrait.webp', price:'Price on request' },
  { code:'SG-02', title:'Crowned Figure', room:1, file:'02-crowned-figure.webp', price:'Price on request' },
  { code:'SG-03', title:'Checkered Vase Flowers', room:2, file:'03-checkered-vase-flowers.webp', price:'Price on request' },
  { code:'SG-04', title:'Bread and Fish', room:2, file:'04-bread-and-fish.webp', price:'Price on request' },
  { code:'SG-05', title:'Walker with Sheep', room:2, file:'05-walker-with-sheep.webp', price:'Price on request' },
  { code:'SG-06', title:'Winding Path', room:3, file:'06-landscape-winding-path.webp', price:'Price on request' },
  { code:'SG-07', title:'Blue and Yellow Florals', room:3, file:'07-blue-yellow-florals.webp', price:'Price on request' },
  { code:'SG-08', title:'Floral Portrait in Green', room:4, file:'08-floral-portrait-green.webp', price:'Price on request' },
  { code:'SG-09', title:'Red Floral Abstract', room:5, file:'09-red-floral-abstract.webp', price:'Price on request' },
  { code:'SG-10', title:'Purple Flowers', room:6, file:'10-purple-flowers.webp', price:'Price on request' }
];
export const CHAPTERS = [
  {id:'arrival',num:'00',short:'Arrival',room:'Foyer'},
  {id:'vision',num:'01',short:'Portraits',room:'Room I'},
  {id:'divisions',num:'02',short:'Still Life',room:'Room II'},
  {id:'technology',num:'03',short:'Nature',room:'Room III'},
  {id:'investments',num:'04',short:'Expression',room:'Room IV'},
  {id:'principles',num:'05',short:'Color',room:'Room V'},
  {id:'contact',num:'06',short:'Contact',room:'Room VI'},
];
export const DIVISIONS = [
  {name:'Portraits',what:'Figures, expression and personal stories',own:100},
  {name:'Still Life',what:'Everyday objects, meaning and memory',own:100},
  {name:'Florals',what:'Botanical forms and bold color',own:100},
  {name:'Landscapes',what:'Movement through place and nature',own:100},
  {name:'Abstracts',what:'Color, movement and texture',own:100}
];