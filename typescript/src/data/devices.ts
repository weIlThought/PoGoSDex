export interface Device {
  id: string;
  brand: string;
  model: string;
  type: "phone" | "tablet";
  osVersion: string;
  compatibility: "full" | "partial";
  manufacturerLink: string;
  notes: string;
  rootLinks: {
    xda?: string;
    magisk?: string;
    tutorial?: string;
  };
}

export const devices: Device[] = [
  {
    id: "1",
    brand: "Samsung",
    model: "Galaxy S23 Ultra",
    type: "phone",
    osVersion: "Android 14",
    compatibility: "full",
    manufacturerLink: "https://www.samsung.com/global/galaxy/galaxy-s23-ultra/",
    notes: "Excellent performance with all features. Snapdragon 8 Gen 2 handles AR perfectly.",
    rootLinks: {
      xda: "https://forum.xda-developers.com/f/samsung-galaxy-s23-ultra.12707/",
      magisk: "https://github.com/topjohnwu/Magisk",
      tutorial: "https://www.xda-developers.com/how-to-root-samsung-galaxy-s23/"
    }
  },
  {
    id: "2",
    brand: "Google",
    model: "Pixel 8 Pro",
    type: "phone",
    osVersion: "Android 14",
    compatibility: "full",
    manufacturerLink: "https://store.google.com/product/pixel_8_pro",
    notes: "Stock Android ensures smooth gameplay. Excellent GPS accuracy.",
    rootLinks: {
      xda: "https://forum.xda-developers.com/f/google-pixel-8-pro.12763/",
      magisk: "https://github.com/topjohnwu/Magisk",
      tutorial: "https://www.xda-developers.com/how-to-unlock-bootloader-root-magisk-google-pixel-8-pro/"
    }
  },
  {
    id: "3",
    brand: "Samsung",
    model: "Galaxy Tab S9",
    type: "tablet",
    osVersion: "Android 14",
    compatibility: "full",
    manufacturerLink: "https://www.samsung.com/global/galaxy/galaxy-tab-s9/",
    notes: "Large display perfect for extended play sessions. Excellent battery life.",
    rootLinks: {
      xda: "https://forum.xda-developers.com/f/samsung-galaxy-tab-s9.12765/",
      magisk: "https://github.com/topjohnwu/Magisk"
    }
  },
  {
    id: "4",
    brand: "OnePlus",
    model: "11 Pro",
    type: "phone",
    osVersion: "Android 13",
    compatibility: "full",
    manufacturerLink: "https://www.oneplus.com/11",
    notes: "Fast charging and smooth performance. OxygenOS optimized for gaming.",
    rootLinks: {
      xda: "https://forum.xda-developers.com/f/oneplus-11.12589/",
      tutorial: "https://www.xda-developers.com/how-to-root-oneplus-11/"
    }
  },
  {
    id: "5",
    brand: "Xiaomi",
    model: "13T Pro",
    type: "phone",
    osVersion: "Android 13",
    compatibility: "full",
    manufacturerLink: "https://www.mi.com/global/product/xiaomi-13t-pro/",
    notes: "Great value with flagship performance. MIUI gaming optimizations work well.",
    rootLinks: {
      xda: "https://forum.xda-developers.com/f/xiaomi-13t-pro.12789/",
      magisk: "https://github.com/topjohnwu/Magisk"
    }
  },
  {
    id: "6",
    brand: "Apple",
    model: "iPad Pro 12.9\" (2024)",
    type: "tablet",
    osVersion: "iOS 17",
    compatibility: "partial",
    manufacturerLink: "https://www.apple.com/ipad-pro/",
    notes: "PGSharp not available for iOS. Regular Pokémon GO works perfectly.",
    rootLinks: {}
  },
  {
    id: "7",
    brand: "Asus",
    model: "ROG Phone 7",
    type: "phone",
    osVersion: "Android 13",
    compatibility: "full",
    manufacturerLink: "https://rog.asus.com/phones/rog-phone-7-model/",
    notes: "Gaming phone with excellent cooling. Perfect for extended sessions.",
    rootLinks: {
      xda: "https://forum.xda-developers.com/f/asus-rog-phone-7.12701/",
      magisk: "https://github.com/topjohnwu/Magisk"
    }
  },
  {
    id: "8",
    brand: "Motorola",
    model: "Edge 40 Pro",
    type: "phone",
    osVersion: "Android 13",
    compatibility: "full",
    manufacturerLink: "https://www.motorola.com/edge-40-pro",
    notes: "Clean Android experience with good performance.",
    rootLinks: {
      xda: "https://forum.xda-developers.com/f/motorola-edge-40-pro.12743/",
      tutorial: "https://www.xda-developers.com/motorola-edge-40-pro-root/"
    }
  },
  {
    id: "9",
    brand: "Lenovo",
    model: "Tab P12 Pro",
    type: "tablet",
    osVersion: "Android 12",
    compatibility: "full",
    manufacturerLink: "https://www.lenovo.com/tab-p12-pro",
    notes: "OLED display with great colors. Good for tablet gameplay.",
    rootLinks: {
      xda: "https://forum.xda-developers.com/f/lenovo-tab-p12-pro.12567/"
    }
  },
  {
    id: "10",
    brand: "Nothing",
    model: "Phone (2)",
    type: "phone",
    osVersion: "Android 13",
    compatibility: "full",
    manufacturerLink: "https://nothing.tech/phone-2",
    notes: "Unique design with solid performance. Stock-like Android.",
    rootLinks: {
      xda: "https://forum.xda-developers.com/f/nothing-phone-2.12753/",
      magisk: "https://github.com/topjohnwu/Magisk"
    }
  },
  {
    id: "11",
    brand: "Oppo",
    model: "Find X6 Pro",
    type: "phone",
    osVersion: "Android 13",
    compatibility: "full",
    manufacturerLink: "https://www.oppo.com/en/smartphones/series-find-x/find-x6-pro/",
    notes: "Flagship specs with ColorOS gaming mode. Smooth gameplay.",
    rootLinks: {
      xda: "https://forum.xda-developers.com/f/oppo-find-x6-pro.12699/"
    }
  },
  {
    id: "12",
    brand: "Realme",
    model: "GT 3",
    type: "phone",
    osVersion: "Android 13",
    compatibility: "full",
    manufacturerLink: "https://www.realme.com/global/realme-gt3",
    notes: "Budget-friendly with flagship performance. 240W charging is a bonus.",
    rootLinks: {
      xda: "https://forum.xda-developers.com/f/realme-gt-3.12745/",
      tutorial: "https://www.xda-developers.com/realme-gt3-unlock-bootloader-root/"
    }
  }
];
