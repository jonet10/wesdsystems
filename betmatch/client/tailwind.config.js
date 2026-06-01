/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        betmatch: {
          bg: "#0d0a1f",
          panel: "#15112d",
          accent: "#8b5cf6",
          hot: "#ec4899",
        },
      },
      boxShadow: {
        glass: "0 20px 80px rgba(0,0,0,0.35)",
      },
      backgroundImage: {
        "bet-gradient": "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
      },
    },
  },
  plugins: [],
};
