export interface Airport {
  code: string;
  name: string;
  city: string;
  country: string;
}

export interface Region {
  name: string;
  airports: Airport[];
}

export const AIRPORT_REGIONS: Region[] = [
  {
    name: "Asia",
    airports: [
      { code: "KUL", name: "Kuala Lumpur International", city: "Kuala Lumpur", country: "Malaysia" },
      { code: "SIN", name: "Changi Airport", city: "Singapore", country: "Singapore" },
      { code: "PEK", name: "Beijing Capital International", city: "Beijing", country: "China" },
      { code: "PVG", name: "Shanghai Pudong International", city: "Shanghai", country: "China" },
      { code: "HKG", name: "Hong Kong International", city: "Hong Kong", country: "China" },
      { code: "HND", name: "Haneda Airport", city: "Tokyo", country: "Japan" },
      { code: "ICN", name: "Incheon International", city: "Seoul", country: "South Korea" },
      { code: "BKK", name: "Suvarnabhumi Airport", city: "Bangkok", country: "Thailand" },
    ]
  },
  {
    name: "Europe",
    airports: [
      { code: "FRA", name: "Frankfurt Airport", city: "Frankfurt", country: "Germany" },
      { code: "MUC", name: "Munich Airport", city: "Munich", country: "Germany" },
      { code: "LHR", name: "Heathrow Airport", city: "London", country: "United Kingdom" },
      { code: "CDG", name: "Charles de Gaulle Airport", city: "Paris", country: "France" },
      { code: "AMS", name: "Schiphol Airport", city: "Amsterdam", country: "Netherlands" },
      { code: "MAD", name: "Adolfo Suárez Madrid–Barajas", city: "Madrid", country: "Spain" },
      { code: "IST", name: "Istanbul Airport", city: "Istanbul", country: "Turkey" },
    ]
  },
  {
    name: "North America",
    airports: [
      { code: "JFK", name: "John F. Kennedy International", city: "New York", country: "USA" },
      { code: "LAX", name: "Los Angeles International", city: "Los Angeles", country: "USA" },
      { code: "SFO", name: "San Francisco International", city: "San Francisco", country: "USA" },
      { code: "ORD", name: "O'Hare International", city: "Chicago", country: "USA" },
      { code: "YYZ", name: "Toronto Pearson International", city: "Toronto", country: "Canada" },
      { code: "MEX", name: "Mexico City International", city: "Mexico City", country: "Mexico" },
    ]
  },
  {
    name: "Oceania",
    airports: [
      { code: "SYD", name: "Sydney Kingsford Smith", city: "Sydney", country: "Australia" },
      { code: "MEL", name: "Melbourne Airport", city: "Melbourne", country: "Australia" },
      { code: "AKL", name: "Auckland Airport", city: "Auckland", country: "New Zealand" },
    ]
  },
  {
    name: "Middle East",
    airports: [
      { code: "DXB", name: "Dubai International", city: "Dubai", country: "UAE" },
      { code: "DOH", name: "Hamad International", city: "Doha", country: "Qatar" },
      { code: "AUH", name: "Abu Dhabi International", city: "Abu Dhabi", country: "UAE" },
    ]
  }
];
