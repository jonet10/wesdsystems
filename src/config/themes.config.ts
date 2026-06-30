export type ThemeModeColors = {
  primary: string;       // couleur principale (Hex)
  primaryLight: string;  // version claire (hover, badges)
  primaryDark: string;   // version sombre (bordures actives)
  primaryFg: string;     // #ffffff ou #000000 selon contraste WCAG AA
  bgBase: string;        // fond principal (body + sidebar)
  bgSurface: string;     // fond des cartes (légèrement plus clair)
  bgElevated: string;    // fond des modals/popovers
};

export type ThemeConfig = {
  id: string;
  label: string;
  description: string;
  light: ThemeModeColors;
  dark: ThemeModeColors;
};

export const THEMES: Record<string, ThemeConfig> = {
  minuit: {
    id: "minuit",
    label: "Minuit",
    description: "Violet profond · Défaut",
    light: {
      primary: "#7F77DD",
      primaryLight: "#9993E4",
      primaryDark: "#665ECA",
      primaryFg: "#ffffff",
      bgBase: "#f5f4ff",
      bgSurface: "#ffffff",
      bgElevated: "#eeedfe",
    },
    dark: {
      primary: "#7F77DD",
      primaryLight: "#9993E4",
      primaryDark: "#665ECA",
      primaryFg: "#ffffff",
      bgBase: "#0f0d1a",
      bgSurface: "#1a1730",
      bgElevated: "#241f45",
    },
  },
  cerise: {
    id: "cerise",
    label: "Cerise",
    description: "Rose élégant",
    light: {
      primary: "#D4537E",
      primaryLight: "#DF7598",
      primaryDark: "#B83E67",
      primaryFg: "#ffffff",
      bgBase: "#fff5f7",
      bgSurface: "#ffffff",
      bgElevated: "#fbeaf0",
    },
    dark: {
      primary: "#D4537E",
      primaryLight: "#DF7598",
      primaryDark: "#B83E67",
      primaryFg: "#ffffff",
      bgBase: "#1a0d12",
      bgSurface: "#2a1520",
      bgElevated: "#3d1d2e",
    },
  },
  braise: {
    id: "braise",
    label: "Braise",
    description: "Corail chaleureux",
    light: {
      primary: "#D85A30",
      primaryLight: "#E07B59",
      primaryDark: "#BC451D",
      primaryFg: "#ffffff",
      bgBase: "#fff6f2",
      bgSurface: "#ffffff",
      bgElevated: "#faece7",
    },
    dark: {
      primary: "#D85A30",
      primaryLight: "#E07B59",
      primaryDark: "#BC451D",
      primaryFg: "#ffffff",
      bgBase: "#1a0e09",
      bgSurface: "#2a1810",
      bgElevated: "#3d2215",
    },
  },
  jade: {
    id: "jade",
    label: "Jade",
    description: "Vert émeraude frais",
    light: {
      primary: "#1D9E75",
      primaryLight: "#3CB48E",
      primaryDark: "#157A5A",
      primaryFg: "#ffffff",
      bgBase: "#f0fdf7",
      bgSurface: "#ffffff",
      bgElevated: "#e1f5ee",
    },
    dark: {
      primary: "#1D9E75",
      primaryLight: "#3CB48E",
      primaryDark: "#157A5A",
      primaryFg: "#ffffff",
      bgBase: "#091a12",
      bgSurface: "#112b1e",
      bgElevated: "#173d2b",
    },
  },
  cobalt: {
    id: "cobalt",
    label: "Cobalt",
    description: "Bleu acier moderne",
    light: {
      primary: "#378ADD",
      primaryLight: "#5EA1E5",
      primaryDark: "#266BBA",
      primaryFg: "#ffffff",
      bgBase: "#f0f6ff",
      bgSurface: "#ffffff",
      bgElevated: "#e6f1fb",
    },
    dark: {
      primary: "#378ADD",
      primaryLight: "#5EA1E5",
      primaryDark: "#266BBA",
      primaryFg: "#ffffff",
      bgBase: "#0a1220",
      bgSurface: "#102033",
      bgElevated: "#162d47",
    },
  },
  miel: {
    id: "miel",
    label: "Miel",
    description: "Ambre doré",
    light: {
      primary: "#EF9F27",
      primaryLight: "#F3B250",
      primaryDark: "#D08212",
      primaryFg: "#000000",
      bgBase: "#fffbf0",
      bgSurface: "#ffffff",
      bgElevated: "#faeeda",
    },
    dark: {
      primary: "#EF9F27",
      primaryLight: "#F3B250",
      primaryDark: "#D08212",
      primaryFg: "#000000",
      bgBase: "#1a1305",
      bgSurface: "#2a1f08",
      bgElevated: "#3d2d0a",
    },
  },
};
