// Design tokens mirroring the OTLOB web app brand.
export const colors = {
  primary: "#12bfe5",
  primary50: "#eefcff",
  primary100: "#dff7ff",
  primary600: "#0da3c4",
  primary700: "#0b84a0",
  accent: "#ff8a3d",
  accent600: "#f26a15",
  ink: "#0b2530",
  inkMuted: "#5b7580",
  white: "#ffffff",
  border: "#e4eef1",
  success: "#1fb673",
  danger: "#e14b4b",
  warning: "#f5a623",
  bg: "#f7fbfc",
};

export const radii = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
};

export const spacing = (n: number) => n * 4;

export const shadow = {
  card: {
    shadowColor: "#0b2530",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
};

// Font families — register these via expo-font in app/_layout.tsx.
// Drop the actual .ttf files into assets/fonts/ (see README).
export const fonts = {
  headingBold: "Cairo_700Bold",
  headingSemibold: "Cairo_600SemiBold",
  headingExtrabold: "Cairo_800ExtraBold",
  body: "Tajawal_400Regular",
  bodyMedium: "Tajawal_500Medium",
  bodyBold: "Tajawal_700Bold",
  mono: "IBMPlexMono_500Medium",
  monoSemibold: "IBMPlexMono_600SemiBold",
  brand: "cyberjunkies",
};

export const typography = {
  h1: { fontFamily: fonts.headingExtrabold, fontSize: 26 },
  h2: { fontFamily: fonts.headingBold, fontSize: 20 },
  h3: { fontFamily: fonts.headingSemibold, fontSize: 17 },
  body: { fontFamily: fonts.body, fontSize: 15 },
  bodyMedium: { fontFamily: fonts.bodyMedium, fontSize: 15 },
  caption: { fontFamily: fonts.body, fontSize: 13 },
  price: { fontFamily: fonts.monoSemibold, fontSize: 16 },
};

export const CURRENCY_SUFFIX = "ج.م";