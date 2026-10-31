// Chapter copy and the works on show. Names, prices and divisions are placeholders.
export const WORKS = [
  { code: 'NG-0100', title: 'Foundation', artist: 'Ines Valtorre', born: 'b. 1979, Trieste', year: '2024', medium: 'Carrara marble and patinated bronze', dims: '112 × 62 × 48 cm', price: '$48,000', status: 'Available' },
  { code: 'NG-0101', title: 'Horizon, Held', artist: 'Mara Quillon', born: 'b. 1985, Lisbon', year: '2025', medium: 'Oil on Belgian linen', dims: '240 × 360 cm', price: '$86,000', status: 'Available' },
  { code: 'NG-0102', title: 'Five Holdings', artist: 'Teodor Vesk', born: 'b. 1972, Tallinn', year: '2023', medium: 'Acrylic and gesso on panel, five parts', dims: 'Each 130 × 100 cm', price: '$64,000 the set', status: 'Available' },
  { code: 'NG-0103', title: 'Signal / Noise I–III', artist: 'Kaito Renmark', born: 'b. 1990, Osaka', year: '2025', medium: 'Archival pigment prints on cotton rag, edition of 12', dims: 'Each 145 × 110 cm framed', price: '$9,800 each', status: 'Available', note: '4 of 12 remain' },
  { code: 'NG-0104', title: 'Compound', artist: 'Lucía Abrantel', born: 'b. 1968, Valencia', year: '2022', medium: 'Mirror-polished stainless steel', dims: '205 × 150 × 150 cm', price: '$185,000', status: 'Reserved' },
  { code: 'NG-0105', title: 'Line of Conduct', artist: 'Sefa Morrow-Adjei', born: 'b. 1981, Accra', year: '2024', medium: 'Oil and graphite on canvas', dims: '220 × 400 cm', price: '$42,000', status: 'Available' },
  { code: 'NG-0106', title: 'Open Door', artist: 'Noor Calloway', born: 'b. 1988, Chicago', year: '2026', medium: 'Oil and cold wax on canvas', dims: '280 × 420 cm', price: '$72,000', status: 'Available' },
];

export const CHAPTERS = [
  { id: 'arrival', num: '00', short: 'Arrival', room: 'Foyer' },
  { id: 'vision', num: '01', short: 'Vision', room: 'Room I' },
  { id: 'divisions', num: '02', short: 'Divisions', room: 'Room II' },
  { id: 'technology', num: '03', short: 'Technology', room: 'Room III' },
  { id: 'investments', num: '04', short: 'Investments', room: 'Room IV' },
  { id: 'principles', num: '05', short: 'Principles', room: 'Room V' },
  { id: 'contact', num: '06', short: 'Contact', room: 'Room VI' },
];

export const DIVISIONS = [
  { name: 'Industrial', what: 'Precision fabrication and machining', own: 100 },
  { name: 'Logistics', what: 'Regional freight and warehousing', own: 100 },
  { name: 'Health Services', what: 'Outpatient clinics and staffing', own: 80 },
  { name: 'Digital', what: 'Managed IT and network services', own: 65 },
  { name: 'Real Assets', what: 'Light-industrial property', own: 51 },
];
