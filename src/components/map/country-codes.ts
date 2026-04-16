/**
 * Mapping from ISO 3166-1 alpha-3 country codes to the numeric ISO codes
 * used in the world-atlas TopoJSON file (countries-110m.json).
 *
 * To add a new country: find its numeric ISO code at
 * https://www.iban.com/country-codes and add it here.
 */
export const ALPHA3_TO_NUMERIC: Record<string, number> = {
  // Africa
  DZA: 12,   // Algeria
  AGO: 24,   // Angola
  BEN: 204,  // Benin
  BWA: 72,   // Botswana
  BFA: 854,  // Burkina Faso
  BDI: 108,  // Burundi
  CMR: 120,  // Cameroon
  CPV: 132,  // Cape Verde
  CAF: 140,  // Central African Republic
  TCD: 148,  // Chad
  COM: 174,  // Comoros
  COD: 180,  // Democratic Republic of Congo
  COG: 178,  // Republic of Congo
  CIV: 384,  // Côte d'Ivoire
  DJI: 262,  // Djibouti
  EGY: 818,  // Egypt
  GNQ: 226,  // Equatorial Guinea
  ERI: 232,  // Eritrea
  SWZ: 748,  // Eswatini
  ETH: 231,  // Ethiopia
  GAB: 266,  // Gabon
  GMB: 270,  // Gambia
  GHA: 288,  // Ghana
  GIN: 324,  // Guinea
  GNB: 624,  // Guinea-Bissau
  KEN: 404,  // Kenya
  LSO: 426,  // Lesotho
  LBR: 430,  // Liberia
  LBY: 434,  // Libya
  MDG: 450,  // Madagascar
  MWI: 454,  // Malawi
  MLI: 466,  // Mali
  MRT: 478,  // Mauritania
  MUS: 480,  // Mauritius
  MAR: 504,  // Morocco
  MOZ: 508,  // Mozambique
  NAM: 516,  // Namibia
  NER: 562,  // Niger
  NGA: 566,  // Nigeria
  RWA: 646,  // Rwanda
  STP: 678,  // São Tomé and Príncipe
  SEN: 686,  // Senegal
  SLE: 694,  // Sierra Leone
  SOM: 706,  // Somalia
  ZAF: 710,  // South Africa
  SSD: 728,  // South Sudan
  SDN: 729,  // Sudan
  TZA: 834,  // Tanzania
  TGO: 768,  // Togo
  TUN: 788,  // Tunisia
  UGA: 800,  // Uganda
  ZMB: 894,  // Zambia
  ZWE: 716,  // Zimbabwe

  // Americas
  ATG: 28,   // Antigua and Barbuda
  ARG: 32,   // Argentina
  BHS: 44,   // Bahamas
  BRB: 52,   // Barbados
  BLZ: 84,   // Belize
  BOL: 68,   // Bolivia
  BRA: 76,   // Brazil
  CAN: 124,  // Canada
  CHL: 152,  // Chile
  COL: 170,  // Colombia
  CRI: 188,  // Costa Rica
  CUB: 192,  // Cuba
  DMA: 212,  // Dominica
  DOM: 214,  // Dominican Republic
  ECU: 218,  // Ecuador
  SLV: 222,  // El Salvador
  GRD: 308,  // Grenada
  GTM: 320,  // Guatemala
  GUY: 328,  // Guyana
  HTI: 332,  // Haiti
  HND: 340,  // Honduras
  JAM: 388,  // Jamaica
  MEX: 484,  // Mexico
  NIC: 558,  // Nicaragua
  PAN: 591,  // Panama
  PRY: 600,  // Paraguay
  PER: 604,  // Peru
  KNA: 659,  // Saint Kitts and Nevis
  LCA: 662,  // Saint Lucia
  VCT: 670,  // Saint Vincent and the Grenadines
  SUR: 740,  // Suriname
  TTO: 780,  // Trinidad and Tobago
  USA: 840,  // United States
  URY: 858,  // Uruguay
  VEN: 862,  // Venezuela

  // Asia
  AFG: 4,    // Afghanistan
  ARM: 51,   // Armenia
  AZE: 31,   // Azerbaijan
  BHR: 48,   // Bahrain
  BGD: 50,   // Bangladesh
  BTN: 64,   // Bhutan
  BRN: 96,   // Brunei
  KHM: 116,  // Cambodia
  CHN: 156,  // China
  CYP: 196,  // Cyprus
  GEO: 268,  // Georgia
  IND: 356,  // India
  IDN: 360,  // Indonesia
  IRN: 364,  // Iran
  IRQ: 368,  // Iraq
  ISR: 376,  // Israel
  JPN: 392,  // Japan
  JOR: 400,  // Jordan
  KAZ: 398,  // Kazakhstan
  KWT: 414,  // Kuwait
  KGZ: 417,  // Kyrgyzstan
  LAO: 418,  // Laos
  LBN: 422,  // Lebanon
  MYS: 458,  // Malaysia
  MDV: 462,  // Maldives
  MNG: 496,  // Mongolia
  MMR: 104,  // Myanmar
  NPL: 524,  // Nepal
  PRK: 408,  // North Korea
  OMN: 512,  // Oman
  PAK: 586,  // Pakistan
  PSE: 275,  // Palestine
  PHL: 608,  // Philippines
  QAT: 634,  // Qatar
  SAU: 682,  // Saudi Arabia
  SGP: 702,  // Singapore
  KOR: 410,  // South Korea
  LKA: 144,  // Sri Lanka
  SYR: 760,  // Syria
  TWN: 158,  // Taiwan
  TJK: 762,  // Tajikistan
  THA: 764,  // Thailand
  TLS: 626,  // Timor-Leste
  TUR: 792,  // Turkey
  TKM: 795,  // Turkmenistan
  ARE: 784,  // United Arab Emirates
  UZB: 860,  // Uzbekistan
  VNM: 704,  // Vietnam
  YEM: 887,  // Yemen

  // Europe
  ALB: 8,    // Albania
  AND: 20,   // Andorra
  AUT: 40,   // Austria
  BLR: 112,  // Belarus
  BEL: 56,   // Belgium
  BIH: 70,   // Bosnia and Herzegovina
  BGR: 100,  // Bulgaria
  HRV: 191,  // Croatia
  CZE: 203,  // Czech Republic
  DNK: 208,  // Denmark
  EST: 233,  // Estonia
  FIN: 246,  // Finland
  FRA: 250,  // France
  DEU: 276,  // Germany
  GRC: 300,  // Greece
  HUN: 348,  // Hungary
  ISL: 352,  // Iceland
  IRL: 372,  // Ireland
  ITA: 380,  // Italy
  XKX: 383,  // Kosovo
  LVA: 428,  // Latvia
  LIE: 438,  // Liechtenstein
  LTU: 440,  // Lithuania
  LUX: 442,  // Luxembourg
  MKD: 807,  // North Macedonia
  MLT: 470,  // Malta
  MDA: 498,  // Moldova
  MCO: 492,  // Monaco
  MNE: 499,  // Montenegro
  NLD: 528,  // Netherlands
  NOR: 578,  // Norway
  POL: 616,  // Poland
  PRT: 620,  // Portugal
  ROU: 642,  // Romania
  RUS: 643,  // Russia
  SMR: 674,  // San Marino
  SRB: 688,  // Serbia
  SVK: 703,  // Slovakia
  SVN: 705,  // Slovenia
  ESP: 724,  // Spain
  SWE: 752,  // Sweden
  CHE: 756,  // Switzerland
  UKR: 804,  // Ukraine
  GBR: 826,  // United Kingdom

  // Oceania
  AUS: 36,   // Australia
  FJI: 242,  // Fiji
  KIR: 296,  // Kiribati
  MHL: 584,  // Marshall Islands
  FSM: 583,  // Micronesia
  NRU: 520,  // Nauru
  NZL: 554,  // New Zealand
  PLW: 585,  // Palau
  PNG: 598,  // Papua New Guinea
  WSM: 882,  // Samoa
  SLB: 90,   // Solomon Islands
  TON: 776,  // Tonga
  TUV: 798,  // Tuvalu
  VUT: 548,  // Vanuatu
};

/** Reverse lookup: numeric ISO → alpha-3 */
export const NUMERIC_TO_ALPHA3: Record<number, string> = Object.fromEntries(
  Object.entries(ALPHA3_TO_NUMERIC).map(([a3, num]) => [num, a3])
);
