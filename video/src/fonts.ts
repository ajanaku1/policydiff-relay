import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";
import { loadFont as loadManrope } from "@remotion/google-fonts/Manrope";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

export const { fontFamily: DISPLAY } = loadFraunces("normal", {
  subsets: ["latin"],
  weights: ["600", "700"],
});

export const { fontFamily: SANS } = loadManrope("normal", {
  subsets: ["latin"],
  weights: ["400", "500", "600", "700", "800"],
});

export const { fontFamily: MONO } = loadMono("normal", {
  subsets: ["latin"],
  weights: ["400", "600", "700"],
});
